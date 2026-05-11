import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMeetingRecorder, RecorderStatus } from '@/hooks/useMeetingRecorder';
import { useUploadMeetingRecording } from '@/hooks/useUploadMeetingRecording';
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
} from 'lucide-react';
import { toast } from 'sonner';

type OverlayState = 'idle' | 'setup' | 'recording' | 'paused' | 'uploading' | 'done' | 'error';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MeetingRecorderOverlay() {
  const recorder = useMeetingRecorder();
  const uploader = useUploadMeetingRecording();
  const { folders } = useRecordedMeetings();
  const { data: clients = [], isLoading: clientsLoading } = useAllActiveClients();

  // Setup form state
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);

  const overlayState: OverlayState = (() => {
    if (uploader.status === 'uploading') return 'uploading';
    if (uploader.status === 'done') return 'done';
    if (uploader.status === 'error') return 'error';
    if (recorder.status === 'recording') return 'recording';
    if (recorder.status === 'paused') return 'paused';
    return 'idle';
  })();

  const [showSetup, setShowSetup] = useState(false);

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
    setShowSetup(false);
    await recorder.startRecording();
  }, [title, folderId, recorder]);

  const handleStop = useCallback(async () => {
    try {
      const result = await recorder.stopRecording();

      await uploader.upload(result.videoBlob, result.audioBlob, {
        title: title.trim(),
        folderId,
        clientId,
        durationSeconds: result.durationSeconds,
        meetingDate: new Date().toISOString().split('T')[0],
        participants: [],
        isWholeTeam: true,
        ata: null,
        summary: null,
      });

      toast.success('Gravacao salva com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao salvar gravacao: ' + msg);
    }
  }, [recorder, uploader, title, folderId, clientId]);

  const handleCancel = useCallback(() => {
    recorder.cancelRecording();
    setShowSetup(false);
  }, [recorder]);

  const handleDismiss = useCallback(() => {
    uploader.reset();
    setTitle('');
    setFolderId('');
    setClientId(null);
  }, [uploader]);

  // FAB — always visible when idle and not in setup
  const showFab = overlayState === 'idle' && !showSetup;

  // Recording bar — visible during recording/paused
  const showRecordingBar = overlayState === 'recording' || overlayState === 'paused';

  // Upload progress — visible during uploading
  const showUploadProgress = overlayState === 'uploading';

  // Done banner
  const showDone = overlayState === 'done';

  // Error banner
  const showError = overlayState === 'error';

  return createPortal(
    <>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl bg-card border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Recording indicator */}
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${
              overlayState === 'recording'
                ? 'bg-red-500 animate-pulse'
                : 'bg-yellow-500'
            }`} />
            <span className="text-sm font-medium text-foreground tabular-nums min-w-[48px]">
              {formatDuration(recorder.durationSeconds)}
            </span>
          </div>

          {/* Title */}
          <span className="text-sm text-muted-foreground max-w-[200px] truncate hidden sm:block">
            {title}
          </span>

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

      {/* Upload Progress */}
      {showUploadProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl bg-card border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 min-w-[280px]">
          <Loader2 size={18} className="text-primary animate-spin shrink-0" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">
              {uploader.progress.stage === 'video' && 'Enviando video...'}
              {uploader.progress.stage === 'audio' && 'Enviando audio...'}
              {uploader.progress.stage === 'saving' && 'Salvando...'}
            </p>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploader.progress.percentage}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {uploader.progress.percentage}%
          </span>
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
            {uploader.error || recorder.error || 'Erro desconhecido'}
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
