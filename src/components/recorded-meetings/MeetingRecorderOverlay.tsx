import { createPortal } from 'react-dom';
import { useRecordingOrchestrator } from '@/hooks/useRecordingOrchestrator';
import RecordingRecoveryBanner from './RecordingRecoveryBanner';
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function getAssemblyLabel(stage: string): string {
  switch (stage) {
    case 'fetching': return 'Baixando chunks...';
    case 'assembling': return 'Montando gravacao...';
    case 'uploading-video': return 'Enviando video...';
    case 'uploading-audio': return 'Enviando audio...';
    case 'finalizing': return 'Finalizando...';
    default: return 'Processando...';
  }
}

export default function MeetingRecorderOverlay() {
  const state = useRecordingOrchestrator();

  const {
    folders,
    clients,
    clientsLoading,
    overlayState,
    pipelineError,
    title,
    setTitle,
    folderId,
    setFolderId,
    clientId,
    setClientId,
    showSetup,
    isOffline,
    isApproachingLimit,
    remainingSeconds,
    durationSeconds,
    pendingChunkCount,
    assemblyStage,
    assemblyError,
    recorderError,
    recoverableSessions,
    abandonRecovery,
    dismissRecovery,
    openSetup,
    closeSetup,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    dismiss,
  } = state;

  const showFab = overlayState === 'idle' && !showSetup;
  const showRecordingBar = overlayState === 'recording' || overlayState === 'paused';
  const showProcessing = overlayState === 'processing';
  const showDone = overlayState === 'done';
  const showError = overlayState === 'error';

  return createPortal(
    <>
      {/* Recovery Banner */}
      <RecordingRecoveryBanner
        sessions={recoverableSessions}
        onAbandon={abandonRecovery}
        onDismiss={dismissRecovery}
      />

      {/* Top Recording Strip */}
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
              <span>Salvando gravacao...</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full bg-white ${
                overlayState === 'recording' ? 'animate-pulse' : ''
              }`} />
              <span>{overlayState === 'paused' ? 'PAUSADO' : 'GRAVANDO'}</span>
              <span className="tabular-nums">{formatDuration(durationSeconds)}</span>
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
          onClick={openSetup}
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
              <Button variant="ghost" size="icon" onClick={closeSetup} className="h-8 w-8">
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
                      startRecording();
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
              <Button variant="outline" onClick={closeSetup}>
                Cancelar
              </Button>
              <Button
                onClick={startRecording}
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
              {formatDuration(durationSeconds)}
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
            {pendingChunkCount > 0
              ? `${pendingChunkCount} pendente${pendingChunkCount > 1 ? 's' : ''}`
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
                onClick={pauseRecording}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Pausar"
              >
                <Pause size={16} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={resumeRecording}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Retomar"
              >
                <Play size={16} />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={stopRecording}
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              title="Parar e salvar"
            >
              <Square size={16} fill="currentColor" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={cancelRecording}
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
          <p className="text-sm font-medium text-foreground">{getAssemblyLabel(assemblyStage)}</p>
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
            onClick={dismiss}
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
            {pipelineError || assemblyError || recorderError || 'Erro desconhecido'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
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
