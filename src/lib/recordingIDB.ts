/**
 * IndexedDB wrapper for recording chunks.
 *
 * Chunks are written here BEFORE upload to Storage.
 * If the browser crashes, chunks survive and can be recovered.
 *
 * DB: "recording-chunks"
 * Store: "chunks" with keyPath [sessionId, track, index]
 */

const DB_NAME = 'recording-chunks';
const DB_VERSION = 1;
const STORE_NAME = 'chunks';

export interface ChunkRecord {
  sessionId: string;
  track: 'video' | 'audio';
  index: number;
  blob: Blob;
  createdAt: number; // Date.now()
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openRecordingDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: ['sessionId', 'track', 'index'],
        });
        store.createIndex('bySession', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function saveChunk(
  sessionId: string,
  track: 'video' | 'audio',
  index: number,
  blob: Blob,
): Promise<void> {
  const db = await openRecordingDB();
  const record: ChunkRecord = { sessionId, track, index, blob, createdAt: Date.now() };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getChunk(
  sessionId: string,
  track: 'video' | 'audio',
  index: number,
): Promise<ChunkRecord | undefined> {
  const db = await openRecordingDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get([sessionId, track, index]);
    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function markUploaded(
  sessionId: string,
  track: 'video' | 'audio',
  index: number,
): Promise<void> {
  const db = await openRecordingDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete([sessionId, track, index]);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingChunks(sessionId: string): Promise<ChunkRecord[]> {
  const db = await openRecordingDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('bySession');
    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

/** Returns unique session IDs that have any chunks stored in IDB. */
export async function getOrphanedSessionIds(): Promise<string[]> {
  const db = await openRecordingDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('bySession');
    const request = index.openKeyCursor();
    const ids = new Set<string>();

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        ids.add(cursor.key as string);
        cursor.continue();
      } else {
        resolve([...ids]);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearSession(sessionId: string): Promise<void> {
  const chunks = await getPendingChunks(sessionId);
  if (chunks.length === 0) return;

  const db = await openRecordingDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const chunk of chunks) {
      store.delete([chunk.sessionId, chunk.track, chunk.index]);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
