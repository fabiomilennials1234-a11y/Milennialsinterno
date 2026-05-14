import { Loader2, WifiOff } from 'lucide-react';
import { formatDuration } from './recordingUtils';
import type { OverlayState } from '@/hooks/useRecordingOrchestrator';

export interface RecordingTopStripProps {
  overlayState: OverlayState;
  isProcessing: boolean;
  isOffline: boolean;
  isApproachingLimit: boolean;
  remainingSeconds: number;
  durationSeconds: number;
}

export function RecordingTopStrip({
  overlayState,
  isProcessing,
  isOffline,
  isApproachingLimit,
  remainingSeconds,
  durationSeconds,
}: RecordingTopStripProps) {
  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 h-9 text-white text-sm font-medium select-none transition-colors ${
      isProcessing
        ? 'bg-blue-600'
        : overlayState === 'paused'
          ? 'bg-yellow-600'
          : isOffline
            ? 'bg-orange-600'
            : 'bg-red-600'
    }`}>
      {isProcessing ? (
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
  );
}
