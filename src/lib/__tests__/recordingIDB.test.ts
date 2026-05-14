import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openRecordingDB,
  saveChunk,
  getChunk,
  markUploaded,
  getPendingChunks,
  clearSession,
  getOrphanedSessionIds,
} from '../recordingIDB';

// The module caches dbPromise. We can't reset it between tests with vi.resetModules()
// because the import is static. Instead, we reuse the same DB and clean the store
// between tests to get isolation.

beforeEach(async () => {
  // Open the DB and clear all records
  const db = await openRecordingDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    tx.objectStore('chunks').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
});

describe('recordingIDB', () => {
  it('saveChunk + getChunk roundtrip', async () => {
    const blob = new Blob(['test-data'], { type: 'video/webm' });

    await saveChunk('session-1', 'video', 0, blob);

    const result = await getChunk('session-1', 'video', 0);
    expect(result).toBeDefined();
    expect(result!.sessionId).toBe('session-1');
    expect(result!.track).toBe('video');
    expect(result!.index).toBe(0);
    expect(result!.createdAt).toBeGreaterThan(0);
  });

  it('getChunk returns undefined for missing chunk', async () => {
    const result = await getChunk('nonexistent', 'video', 999);
    expect(result).toBeUndefined();
  });

  it('markUploaded removes chunk', async () => {
    const blob = new Blob(['data'], { type: 'video/webm' });
    await saveChunk('session-1', 'video', 0, blob);

    await markUploaded('session-1', 'video', 0);

    const result = await getChunk('session-1', 'video', 0);
    expect(result).toBeUndefined();
  });

  it('getPendingChunks returns correct chunks for session', async () => {
    const blob = new Blob(['data'], { type: 'video/webm' });

    await saveChunk('session-1', 'video', 0, blob);
    await saveChunk('session-1', 'video', 1, blob);
    await saveChunk('session-1', 'audio', 0, blob);
    await saveChunk('session-2', 'video', 0, blob); // different session

    const chunks = await getPendingChunks('session-1');
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.sessionId === 'session-1')).toBe(true);
  });

  it('clearSession removes all chunks for session', async () => {
    const blob = new Blob(['data'], { type: 'video/webm' });

    await saveChunk('session-1', 'video', 0, blob);
    await saveChunk('session-1', 'audio', 0, blob);
    await saveChunk('session-2', 'video', 0, blob);

    await clearSession('session-1');

    const session1Chunks = await getPendingChunks('session-1');
    expect(session1Chunks).toHaveLength(0);

    // session-2 should be untouched
    const session2Chunks = await getPendingChunks('session-2');
    expect(session2Chunks).toHaveLength(1);
  });

  it('clearSession is a no-op for empty session', async () => {
    // Should not throw
    await clearSession('nonexistent');
  });

  it('getOrphanedSessionIds returns unique session IDs', async () => {
    const blob = new Blob(['data'], { type: 'video/webm' });

    await saveChunk('session-A', 'video', 0, blob);
    await saveChunk('session-A', 'video', 1, blob);
    await saveChunk('session-B', 'audio', 0, blob);

    const ids = await getOrphanedSessionIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain('session-A');
    expect(ids).toContain('session-B');
  });

  it('getOrphanedSessionIds returns empty array when no chunks', async () => {
    const ids = await getOrphanedSessionIds();
    expect(ids).toHaveLength(0);
  });

  it('saveChunk overwrites existing chunk (upsert via put)', async () => {
    const blob1 = new Blob(['original'], { type: 'video/webm' });
    const blob2 = new Blob(['updated-data'], { type: 'video/webm' });

    await saveChunk('session-1', 'video', 0, blob1);
    await saveChunk('session-1', 'video', 0, blob2);

    const result = await getChunk('session-1', 'video', 0);
    expect(result).toBeDefined();
    // Only one record should exist (put = upsert)
    const all = await getPendingChunks('session-1');
    expect(all).toHaveLength(1);
  });
});
