import { Button } from '@/components/ui/button';
import { Pause, Play, Square, X, Clock, WifiOff } from 'lucide-react';
import { formatDuration } from './recordingUtils';
import type { OverlayState } from '@/hooks/useRecordingOrchestrator';

export interface RecordingControlBarProps {
  overlayState: OverlayState;
  durationSeconds: number;
  title: string;
  pendingChunkCount: number;
  isOffline: boolean;
  isApproachingLimit: boolean;
  remainingSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

export function RecordingControlBar({
  overlayState,
  durationSeconds,
  title,
  pendingChunkCount,
  isOffline,
  isApproachingLimit,
  remainingSeconds,
  onPause,
  onResume,
  onStop,
  onCancel,
}: RecordingControlBarProps) {
  return (
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
            onClick={onPause}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Pausar"
          >
            <Pause size={16} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onResume}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Retomar"
          >
            <Play size={16} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
          title="Parar e salvar"
        >
          <Square size={16} fill="currentColor" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Cancelar gravacao"
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}
