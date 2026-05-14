/**
 * CRUD hook for recording_sessions table.
 *
 * Manages the server-side state machine:
 *   recording → stopped → assembling → done | failed | abandoned
 */
import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RecordingSession {
  id: string;
  title: string;
  folder_id: string;
  client_id: string | null;
  status: string;
  chunk_count: number;
  total_bytes: number;
  duration_seconds: number | null;
  storage_prefix: string;
  meeting_id: string | null;
  error_message: string | null;
  started_at: string;
  stopped_at: string | null;
  created_by: string;
}

interface UseRecordingSessionReturn {
  createSession: (params: {
    title: string;
    folderId: string;
    clientId?: string | null;
  }) => Promise<RecordingSession>;
  updateChunkProgress: (sessionId: string, chunkCount: number, totalBytes: number) => Promise<void>;
  stopSession: (sessionId: string, durationSeconds: number) => Promise<void>;
  markAssembling: (sessionId: string) => Promise<void>;
  markDone: (sessionId: string, meetingId: string) => Promise<void>;
  markFailed: (sessionId: string, errorMessage: string) => Promise<void>;
  abandonSession: (sessionId: string) => Promise<void>;
  getIncompleteSessions: () => Promise<RecordingSession[]>;
}

export function useRecordingSession(): UseRecordingSessionReturn {
  const { user } = useAuth();

  const createSession = useCallback(async (params: {
    title: string;
    folderId: string;
    clientId?: string | null;
  }): Promise<RecordingSession> => {
    if (!user) throw new Error('Not authenticated');

    const storagePrefix = `${user.id}/sessions/${crypto.randomUUID()}/`;

    const { data, error } = await supabase
      .from('recording_sessions')
      .insert({
        created_by: user.id,
        title: params.title,
        folder_id: params.folderId,
        client_id: params.clientId || null,
        storage_prefix: storagePrefix,
        status: 'recording',
      })
      .select()
      .single();

    if (error) throw error;
    return data as RecordingSession;
  }, [user]);

  const updateChunkProgress = useCallback(async (
    sessionId: string,
    chunkCount: number,
    totalBytes: number,
  ) => {
    const { error } = await supabase
      .from('recording_sessions')
      .update({ chunk_count: chunkCount, total_bytes: totalBytes })
      .eq('id', sessionId);

    if (error) console.error('[RecordingSession] updateChunkProgress failed:', error);
  }, []);

  const stopSession = useCallback(async (sessionId: string, durationSeconds: number) => {
    const { error } = await supabase
      .from('recording_sessions')
      .update({ status: 'stopped', duration_seconds: durationSeconds, stopped_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
  }, []);

  const markAssembling = useCallback(async (sessionId: string) => {
    const { error } = await supabase
      .from('recording_sessions')
      .update({ status: 'assembling' })
      .eq('id', sessionId);

    if (error) throw error;
  }, []);

  const markDone = useCallback(async (sessionId: string, meetingId: string) => {
    const { error } = await supabase
      .from('recording_sessions')
      .update({ status: 'done', meeting_id: meetingId, assembled_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
  }, []);

  const markFailed = useCallback(async (sessionId: string, errorMessage: string) => {
    const { error } = await supabase
      .from('recording_sessions')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', sessionId);

    if (error) throw error;
  }, []);

  const abandonSession = useCallback(async (sessionId: string) => {
    const { error } = await supabase
      .from('recording_sessions')
      .update({ status: 'abandoned' })
      .eq('id', sessionId);

    if (error) throw error;
  }, []);

  const getIncompleteSessions = useCallback(async (): Promise<RecordingSession[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('recording_sessions')
      .select('*')
      .eq('created_by', user.id)
      .in('status', ['recording', 'stopped'])
      .order('started_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as RecordingSession[];
  }, [user]);

  return useMemo(() => ({
    createSession,
    updateChunkProgress,
    stopSession,
    markAssembling,
    markDone,
    markFailed,
    abandonSession,
    getIncompleteSessions,
  }), [
    createSession,
    updateChunkProgress,
    stopSession,
    markAssembling,
    markDone,
    markFailed,
    abandonSession,
    getIncompleteSessions,
  ]);
}
