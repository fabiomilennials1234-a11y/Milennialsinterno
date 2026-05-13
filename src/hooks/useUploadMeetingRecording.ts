import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { uploadBlob } from '@/lib/storageUpload';

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
        title: metadata.title || null,
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
        .insert(insertData)
        .select('id')
        .single();

      if (dbError) throw dbError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });

      // Fire-and-forget transcription
      supabase.functions.invoke('transcribe-meeting', {
        body: { recording_id: meeting.id },
      }).catch((err) => console.warn('Transcription trigger failed:', err));

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
