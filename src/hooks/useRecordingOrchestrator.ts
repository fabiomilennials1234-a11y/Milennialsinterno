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
import { useRecordingHealth, RecordingHealth } from '@/hooks/useRecordingHealth';
import { supabase } from '@/integrations/supabase/client';
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
  /** true when in error state with a live session whose assembly can be re-run */
  canRetry: boolean;

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

  // Health
  health: RecordingHealth;

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
  /** re-run the failed assembly/upload of the live session that errored */
  retryPipeline: () => Promise<void>;
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
  // Captured at first chunk — the recorder's MIME state is cleared by cleanup()
  // during stop, before assembly reads it. Refs survive that teardown.
  const videoMimeRef = useRef<string | null>(null);
  const audioMimeRef = useRef<string | null>(null);
  // Last known recording duration — captured at stop so a retry can re-run
  // assembly without re-deriving it from the (already torn-down) recorder.
  const durationSecondsRef = useRef(0);

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

  // ── Shared post-stop pipeline: drain → persist progress → stop session →
  //    assemble → clear → invalidate. The single source of the finalize logic,
  //    reused by manual stop, browser auto-stop, and the live-session retry.
  //    `skipServerStop` is true on retry (the session is already stopped server-side). ──
  const runAssemblyPipeline = useCallback(async (
    session: RecordingSession,
    durationSeconds: number,
    options?: { skipServerStop?: boolean },
  ) => {
    setPipelineState('processing');
    setPipelineError(null);

    try {
      await chunkUploader.drainQueue();

      await sessionApi.updateChunkProgress(
        session.id,
        videoCountRef.current + audioCountRef.current,
        totalBytesRef.current,
      );

      if (!options?.skipServerStop) {
        await sessionApi.stopSession(session.id, durationSeconds);
      }

      await assembly.assemble({
        sessionId: session.id,
        storagePrefix: session.storage_prefix,
        videoChunkCount: videoCountRef.current,
        audioChunkCount: audioCountRef.current,
        durationSeconds,
        title: titleRef.current.trim(),
        folderId: folderIdRef.current,
        clientId: clientIdRef.current,
        videoMimeType: videoMimeRef.current,
        audioMimeType: audioMimeRef.current,
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

      try {
        await sessionApi.markFailed(session.id, msg);
      } catch (markErr) {
        console.error('[Recording] Erro ao marcar sessao como falha:', markErr);
      }
    }
  }, [chunkUploader, sessionApi, assembly, queryClient]);

  // ── Auto-stop handler (browser "Stop sharing") ──
  const handleAutoStop = useCallback(async (durationSeconds: number) => {
    const session = activeSessionRef.current;
    if (!session) return;
    durationSecondsRef.current = durationSeconds;
    await runAssemblyPipeline(session, durationSeconds);
  }, [runAssemblyPipeline]);

  // ── Recorder (depends on chunk + autoStop callbacks — declared AFTER them to avoid TDZ) ──
  const recorder = useMeetingRecorder({
    onAutoStop: handleAutoStop,
    onVideoChunk: handleVideoChunk,
    onAudioChunk: handleAudioChunk,
  });

  // Capture recorder MIME while it is non-null (set on start, cleared on stop).
  // Assembly runs after stop, so it reads these refs, not the live recorder state.
  if (recorder.videoMimeType) videoMimeRef.current = recorder.videoMimeType;
  if (recorder.audioMimeType) audioMimeRef.current = recorder.audioMimeType;

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

  // ── Health monitoring ──
  const health = useRecordingHealth({
    videoRecorderState: recorder.videoRecorderState,
    audioRecorderState: recorder.audioRecorderState,
    videoTrackReadyState: recorder.videoTrackReadyState,
    isOffline,
    consecutiveFailures: chunkUploader.consecutiveFailures,
    pendingChunkCount: chunkUploader.pendingCount,
    isActive,
    supabaseClient: supabase,
  });

  // ── handleStop — declared BEFORE the useEffect that references it ──
  const handleStop = useCallback(async () => {
    if (!activeSession || stoppingRef.current) return;
    stoppingRef.current = true;

    try {
      const durationSeconds = await recorder.stopRecording();
      durationSecondsRef.current = durationSeconds;
      await runAssemblyPipeline(activeSession, durationSeconds);
    } finally {
      stoppingRef.current = false;
    }
  }, [activeSession, recorder, runAssemblyPipeline]);

  // ── Retry the failed pipeline for the SAME live session. The session was
  //    already stopped server-side before assembly ran, so we skip stopSession
  //    and re-run only the upload/finalize work. ──
  const retryPipeline = useCallback(async () => {
    if (pipelineState !== 'error' || !activeSession || stoppingRef.current) return;
    stoppingRef.current = true;

    try {
      await runAssemblyPipeline(activeSession, durationSecondsRef.current, { skipServerStop: true });
    } finally {
      stoppingRef.current = false;
    }
  }, [pipelineState, activeSession, runAssemblyPipeline]);

  // ── Auto-stop when 2h limit reached ──
  useEffect(() => {
    if (shouldAutoStop) {
      handleStop();
    }
  }, [shouldAutoStop, handleStop]);

  // ── Health reactions ──

  // Recorder critical → auto-stop
  useEffect(() => {
    if (health.checks.recorder.status === 'critical' && (overlayState === 'recording' || overlayState === 'paused')) {
      toast.error('Gravacao parou inesperadamente. Salvando dados capturados...', { duration: 8000 });
      handleStop();
    }
  }, [health.checks.recorder.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth warning → proactive refresh
  useEffect(() => {
    if (health.checks.auth.status === 'warning' && isActive) {
      supabase.auth.refreshSession().then(({ error }) => {
        if (error) {
          console.error('[Recording] Token refresh failed:', error);
        }
      });
    }
  }, [health.checks.auth.status, isActive]);

  // Auth critical → aggressive alert + retry
  useEffect(() => {
    if (health.checks.auth.status === 'critical' && isActive) {
      supabase.auth.refreshSession().then(({ error }) => {
        if (error) {
          toast.error('Sessao expirada. Salve a gravacao agora para nao perder dados.', {
            duration: Infinity,
            id: 'auth-critical',
          });
        }
      });
    }
  }, [health.checks.auth.status, isActive]);

  // Upload critical → pause + backoff
  useEffect(() => {
    if (health.checks.upload.status === 'critical' && isActive) {
      toast.warning('Uploads com falha consecutiva. Pausando por 30s...', { duration: 8000 });
      chunkUploader.pauseUploads(30_000);
    }
  }, [health.checks.upload.status, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Storage critical → warn user
  useEffect(() => {
    if (health.checks.storage.status === 'critical' && isActive) {
      toast.warning('Espaco de armazenamento quase esgotado. Gravacao pode falhar.', { duration: 10000 });
    }
  }, [health.checks.storage.status, isActive]);

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
      videoMimeRef.current = null;
      audioMimeRef.current = null;
      chunkUploader.resetFailures();

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
  }, [title, folderId, clientId, sessionApi, recorder, chunkUploader]);

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
    canRetry: pipelineState === 'error' && activeSession !== null,

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

    // Health
    health,

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
    retryPipeline,
    dismiss,
  };
}
