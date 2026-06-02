/**
 * Issue #74 — short recordings persist a 404 JSON body as the final audio.
 *
 * Root cause (diagnosed): the chunk uploader silently abandons a chunk after
 * MAX_RETRIES (shift + continue) while `drainQueue()` resolves SUCCESS. The
 * orchestrator then runs assembly trusting every chunk is in Storage. On a
 * short recording the missing chunk's public URL returns HTTP 400 with the
 * 69-byte `{"statusCode":"404"}` body — the exact artifact found in the bucket.
 *
 * These tests pin the durability contract:
 *   1. a permanently-failed chunk makes `drainQueue()` REJECT (never silent OK);
 *   2. the failed chunk is named in the error so the user/log knows what was lost;
 *   3. an all-success drain still resolves cleanly (no false positives).
 *
 * The chunk stays in IndexedDB on failure (recovery path), which is asserted
 * indirectly: we never call markUploaded for a failed chunk.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Storage upload mock: per-path scripted success/failure ──
const uploadResults = new Map<string, Array<{ error: { message: string } | null }>>();
const uploadCalls: string[] = [];

function scriptUpload(path: string, results: Array<{ error: { message: string } | null }>) {
  uploadResults.set(path, [...results]);
}

const markUploadedMock = vi.fn(async () => {});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(async (path: string) => {
          uploadCalls.push(path);
          const scripted = uploadResults.get(path);
          if (scripted && scripted.length > 0) return scripted.shift()!;
          return { error: null };
        }),
      }),
    },
  },
}));

vi.mock('@/lib/recordingIDB', () => ({
  saveChunk: vi.fn(async () => {}),
  markUploaded: (...args: unknown[]) => markUploadedMock(...args),
  getPendingChunks: vi.fn(async () => []),
}));

import { useChunkUploader } from '../useChunkUploader';

const PREFIX = 'user-1/sessions/sess-1/';

function audioJob(index: number, blob = new Blob([new Uint8Array([0x1a])])) {
  return { sessionId: 'sess-1', track: 'audio' as const, index, blob, storagePrefix: PREFIX };
}

beforeEach(() => {
  vi.useRealTimers();
  uploadResults.clear();
  uploadCalls.length = 0;
  markUploadedMock.mockClear();
});

describe('useChunkUploader durability — drainQueue must not hide dropped chunks', () => {
  it('rejects drainQueue when a chunk fails permanently (never silent success)', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChunkUploader());

    // audio chunk 0 fails on every attempt (4 tries) → permanently dropped.
    const failing = Array.from({ length: 5 }, () => ({ error: { message: 'network down' } }));
    scriptUpload(`${PREFIX}audio/000000.webm`, failing);

    let drainErr: unknown = null;
    await act(async () => {
      result.current.enqueueChunk(audioJob(0));
      const drain = result.current.drainQueue().catch((e) => { drainErr = e; });
      // Advance through the retry backoff delays (1s, 3s, 8s).
      await vi.runAllTimersAsync();
      await drain;
    });

    expect(drainErr).toBeInstanceOf(Error);
    expect((drainErr as Error).message).toMatch(/audio.*0|chunk/i);
    expect(markUploadedMock).not.toHaveBeenCalled();
  });

  it('resolves drainQueue for a short all-success recording (no false positive)', async () => {
    const { result } = renderHook(() => useChunkUploader());

    let resolved = false;
    await act(async () => {
      result.current.enqueueChunk(audioJob(0));
      result.current.enqueueChunk(audioJob(1));
      await result.current.drainQueue();
      resolved = true;
    });

    expect(resolved).toBe(true);
    expect(markUploadedMock).toHaveBeenCalledTimes(2);
  });

  it('a transient failure that succeeds on a later retry does NOT reject the drain', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChunkUploader());

    // First attempt fails, second attempt succeeds (within MAX_RETRIES).
    scriptUpload(`${PREFIX}audio/000000.webm`, [
      { error: { message: 'blip' } },
      { error: null },
    ]);

    let drainErr: unknown = 'unset';
    await act(async () => {
      result.current.enqueueChunk(audioJob(0));
      const drain = result.current.drainQueue().then(() => { drainErr = null; }).catch((e) => { drainErr = e; });
      await vi.runAllTimersAsync();
      await drain;
    });

    expect(drainErr).toBeNull();
    expect(markUploadedMock).toHaveBeenCalledTimes(1);
  });
});
