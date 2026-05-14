/**
 * Orchestrator hook for the recording pipeline.
 *
 * Concentrates ALL recording logic, consumed by MeetingRecorderRoot:
 * - State machine (OverlayState)
 * - Form state (title, folderId, clientId, showSetup)
 * - Chunk callback wiring (videoChunk / audioChunk -> chunkUploader.enqueue)
 * - Stop pipeline (drain -> flush -> stop -> assemble)
 * - Auto-stop handler (browser "Stop sharing")
 * - Auto-stop by shouldAutoStop (from useRecordingLimits)
 * - beforeunload guard
 * - Progress debounce
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMeetingRecorder } from '@/hooks/useMeetingRecorder';
import { useChunkUploader } from '@/hooks/useChunkUploader';
import { useRecordingSession, RecordingSession } from '@/hooks/useRecordingSession';
import { useRecordingAssembly, AssemblyStage } from '@/hooks/useRecordingAssembly';
import { useRecordingRecovery, RecoverableSession } from '@/hooks/useRecordingRecovery';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRecordingLimits } from '@/hooks/useRecordingLimits';
import { useRecordedMeetings } from '@/hooks/useRecordedMeetings';
import { useAllActiveClients } from '@/hooks/useAllActiveClients';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { clearSession } from '@/lib/recordingIDB';

export type OverlayState = 'idle' | 'setup' | 'recording' | 'paused' | 'processing' | 'done' | 'error';

export interface UseRecordingOrchestratorReturn {
  // Data queries
  folders: ReturnType<typeof useRecordedMeetings>['folders'];
  clients: ReturnType<typeof useAllActiveClients>['data'];
  clientsLoading: boolean;

  // State
  overlayState: OverlayState;
  activeSession: RecordingSession | null;
  pipelineError: string | null;

  // Form
  title: string;
  setTitle: (v: string) => void;
  folderId: string;
  setFolderId: (v: string) => void;
  clientId: string | null;
  setClientId: (v: string | null) => void;
  showSetup: boolean;

  // Network + limits
  isOffline: boolean;
  isApproachingLimit: boolean;
  remainingSeconds: number;

  // Recording metrics
  durationSeconds: number;
  pendingChunkCount: number;
  assemblyStage: AssemblyStage;
  assemblyError: string | null;
  recorderError: string | null;

  // Recovery
  recoverableSessions: RecoverableSession[];
  abandonRecovery: (sessionId: string) => Promise<void>;
  dismissRecovery: (sessionId: string) => void;

  // Actions
  openSetup: () => void;
  closeSetup: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => Promise<void>;
  dismiss: () => void;
}

export function useRecordingOrchestrator(): UseRecordingOrchestratorReturn {
  const { folders } = useRecordedMeetings();
  const { data: clients = [], isLoading: clientsLoading } = useAllActiveClients();
  const queryClient = useQueryClient();

  // ── Form state ──
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // ── Pipeline state ──
  const [activeSession, setActiveSession] = useState<RecordingSession | null>(null);
  const [pipelineState, setPipelineState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // ── Refs for stable callback access ──
  const videoCountRef = useRef(0);
  const audioCountRef = useRef(0);
  const totalBytesRef = useRef(0);
  const activeSessionRef = useRef<RecordingSession | null>(null);
  activeSessionRef.current = activeSession;
  const stoppingRef = useRef(false);

  // ── Hooks ──
  const chunkUploader = useChunkUploader();
  const sessionApi = useRecordingSession();
  const assembly = useRecordingAssembly();
  const recovery = useRecordingRecovery();

  // Refs for form values (stable access in callbacks)
  const titleRef = useRef(title);
  const folderIdRef = useRef(folderId);
  const clientIdRef = useRef(clientId);
  titleRef.current = title;
  folderIdRef.current = folderId;
  clientIdRef.current = clientId;

  // ── Debounced DB progress update ──
  const lastProgressUpdateRef = useRef(0);
  const progressUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleProgressUpdate = useCallback(() => {
    if (progressUpdateTimerRef.current) return;

    progressUpdateTimerRef.current = setTimeout(async () => {
      progressUpdateTimerRef.current = null;
      const session = activeSessionRef.current;
      if (session) {
        try {
          await sessionApi.updateChunkProgress(
            session.id,
            videoCountRef.current + audioCountRef.current,
            totalBytesRef.current,
          );
          lastProgressUpdateRef.current = Date.now();
        } catch (err) {
          // Non-critical: progress flush failure must not crash recording
          console.error('[Recording] Erro ao atualizar progresso:', err);
        }
      }
    }, 5000);
  }, [sessionApi]);

  // ── Chunk callbacks ──
  const handleVideoChunk = useCallback((blob: Blob, index: number) => {
    const session = activeSessionRef.current;
    if (!session) return;

    videoCountRef.current = index + 1;
    totalBytesRef.current += blob.size;

    chunkUploader.enqueueChunk({
      sessionId: session.id,
      track: 'video',
      index,
      blob,
      storagePrefix: session.storage_prefix,
    });

    scheduleProgressUpdate();
  }, [chunkUploader, scheduleProgressUpdate]);

  const handleAudioChunk = useCallback((blob: Blob, index: number) => {
    const session = activeSessionRef.current;
    if (!session) return;

    audioCountRef.current = index + 1;
    totalBytesRef.current += blob.size;

    chunkUploader.enqueueChunk({
      sessionId: session.id,
      track: 'audio',
      index,
      blob,
      storagePrefix: session.storage_prefix,
    });

    scheduleProgressUpdate();
  }, [chunkUploader, scheduleProgressUpdate]);

  // ── Auto-stop handler (browser "Stop sharing") ──
  const handleAutoStop = useCallback(async (durationSeconds: number) => {
    const session = activeSessionRef.current;
    if (!session) return;

    setPipelineState('processing');

    try {
      await chunkUploader.drainQueue();

      await sessionApi.updateChunkProgress(
        session.id,
        videoCountRef.current + audioCountRef.current,
        totalBytesRef.current,
      );

      await sessionApi.stopSession(session.id, durationSeconds);

      const meetingId = await assembly.assemble({
        sessionId: session.id,
        storagePrefix: session.storage_prefix,
        videoChunkCount: videoCountRef.current,
        audioChunkCount: audioCountRef.current,
        durationSeconds,
        title: titleRef.current.trim(),
        folderId: folderIdRef.current,
        clientId: clientIdRef.current,
      });

      await clearSession(session.id);
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });
      setPipelineState('done');
      toast.success('Gravacao salva com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setPipelineError(msg);
      setPipelineState('error');
      toast.error('Erro ao salvar gravacao: ' + msg);

      if (session) {
        try {
          await sessionApi.markFailed(session.id, msg);
        } catch (markErr) {
          console.error('[Recording] Erro ao marcar sessao como falha:', markErr);
        }
      }
    }
  }, [chunkUploader, sessionApi, assembly, queryClient]);

  // ── Recorder (depends on chunk + autoStop callbacks — declared AFTER them to avoid TDZ) ──
  const recorder = useMeetingRecorder({
    onAutoStop: handleAutoStop,
    onVideoChunk: handleVideoChunk,
    onAudioChunk: handleAudioChunk,
  });

  // ── Derived overlay state ──
  const overlayState: OverlayState = (() => {
    if (pipelineState === 'processing') return 'processing';
    if (pipelineState === 'done') return 'done';
    if (pipelineState === 'error') return 'error';
    if (recorder.status === 'recording') return 'recording';
    if (recorder.status === 'paused') return 'paused';
    return 'idle';
  })();

  // ── Network + limits ──
  const isActive = overlayState === 'recording' || overlayState === 'paused';
  const { isOffline } = useNetworkStatus(isActive);
  const { isApproachingLimit, remainingSeconds, shouldAutoStop } = useRecordingLimits(recorder.durationSeconds, isActive);

  // ── handleStop — declared BEFORE the useEffect that references it ──
  const handleStop = useCallback(async () => {
    if (!activeSession || stoppingRef.current) return;
    stoppingRef.current = true;

    setPipelineState('processing');

    try {
      const durationSeconds = await recorder.stopRecording();

      await chunkUploader.drainQueue();

      await sessionApi.updateChunkProgress(
        activeSession.id,
        videoCountRef.current + audioCountRef.current,
        totalBytesRef.current,
      );

      await sessionApi.stopSession(activeSession.id, durationSeconds);

      const meetingId = await assembly.assemble({
        sessionId: activeSession.id,
        storagePrefix: activeSession.storage_prefix,
        videoChunkCount: videoCountRef.current,
        audioChunkCount: audioCountRef.current,
        durationSeconds,
        title: titleRef.current.trim(),
        folderId: folderIdRef.current,
        clientId: clientIdRef.current,
      });

      await clearSession(activeSession.id);
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });
      setPipelineState('done');
      toast.success('Gravacao salva com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setPipelineError(msg);
      setPipelineState('error');
      toast.error('Erro ao salvar gravacao: ' + msg);

      if (activeSession) {
        try {
          await sessionApi.markFailed(activeSession.id, msg);
        } catch (markErr) {
          console.error('[Recording] Erro ao marcar sessao como falha:', markErr);
        }
      }
    } finally {
      stoppingRef.current = false;
    }
  }, [activeSession, recorder, chunkUploader, sessionApi, assembly, queryClient]);

  // ── Auto-stop when 2h limit reached ──
  useEffect(() => {
    if (shouldAutoStop) {
      handleStop();
    }
  }, [shouldAutoStop, handleStop]);

  // ── Prevent page close during recording/processing ──
  useEffect(() => {
    const shouldBlock = overlayState === 'recording' || overlayState === 'paused' || overlayState === 'processing';
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [overlayState]);

  // ── Cleanup progress timer on unmount ──
  useEffect(() => {
    return () => {
      if (progressUpdateTimerRef.current) {
        clearTimeout(progressUpdateTimerRef.current);
      }
    };
  }, []);

  // ── Actions ──
  const openSetup = useCallback(() => {
    if (!recorder.isSupported) {
      toast.error('Seu navegador nao suporta gravacao de tela');
      return;
    }
    setTitle('');
    setFolderId('');
    setClientId(null);
    setShowSetup(true);
  }, [recorder.isSupported]);

  const closeSetup = useCallback(() => {
    setShowSetup(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!title.trim()) {
      toast.error('Titulo e obrigatorio');
      return;
    }
    if (!folderId) {
      toast.error('Selecione uma pasta');
      return;
    }

    let session: RecordingSession | null = null;
    try {
      session = await sessionApi.createSession({
        title: title.trim(),
        folderId,
        clientId,
      });

      videoCountRef.current = 0;
      audioCountRef.current = 0;
      totalBytesRef.current = 0;

      setActiveSession(session);
      setPipelineState('idle');
      setPipelineError(null);
      setShowSetup(false);

      await recorder.startRecording();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar';
      toast.error(msg);

      // If session was created but recorder failed, abandon the orphan session
      if (session) {
        setActiveSession(null);
        try {
          await sessionApi.abandonSession(session.id);
          await clearSession(session.id);
        } catch (cleanupErr) {
          console.error('[Recording] Erro ao limpar sessao orfã:', cleanupErr);
        }
      }
    }
  }, [title, folderId, clientId, sessionApi, recorder]);

  const cancelRecording = useCallback(async () => {
    try {
      recorder.cancelRecording();
    } catch (err) {
      console.error('[Recording] Erro ao cancelar recorder:', err);
    }

    if (activeSession) {
      try {
        await sessionApi.abandonSession(activeSession.id);
      } catch (err) {
        console.error('[Recording] Erro ao abandonar sessao:', err);
      }
      try {
        await clearSession(activeSession.id);
      } catch (err) {
        console.error('[Recording] Erro ao limpar sessao do IDB:', err);
      }
    }

    // Always reset state, even if cleanup failed
    setActiveSession(null);
    setPipelineState('idle');
    setPipelineError(null);
    setShowSetup(false);
    stoppingRef.current = false;
  }, [recorder, activeSession, sessionApi]);

  const dismiss = useCallback(() => {
    setActiveSession(null);
    setPipelineState('idle');
    setPipelineError(null);
    setTitle('');
    setFolderId('');
    setClientId(null);
    stoppingRef.current = false;
  }, []);

  return {
    // Data queries
    folders,
    clients,
    clientsLoading,

    // State
    overlayState,
    activeSession,
    pipelineError,

    // Form
    title,
    setTitle,
    folderId,
    setFolderId,
    clientId,
    setClientId,
    showSetup,

    // Network + limits
    isOffline,
    isApproachingLimit,
    remainingSeconds,

    // Recording metrics
    durationSeconds: recorder.durationSeconds,
    pendingChunkCount: chunkUploader.pendingCount,
    assemblyStage: assembly.stage,
    assemblyError: assembly.error,
    recorderError: recorder.error,

    // Recovery
    recoverableSessions: recovery.recoverableSessions,
    abandonRecovery: recovery.abandonSession,
    dismissRecovery: recovery.dismissSession,

    // Actions
    openSetup,
    closeSetup,
    startRecording,
    stopRecording: handleStop,
    pauseRecording: recorder.pauseRecording,
    resumeRecording: recorder.resumeRecording,
    cancelRecording,
    dismiss,
  };
}
