/**
 * Post-stop recording assembly.
 *
 * Fetches chunks from Storage, assembles into final blobs,
 * uploads final files via TUS, then calls finalize-recording edge function.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadBlob } from '@/lib/storageUpload';

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
}

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
    } = params;

    try {
      setError(null);

      // 1. Fetch video chunks from Storage
      setStage('fetching');
      const videoChunks: Blob[] = [];
      // Fetch in batches of 10 to avoid overwhelming the browser
      for (let i = 0; i < videoChunkCount; i += 10) {
        const batch = Array.from(
          { length: Math.min(10, videoChunkCount - i) },
          (_, k) => i + k,
        );
        const results = await Promise.all(
          batch.map(async (idx) => {
            const url = buildChunkUrl(storagePrefix, 'video', idx);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch video chunk ${idx}: ${response.status}`);
            return response.blob();
          }),
        );
        videoChunks.push(...results);
      }

      // Fetch audio chunks
      const audioChunks: Blob[] = [];
      for (let i = 0; i < audioChunkCount; i += 10) {
        const batch = Array.from(
          { length: Math.min(10, audioChunkCount - i) },
          (_, k) => i + k,
        );
        const results = await Promise.all(
          batch.map(async (idx) => {
            const url = buildChunkUrl(storagePrefix, 'audio', idx);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch audio chunk ${idx}: ${response.status}`);
            return response.blob();
          }),
        );
        audioChunks.push(...results);
      }

      // 2. Assemble blobs
      setStage('assembling');
      const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // 3. Upload final video
      setStage('uploading-video');
      const timestamp = Date.now();
      const userId = storagePrefix.split('/')[0]; // e.g. "user-id/sessions/session-id/" → "user-id"
      const videoPath = `${userId}/${timestamp}-video.webm`;
      const videoUrl = await uploadBlob(
        'recorded-meetings',
        videoPath,
        videoBlob,
        'video/webm',
      );

      // 4. Upload final audio
      setStage('uploading-audio');
      const audioPath = `${userId}/${timestamp}-audio.webm`;
      const audioUrl = await uploadBlob(
        'recorded-meetings',
        audioPath,
        audioBlob,
        'audio/webm',
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
