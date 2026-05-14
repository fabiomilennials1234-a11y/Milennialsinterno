import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMeetingRecorder } from '@/hooks/useMeetingRecorder';
import { useChunkUploader } from '@/hooks/useChunkUploader';
import { useRecordingSession, RecordingSession } from '@/hooks/useRecordingSession';
import { useRecordingAssembly } from '@/hooks/useRecordingAssembly';
import { useRecordingRecovery } from '@/hooks/useRecordingRecovery';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRecordingLimits, MAX_RECORDING_SECONDS } from '@/hooks/useRecordingLimits';
import RecordingRecoveryBanner from './RecordingRecoveryBanner';
import { useRecordedMeetings } from '@/hooks/useRecordedMeetings';
import { useAllActiveClients } from '@/hooks/useAllActiveClients';
import { ClientCombobox } from '@/components/ui/client-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  Square,
  Pause,
  Play,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MonitorUp,
  Clock,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { clearSession } from '@/lib/recordingIDB';

type OverlayState = 'idle' | 'setup' | 'recording' | 'paused' | 'processing' | 'done' | 'error';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function MeetingRecorderOverlay() {
  const { folders } = useRecordedMeetings();
  const { data: clients = [], isLoading: clientsLoading } = useAllActiveClients();
  const queryClient = useQueryClient();

  // Setup form state
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // Pipeline state
  const [activeSession, setActiveSession] = useState<RecordingSession | null>(null);
  const [pipelineState, setPipelineState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Track chunk counts via refs for stable callback references
  const videoCountRef = useRef(0);
  const audioCountRef = useRef(0);
  const totalBytesRef = useRef(0);
  const activeSessionRef = useRef<RecordingSession | null>(null);
  activeSessionRef.current = activeSession;
  const stoppingRef = useRef(false);

  // Hooks
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

  // Debounced DB update for chunk progress (avoid hammering DB every second)
  const lastProgressUpdateRef = useRef(0);
  const progressUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleProgressUpdate = useCallback(() => {
    if (progressUpdateTimerRef.current) return; // already scheduled

    progressUpdateTimerRef.current = setTimeout(() => {
      progressUpdateTimerRef.current = null;
      const session = activeSessionRef.current;
      if (session) {
        sessionApi.updateChunkProgress(
          session.id,
          videoCountRef.current + audioCountRef.current,
          totalBytesRef.current,
        );
        lastProgressUpdateRef.current = Date.now();
      }
    }, 5000); // update DB every 5 seconds
  }, [sessionApi]);

  // Chunk callbacks
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

  // Auto-stop handler (browser "Stop sharing")
  const handleAutoStop = useCallback(async (durationSeconds: number) => {
    const session = activeSessionRef.current;
    if (!session) return;

    setPipelineState('processing');

    try {
      // Drain remaining uploads
      await chunkUploader.drainQueue();

      // Flush final progress to DB
      await sessionApi.updateChunkProgress(
        session.id,
        videoCountRef.current + audioCountRef.current,
        totalBytesRef.current,
      );

      await sessionApi.stopSession(session.id, durationSeconds);

      // Assemble
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
        await sessionApi.markFailed(session.id, msg);
      }
    }
  }, [chunkUploader, sessionApi, assembly, queryClient]);

  const recorder = useMeetingRecorder({
    onAutoStop: handleAutoStop,
    onVideoChunk: handleVideoChunk,
    onAudioChunk: handleAudioChunk,
  });

  const overlayState: OverlayState = (() => {
    if (pipelineState === 'processing') return 'processing';
    if (pipelineState === 'done') return 'done';
    if (pipelineState === 'error') return 'error';
    if (recorder.status === 'recording') return 'recording';
    if (recorder.status === 'paused') return 'paused';
    return 'idle';
  })();

  // Extracted hooks — network + 2h limit
  const isActive = overlayState === 'recording' || overlayState === 'paused';
  const { isOffline } = useNetworkStatus(isActive);
  const { isApproachingLimit, remainingSeconds, shouldAutoStop } = useRecordingLimits(recorder.durationSeconds, isActive);

  // Prevent page close during recording or processing
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

  // Cleanup progress timer on unmount
  useEffect(() => {
    return () => {
      if (progressUpdateTimerRef.current) {
        clearTimeout(progressUpdateTimerRef.current);
      }
    };
  }, []);

  const handleOpenSetup = useCallback(() => {
    if (!recorder.isSupported) {
      toast.error('Seu navegador nao suporta gravacao de tela');
      return;
    }
    setTitle('');
    setFolderId('');
    setClientId(null);
    setShowSetup(true);
  }, [recorder.isSupported]);

  const handleStartRecording = useCallback(async () => {
    if (!title.trim()) {
      toast.error('Titulo e obrigatorio');
      return;
    }
    if (!folderId) {
      toast.error('Selecione uma pasta');
      return;
    }

    try {
      // Create session in DB first
      const session = await sessionApi.createSession({
        title: title.trim(),
        folderId,
        clientId,
      });

      // Reset counters
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
    }
  }, [title, folderId, clientId, sessionApi, recorder]);

  const handleStop = useCallback(async () => {
    if (!activeSession || stoppingRef.current) return;
    stoppingRef.current = true;

    setPipelineState('processing');

    try {
      const durationSeconds = await recorder.stopRecording();

      // Drain remaining chunk uploads
      await chunkUploader.drainQueue();

      // Flush final progress
      await sessionApi.updateChunkProgress(
        activeSession.id,
        videoCountRef.current + audioCountRef.current,
        totalBytesRef.current,
      );

      await sessionApi.stopSession(activeSession.id, durationSeconds);

      // Assemble
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
        await sessionApi.markFailed(activeSession.id, msg);
      }
    } finally {
      stoppingRef.current = false;
    }
  }, [activeSession, recorder, chunkUploader, sessionApi, assembly, queryClient]);

  // Auto-stop when 2h limit reached (signaled by useRecordingLimits)
  useEffect(() => {
    if (shouldAutoStop) {
      handleStop();
    }
  }, [shouldAutoStop, handleStop]);

  const handleCancel = useCallback(async () => {
    recorder.cancelRecording();

    if (activeSession) {
      await sessionApi.abandonSession(activeSession.id);
      await clearSession(activeSession.id);
    }

    setActiveSession(null);
    setPipelineState('idle');
    setPipelineError(null);
    setShowSetup(false);
    stoppingRef.current = false;
  }, [recorder, activeSession, sessionApi]);

  const handleDismiss = useCallback(() => {
    setActiveSession(null);
    setPipelineState('idle');
    setPipelineError(null);
    setTitle('');
    setFolderId('');
    setClientId(null);
    stoppingRef.current = false;
  }, []);

  // Computed visibility
  const showFab = overlayState === 'idle' && !showSetup;
  const showRecordingBar = overlayState === 'recording' || overlayState === 'paused';
  const showProcessing = overlayState === 'processing';
  const showDone = overlayState === 'done';
  const showError = overlayState === 'error';

  const assemblyLabel = (() => {
    switch (assembly.stage) {
      case 'fetching': return 'Baixando chunks...';
      case 'assembling': return 'Montando gravacao...';
      case 'uploading-video': return 'Enviando video...';
      case 'uploading-audio': return 'Enviando audio...';
      case 'finalizing': return 'Finalizando...';
      default: return 'Processando...';
    }
  })();

  return createPortal(
    <>
      {/* Recovery Banner */}
      <RecordingRecoveryBanner
        sessions={recovery.recoverableSessions}
        onAbandon={recovery.abandonSession}
        onDismiss={recovery.dismissSession}
      />

      {/* Top Recording Strip — always visible, impossible to miss */}
      {(showRecordingBar || showProcessing) && (
        <div className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 h-9 text-white text-sm font-medium select-none transition-colors ${
          showProcessing
            ? 'bg-blue-600'
            : overlayState === 'paused'
              ? 'bg-yellow-600'
              : isOffline
                ? 'bg-orange-600'
                : 'bg-red-600'
        }`}>
          {showProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Salvando gravação...</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full bg-white ${
                overlayState === 'recording' ? 'animate-pulse' : ''
              }`} />
              <span>{overlayState === 'paused' ? 'PAUSADO' : 'GRAVANDO'}</span>
              <span className="tabular-nums">{formatDuration(recorder.durationSeconds)}</span>
              {isOffline && (
                <div className="flex items-center gap-1 text-white/90">
                  <WifiOff size={14} />
                  <span className="text-xs">Sem rede</span>
                </div>
              )}
              {isApproachingLimit && (
                <span className="text-xs text-white/80 tabular-nums">
                  ({formatDuration(remainingSeconds)} restantes)
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      {showFab && (
        <button
          onClick={handleOpenSetup}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 transition-all hover:shadow-xl hover:shadow-red-600/30 hover:scale-105 active:scale-95 group"
          title="Gravar Reuniao"
        >
          <Video size={20} className="shrink-0" />
          <span className="text-sm font-medium hidden sm:inline">Gravar Reuniao</span>
        </button>
      )}

      {/* Setup Mini-Modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
                  <MonitorUp size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Gravar Reuniao</h3>
                  <p className="text-xs text-muted-foreground">Capture tela e audio do sistema</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowSetup(false)} className="h-8 w-8">
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Titulo <span className="text-destructive">*</span>
                </Label>
                <Input
                  autoFocus
                  placeholder="Ex: Reuniao semanal de equipe"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && title.trim() && folderId) {
                      handleStartRecording();
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  Pasta <span className="text-destructive">*</span>
                </Label>
                <Select value={folderId} onValueChange={setFolderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar pasta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {folders.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Crie uma pasta em "Reunioes Gravadas" primeiro.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Cliente (opcional)</Label>
                <ClientCombobox
                  value={clientId}
                  onChange={(id) => setClientId(id)}
                  clients={clients}
                  isLoading={clientsLoading}
                  placeholder="Selecionar cliente..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowSetup(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleStartRecording}
                disabled={!title.trim() || !folderId}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Video size={16} className="mr-2" />
                Iniciar Gravacao
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Bar */}
      {showRecordingBar && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl bg-card border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 ${
          isApproachingLimit ? 'border-amber-500/50' : 'border-border'
        }`}>
          {/* Recording indicator */}
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${
              overlayState === 'recording'
                ? 'bg-red-500 animate-pulse'
                : 'bg-yellow-500'
            }`} />
            <span className={`text-sm font-medium tabular-nums min-w-[48px] ${
              isApproachingLimit ? 'text-amber-500' : 'text-foreground'
            }`}>
              {formatDuration(recorder.durationSeconds)}
            </span>
          </div>

          {/* Approaching limit warning */}
          {isApproachingLimit && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <Clock size={14} className="shrink-0" />
              <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                {formatDuration(remainingSeconds)} restantes
              </span>
            </div>
          )}

          {/* Title */}
          <span className="text-sm text-muted-foreground max-w-[200px] truncate hidden sm:block">
            {title}
          </span>

          {/* Chunk indicator */}
          <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
            {chunkUploader.pendingCount > 0
              ? `${chunkUploader.pendingCount} pendente${chunkUploader.pendingCount > 1 ? 's' : ''}`
              : ''}
          </span>

          {/* Network status */}
          {isOffline && (
            <div className="flex items-center gap-1.5 text-orange-500">
              <WifiOff size={14} className="shrink-0 animate-pulse" />
              <span className="text-xs font-medium hidden sm:inline">Sem rede</span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-border" />

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            {overlayState === 'recording' ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={recorder.pauseRecording}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Pausar"
              >
                <Pause size={16} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={recorder.resumeRecording}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Retomar"
              >
                <Play size={16} />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              title="Parar e salvar"
            >
              <Square size={16} fill="currentColor" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Cancelar gravacao"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Processing (assembly + upload) */}
      {showProcessing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl bg-card border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 min-w-[280px]">
          <Loader2 size={18} className="text-primary animate-spin shrink-0" />
          <p className="text-sm font-medium text-foreground">{assemblyLabel}</p>
        </div>
      )}

      {/* Done */}
      {showDone && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-emerald-500/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-foreground">Gravacao salva!</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-7 text-xs"
          >
            Fechar
          </Button>
        </div>
      )}

      {/* Error */}
      {showError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-destructive/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
          <AlertCircle size={18} className="text-destructive shrink-0" />
          <span className="text-sm text-foreground flex-1 truncate">
            {pipelineError || assembly.error || recorder.error || 'Erro desconhecido'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-7 text-xs shrink-0"
          >
            Fechar
          </Button>
        </div>
      )}
    </>,
    document.body,
  );
}
