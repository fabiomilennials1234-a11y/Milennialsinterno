/**
 * Issue #74 — integration guard on the assembly hook itself.
 *
 * Proves the full short-recording chain: when a chunk's public-URL fetch returns
 * the Storage 404 body (HTTP 400 + `{"statusCode":"404"}`), the hook fails loud
 * and NEVER calls uploadBlob — so the 69-byte error body can never be persisted
 * as the final audio object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const uploadBlobMock = vi.fn(async () => 'https://example.com/final.webm');
vi.mock('@/lib/storageUpload', () => ({
  uploadBlob: (...args: unknown[]) => uploadBlobMock(...args),
}));

const invokeMock = vi.fn(async () => ({ data: { meeting_id: 'm-1' }, error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://store.test/${path}` } }),
      }),
    },
    functions: { invoke: (...a: unknown[]) => invokeMock(...a) },
  },
}));

import { useRecordingAssembly } from '../useRecordingAssembly';
import { EBML_MAGIC } from '@/lib/recordingAssembly';

const STORAGE_404_BODY = '{"statusCode":"404","error":"not_found","message":"Object not found"}';

function ebmlBlob(): Blob {
  return new Blob([new Uint8Array([...EBML_MAGIC, 0x9f, 0x42, 0x86])], { type: 'audio/webm' });
}

const baseParams = {
  sessionId: 's-1',
  storagePrefix: 'user-1/sessions/s-1/',
  videoChunkCount: 1,
  audioChunkCount: 1,
  durationSeconds: 4,
  title: 'Curta',
  folderId: 'f-1',
  clientId: null,
  videoMimeType: 'video/webm;codecs=vp9,opus',
  audioMimeType: 'audio/webm;codecs=opus',
};

beforeEach(() => {
  uploadBlobMock.mockClear();
  invokeMock.mockClear();
});

describe('useRecordingAssembly — short recording with a missing chunk', () => {
  it('fails loud and never uploads when an audio chunk is the Storage 404 body', async () => {
    // Video chunk OK (HTTP 200, EBML). Audio chunk missing → HTTP 400 + JSON body.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/video/')) {
        return new Response(ebmlBlob(), { status: 200 });
      }
      return new Response(STORAGE_404_BODY, { status: 400, headers: { 'content-type': 'application/json' } });
    }));

    const { result } = renderHook(() => useRecordingAssembly());

    let thrown: unknown = null;
    await act(async () => {
      await result.current.assemble(baseParams).catch((e) => { thrown = e; });
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/audio|404|fetch|chunk/i);
    expect(uploadBlobMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.current.stage).toBe('error');

    vi.unstubAllGlobals();
  });

  it('rejects when a chunk returns HTTP 200 but a JSON error body (defense-in-depth)', async () => {
    // The dangerous case assertEbmlMagic alone misses: a non-first chunk is the
    // JSON body delivered with a 200. The per-chunk screen must still reject it.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/000000.webm')) return new Response(ebmlBlob(), { status: 200 });
      return new Response(STORAGE_404_BODY, { status: 200, headers: { 'content-type': 'application/json' } });
    }));

    const { result } = renderHook(() => useRecordingAssembly());

    let thrown: unknown = null;
    await act(async () => {
      await result.current.assemble({ ...baseParams, audioChunkCount: 2 }).catch((e) => { thrown = e; });
    });

    expect(thrown).toBeInstanceOf(Error);
    expect(uploadBlobMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
