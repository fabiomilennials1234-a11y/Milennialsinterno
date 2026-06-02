/**
 * Post-stop recording assembly.
 *
 * Fetches chunks from Storage, assembles into final blobs,
 * uploads final files via TUS, then calls finalize-recording edge function.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadBlob } from '@/lib/storageUpload';
import { assembleTrackBlob, assertEbmlMagic, type TrackChunk } from '@/lib/recordingAssembly';

export type AssemblyStage = 'idle' | 'fetching' | 'assembling' | 'uploading-video' | 'uploading-audio' | 'finalizing' | 'done' | 'error';

interface UseRecordingAssemblyReturn {
  assemble: (params: AssemblyParams) => Promise<string>;
  stage: AssemblyStage;
  error: string | null;
}

interface AssemblyParams {
  sessionId: string;
  storagePrefix: string;
  videoChunkCount: number;
  audioChunkCount: number;
  durationSeconds: number;
  title: string;
  folderId: string;
  clientId: string | null;
  /** Real MIME (with codecs) from the recorder. Falls back to a codec-tagged default. */
  videoMimeType: string | null;
  audioMimeType: string | null;
}

const DEFAULT_VIDEO_MIME = 'video/webm;codecs=vp9,opus';
const DEFAULT_AUDIO_MIME = 'audio/webm;codecs=opus';

function buildChunkUrl(storagePrefix: string, track: string, index: number): string {
  const path = `${storagePrefix}${track}/${index.toString().padStart(6, '0')}.webm`;
  const { data } = supabase.storage.from('recorded-meetings').getPublicUrl(path);
  return data.publicUrl;
}

export function useRecordingAssembly(): UseRecordingAssemblyReturn {
  const [stage, setStage] = useState<AssemblyStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const assemble = useCallback(async (params: AssemblyParams): Promise<string> => {
    const {
      sessionId, storagePrefix,
      videoChunkCount, audioChunkCount,
      durationSeconds, title, folderId, clientId,
      videoMimeType, audioMimeType,
    } = params;

    try {
      setError(null);

      // 1. Fetch chunks from Storage (keep index association — fetch resolves
      //    out of order, but the container is only valid in strict index order).
      setStage('fetching');
      const fetchTrack = async (track: 'video' | 'audio', count: number): Promise<TrackChunk[]> => {
        const chunks: TrackChunk[] = [];
        // Batches of 10 to avoid overwhelming the browser.
        for (let i = 0; i < count; i += 10) {
          const batch = Array.from(
            { length: Math.min(10, count - i) },
            (_, k) => i + k,
          );
          const results = await Promise.all(
            batch.map(async (idx) => {
              const url = buildChunkUrl(storagePrefix, track, idx);
              const response = await fetch(url);
              if (!response.ok) throw new Error(`Failed to fetch ${track} chunk ${idx}: ${response.status}`);
              return { index: idx, blob: await response.blob() } as TrackChunk;
            }),
          );
          chunks.push(...results);
        }
        return chunks;
      };

      const videoChunks = await fetchTrack('video', videoChunkCount);
      const audioChunks = await fetchTrack('audio', audioChunkCount);

      // 2. Assemble blobs — validates header presence + index contiguity, then
      //    tags each with the recorder's real codec MIME. A missing chunk 0 or a
      //    hole throws an AssemblyError instead of uploading a corrupt container.
      setStage('assembling');
      const videoBlob = assembleTrackBlob(videoChunks, videoMimeType || DEFAULT_VIDEO_MIME);
      const audioBlob = assembleTrackBlob(audioChunks, audioMimeType || DEFAULT_AUDIO_MIME);

      // Last line of defence before upload: the assembled containers must begin
      // with EBML magic (0x1A45DFA3). Catches truncation and any non-WebM body.
      await assertEbmlMagic(videoBlob);
      await assertEbmlMagic(audioBlob);

      // 3. Upload final video
      setStage('uploading-video');
      const timestamp = Date.now();
      const userId = storagePrefix.split('/')[0]; // e.g. "user-id/sessions/session-id/" → "user-id"
      const videoPath = `${userId}/${timestamp}-video.webm`;
      const videoUrl = await uploadBlob(
        'recorded-meetings',
        videoPath,
        videoBlob,
        videoBlob.type,
      );

      // 4. Upload final audio
      setStage('uploading-audio');
      const audioPath = `${userId}/${timestamp}-audio.webm`;
      const audioUrl = await uploadBlob(
        'recorded-meetings',
        audioPath,
        audioBlob,
        audioBlob.type,
      );

      // 5. Call finalize-recording edge function
      setStage('finalizing');
      const { data: finalizeResult, error: finalizeError } = await supabase.functions.invoke(
        'finalize-recording',
        {
          body: {
            session_id: sessionId,
            video_url: videoUrl,
            audio_url: audioUrl,
            video_path: videoPath,
            audio_path: audioPath,
            duration_seconds: durationSeconds,
            title,
            folder_id: folderId,
            client_id: clientId,
            file_size: videoBlob.size + audioBlob.size,
          },
        },
      );

      if (finalizeError) throw finalizeError;

      setStage('done');
      return finalizeResult.meeting_id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Assembly failed';
      setError(msg);
      setStage('error');
      throw err;
    }
  }, []);

  return { assemble, stage, error };
}
