import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import * as tus from 'tus-js-client';

declare global {
  interface Window {
    __SUPABASE_URL__?: string;
  }
}

interface UploadMetadata {
  title: string;
  folderId: string;
  clientId?: string | null;
  durationSeconds: number;
  meetingDate: string;
  participants: string[];
  isWholeTeam: boolean;
  ata?: string | null;
  summary?: string | null;
}

interface UploadProgress {
  stage: 'video' | 'audio' | 'saving';
  percentage: number;
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

interface UseUploadMeetingRecordingReturn {
  upload: (videoBlob: Blob, audioBlob: Blob, metadata: UploadMetadata) => Promise<string>;
  status: UploadStatus;
  progress: UploadProgress;
  error: string | null;
  reset: () => void;
}

// TUS upload threshold — files above this use resumable upload
const TUS_THRESHOLD = 6 * 1024 * 1024; // 6MB

function uploadBlobWithTus(
  bucketName: string,
  objectName: string,
  blob: Blob,
  contentType: string,
  token: string,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    || window.__SUPABASE_URL__
    || '';

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName,
        contentType,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => {
        reject(new Error(`Upload falhou: ${error.message || 'Erro de conexao'}`));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress?.(pct);
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((prev) => {
      if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}

async function uploadBlob(
  bucketName: string,
  objectName: string,
  blob: Blob,
  contentType: string,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const useTus = blob.size > TUS_THRESHOLD;

  if (useTus) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessao expirada. Faca login novamente.');

    await uploadBlobWithTus(bucketName, objectName, blob, contentType, session.access_token, onProgress);
  } else {
    onProgress?.(0);
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(objectName, blob, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) throw error;
    onProgress?.(100);
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(objectName);
  return urlData.publicUrl;
}

export function useUploadMeetingRecording(): UseUploadMeetingRecordingReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState<UploadProgress>({ stage: 'video', percentage: 0 });
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress({ stage: 'video', percentage: 0 });
    setError(null);
  }, []);

  const upload = useCallback(async (
    videoBlob: Blob,
    audioBlob: Blob,
    metadata: UploadMetadata,
  ): Promise<string> => {
    if (!user) throw new Error('Usuario nao autenticado');

    setStatus('uploading');
    setError(null);

    try {
      const timestamp = Date.now();
      const userId = user.id;

      // 1. Upload video
      setProgress({ stage: 'video', percentage: 0 });
      const videoPath = `${userId}/${timestamp}-video.webm`;
      const videoUrl = await uploadBlob(
        'recorded-meetings',
        videoPath,
        videoBlob,
        'video/webm',
        (pct) => setProgress({ stage: 'video', percentage: pct }),
      );

      // 2. Upload audio
      setProgress({ stage: 'audio', percentage: 0 });
      const audioPath = `${userId}/${timestamp}-audio.webm`;
      const audioUrl = await uploadBlob(
        'recorded-meetings',
        audioPath,
        audioBlob,
        'audio/webm',
        (pct) => setProgress({ stage: 'audio', percentage: pct }),
      );

      // 3. Insert DB record
      setProgress({ stage: 'saving', percentage: 100 });

      const insertData = {
        folder_id: metadata.folderId,
        client_id: metadata.clientId || null,
        video_url: videoUrl,
        video_filename: `${timestamp}-video.webm`,
        audio_file_url: audioUrl,
        ata: metadata.ata || null,
        summary: metadata.summary || null,
        meeting_date: metadata.meetingDate,
        participants: metadata.isWholeTeam ? [] : metadata.participants,
        is_whole_team: metadata.isWholeTeam,
        file_size: videoBlob.size + audioBlob.size,
        duration_seconds: metadata.durationSeconds,
        recorded_in_browser: true,
        transcript_status: 'none',
        created_by: userId,
        created_by_name: user.name || null,
      };

      const { data: meeting, error: dbError } = await supabase
        .from('recorded_meetings')
        .insert(insertData as any)
        .select('id')
        .single();

      if (dbError) throw dbError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });

      setStatus('done');
      return meeting.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no upload';
      setError(msg);
      setStatus('error');
      throw err;
    }
  }, [user, queryClient]);

  return { upload, status, progress, error, reset };
}
