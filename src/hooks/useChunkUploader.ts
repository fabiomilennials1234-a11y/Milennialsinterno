/**
 * Upload queue for recording chunks.
 *
 * Chunks are uploaded serially per track (video/audio queues run in parallel).
 * On success, the chunk is removed from IndexedDB.
 * On failure after retries, chunk stays in IDB for recovery.
 */
import { useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveChunk, markUploaded, getPendingChunks } from '@/lib/recordingIDB';

interface ChunkJob {
  sessionId: string;
  track: 'video' | 'audio';
  index: number;
  blob: Blob;
  storagePrefix: string;
}

interface UseChunkUploaderReturn {
  /** Enqueue a chunk: saves to IDB immediately, then uploads to Storage. */
  enqueueChunk: (job: ChunkJob) => void;
  /** Wait for all pending uploads to complete. */
  drainQueue: () => Promise<void>;
  /** Upload any IDB-persisted chunks that weren't uploaded yet (recovery). */
  uploadPendingFromIDB: (sessionId: string, storagePrefix: string) => Promise<void>;
  pendingCount: number;
  error: string | null;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000];

function buildStoragePath(storagePrefix: string, track: string, index: number): string {
  return `${storagePrefix}${track}/${index.toString().padStart(6, '0')}.webm`;
}

async function uploadChunkToStorage(
  path: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from('recorded-meetings')
    .upload(path, blob, { contentType, cacheControl: '3600', upsert: true });

  if (error) throw error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useChunkUploader(): UseChunkUploaderReturn {
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoQueueRef = useRef<ChunkJob[]>([]);
  const audioQueueRef = useRef<ChunkJob[]>([]);
  const videoProcessingRef = useRef(false);
  const audioProcessingRef = useRef(false);
  const drainResolversRef = useRef<Array<() => void>>([]);

  const updatePendingCount = useCallback(() => {
    setPendingCount(videoQueueRef.current.length + audioQueueRef.current.length);
  }, []);

  const checkDrained = useCallback(() => {
    if (videoQueueRef.current.length === 0 && audioQueueRef.current.length === 0 &&
        !videoProcessingRef.current && !audioProcessingRef.current) {
      const resolvers = drainResolversRef.current;
      drainResolversRef.current = [];
      resolvers.forEach((r) => r());
    }
  }, []);

  const processQueue = useCallback(async (
    queueRef: React.MutableRefObject<ChunkJob[]>,
    processingRef: React.MutableRefObject<boolean>,
  ) => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const job = queueRef.current[0];
      const path = buildStoragePath(job.storagePrefix, job.track, job.index);
      const contentType = job.track === 'video' ? 'video/webm' : 'audio/webm';

      let uploaded = false;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          await uploadChunkToStorage(path, job.blob, contentType);
          uploaded = true;
          break;
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAYS[attempt]);
          } else {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            setError(msg);
            console.error(`[ChunkUploader] Failed after ${MAX_RETRIES} retries:`, msg);
            // Leave chunk in IDB for recovery — skip this chunk and continue
          }
        }
      }

      if (uploaded) {
        await markUploaded(job.sessionId, job.track, job.index);
      }

      queueRef.current.shift();
      updatePendingCount();
    }

    processingRef.current = false;
    checkDrained();
  }, [updatePendingCount, checkDrained]);

  const enqueueChunk = useCallback((job: ChunkJob) => {
    // Save to IDB first (crash protection)
    saveChunk(job.sessionId, job.track, job.index, job.blob).catch((err) => {
      console.error('[ChunkUploader] IDB save failed:', err);
    });

    // Enqueue for upload
    const queueRef = job.track === 'video' ? videoQueueRef : audioQueueRef;
    const processingRef = job.track === 'video' ? videoProcessingRef : audioProcessingRef;

    queueRef.current.push(job);
    updatePendingCount();
    processQueue(queueRef, processingRef);
  }, [processQueue, updatePendingCount]);

  const drainQueue = useCallback((): Promise<void> => {
    if (videoQueueRef.current.length === 0 && audioQueueRef.current.length === 0 &&
        !videoProcessingRef.current && !audioProcessingRef.current) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove this resolver from the list
        drainResolversRef.current = drainResolversRef.current.filter((r) => r !== wrappedResolve);
        reject(new Error('Tempo limite de upload excedido (60s)'));
      }, 60_000);

      const wrappedResolve = () => {
        clearTimeout(timeout);
        resolve();
      };

      drainResolversRef.current.push(wrappedResolve);
    });
  }, []);

  const uploadPendingFromIDB = useCallback(async (
    sessionId: string,
    storagePrefix: string,
  ) => {
    try {
      const pending = await getPendingChunks(sessionId);
      if (pending.length === 0) return;

      // Sort by track and index for deterministic upload order
      pending.sort((a, b) => {
        if (a.track !== b.track) return a.track === 'video' ? -1 : 1;
        return a.index - b.index;
      });

      for (const chunk of pending) {
        enqueueChunk({
          sessionId: chunk.sessionId,
          track: chunk.track,
          index: chunk.index,
          blob: chunk.blob,
          storagePrefix,
        });
      }

      await drainQueue();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao recuperar chunks';
      console.error('[ChunkUploader] Erro ao carregar chunks pendentes do IDB:', err);
      setError(msg);
    }
  }, [enqueueChunk, drainQueue]);

  return { enqueueChunk, drainQueue, uploadPendingFromIDB, pendingCount, error };
}
