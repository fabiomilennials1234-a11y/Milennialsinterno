import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/** Maximum recording duration: 2 hours */
export const MAX_RECORDING_SECONDS = 2 * 60 * 60; // 7200
/** Warning threshold: 5 minutes before limit */
export const WARNING_THRESHOLD_SECONDS = MAX_RECORDING_SECONDS - 5 * 60; // 6900

interface UseRecordingLimitsReturn {
  isApproachingLimit: boolean;
  remainingSeconds: number;
  shouldAutoStop: boolean;
}

/**
 * Tracks recording duration against 2h limit.
 * Fires a warning toast at 1h55 and signals auto-stop at 2h.
 *
 * @param durationSeconds - Current recording duration in seconds.
 * @param isActive - Whether the recording is active (recording or paused).
 */
export function useRecordingLimits(
  durationSeconds: number,
  isActive: boolean,
): UseRecordingLimitsReturn {
  const warningShownRef = useRef(false);
  const autoStopTriggeredRef = useRef(false);
  const [shouldAutoStop, setShouldAutoStop] = useState(false);

  // Reset flags when recording stops
  useEffect(() => {
    if (!isActive) {
      warningShownRef.current = false;
      autoStopTriggeredRef.current = false;
      setShouldAutoStop(false);
    }
  }, [isActive]);

  // Warning + auto-stop triggers
  useEffect(() => {
    if (!isActive) return;

    // Warning at 5min remaining
    if (durationSeconds >= WARNING_THRESHOLD_SECONDS && !warningShownRef.current) {
      warningShownRef.current = true;
      toast.warning('Gravacao se aproximando do limite de 2 horas. Restam 5 minutos.', {
        duration: 10000,
      });
    }

    // Auto-stop at limit
    if (durationSeconds >= MAX_RECORDING_SECONDS && !autoStopTriggeredRef.current) {
      autoStopTriggeredRef.current = true;
      toast.error('Limite de 2 horas atingido. Gravacao sendo salva automaticamente.', {
        duration: 8000,
      });
      setShouldAutoStop(true);
    }
  }, [durationSeconds, isActive]);

  const isApproachingLimit = isActive && durationSeconds >= WARNING_THRESHOLD_SECONDS;
  const remainingSeconds = Math.max(0, MAX_RECORDING_SECONDS - durationSeconds);

  return { isApproachingLimit, remainingSeconds, shouldAutoStop };
}
