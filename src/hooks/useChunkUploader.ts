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
  /** Number of consecutive chunk upload failures (resets on any success). */
  consecutiveFailures: number;
  /** Pause upload processing for the given duration in ms. */
  pauseUploads: (ms: number) => void;
  /** Resume upload processing immediately (clears any active pause). */
  resumeUploads: () => void;
  /** Clear the permanently-failed-chunk ledger at the start of a new recording. */
  resetFailures: () => void;
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
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const videoQueueRef = useRef<ChunkJob[]>([]);
  const audioQueueRef = useRef<ChunkJob[]>([]);
  const videoProcessingRef = useRef(false);
  const audioProcessingRef = useRef(false);
  const drainResolversRef = useRef<Array<{ resolve: () => void; reject: (err: Error) => void }>>([]);
  // Chunks that exhausted all retries and were NOT written to Storage. They stay
  // in IndexedDB for recovery, but the final drain must report this loss instead
  // of resolving success — otherwise assembly fetches a missing object and
  // persists the Storage 404 JSON body as the final audio (issue #74).
  const failedChunksRef = useRef<string[]>([]);
  const consecutiveFailuresRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePendingCount = useCallback(() => {
    setPendingCount(videoQueueRef.current.length + audioQueueRef.current.length);
  }, []);

  const checkDrained = useCallback(() => {
    if (videoQueueRef.current.length === 0 && audioQueueRef.current.length === 0 &&
        !videoProcessingRef.current && !audioProcessingRef.current) {
      const resolvers = drainResolversRef.current;
      drainResolversRef.current = [];
      const failed = failedChunksRef.current;
      if (failed.length > 0) {
        const err = new Error(
          `Falha ao enviar ${failed.length} parte(s) da gravacao: ${failed.join(', ')}. ` +
          `Os dados ficaram salvos localmente para recuperacao.`,
        );
        resolvers.forEach((r) => r.reject(err));
      } else {
        resolvers.forEach((r) => r.resolve());
      }
    }
  }, []);

  const processQueue = useCallback(async (
    queueRef: React.MutableRefObject<ChunkJob[]>,
    processingRef: React.MutableRefObject<boolean>,
  ) => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      // Respect pause: wait until pause expires
      const now = Date.now();
      if (pausedUntilRef.current > now) {
        const waitMs = pausedUntilRef.current - now;
        await sleep(waitMs);
      }

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
            // Track consecutive failures
            consecutiveFailuresRef.current += 1;
            setConsecutiveFailures(consecutiveFailuresRef.current);
            // Leave chunk in IDB for recovery, but RECORD the loss so drainQueue
            // rejects instead of letting assembly run against a missing object.
            failedChunksRef.current.push(`${job.track}/${job.index}`);
          }
        }
      }

      if (uploaded) {
        // Reset consecutive failures on any success
        if (consecutiveFailuresRef.current > 0) {
          consecutiveFailuresRef.current = 0;
          setConsecutiveFailures(0);
        }
        // A retry (recovery) that finally lands clears the earlier loss record.
        const key = `${job.track}/${job.index}`;
        failedChunksRef.current = failedChunksRef.current.filter((k) => k !== key);
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
    const drained = videoQueueRef.current.length === 0 && audioQueueRef.current.length === 0 &&
        !videoProcessingRef.current && !audioProcessingRef.current;

    if (drained) {
      const failed = failedChunksRef.current;
      if (failed.length > 0) {
        return Promise.reject(new Error(
          `Falha ao enviar ${failed.length} parte(s) da gravacao: ${failed.join(', ')}. ` +
          `Os dados ficaram salvos localmente para recuperacao.`,
        ));
      }
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        drainResolversRef.current = drainResolversRef.current.filter((r) => r !== entry);
        reject(new Error('Tempo limite de upload excedido (60s)'));
      }, 60_000);

      const entry = {
        resolve: () => { clearTimeout(timeout); resolve(); },
        reject: (err: Error) => { clearTimeout(timeout); reject(err); },
      };

      drainResolversRef.current.push(entry);
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

  const pauseUploads = useCallback((ms: number) => {
    pausedUntilRef.current = Date.now() + ms;
    // Auto-resume after duration
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      pausedUntilRef.current = 0;
      pauseTimerRef.current = null;
    }, ms);
  }, []);

  const resumeUploads = useCallback(() => {
    pausedUntilRef.current = 0;
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const resetFailures = useCallback(() => {
    failedChunksRef.current = [];
  }, []);

  return {
    enqueueChunk,
    drainQueue,
    uploadPendingFromIDB,
    pendingCount,
    error,
    consecutiveFailures,
    pauseUploads,
    resumeUploads,
    resetFailures,
  };
}
