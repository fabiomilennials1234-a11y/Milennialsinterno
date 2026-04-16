import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square } from 'lucide-react';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { useTechTimer } from '../hooks/useTechTimer';
import { useTechTimeTotals } from '../hooks/useTechTimeTotals';

interface TimerButtonProps {
  taskId: string;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerButton({ taskId }: TimerButtonProps) {
  const { activeTaskId, elapsed } = useActiveTimer();
  const { start, pause, stop } = useTechTimer();
  const { data: timeTotals = {} } = useTechTimeTotals();

  const isThisActive = activeTaskId === taskId;
  const anotherActive = activeTaskId != null && activeTaskId !== taskId;
  const accumulatedSeconds = timeTotals[taskId] ?? 0;

  const handleToggle = useCallback(() => {
    if (isThisActive) {
      pause.mutate(taskId);
    } else {
      start.mutate(taskId);
    }
  }, [isThisActive, taskId, pause, start]);

  const handleStop = useCallback(() => {
    stop.mutate(taskId);
  }, [taskId, stop]);

  const isPending = start.isPending || pause.isPending || stop.isPending;

  // When active: show accumulated + current session elapsed
  // When inactive: show accumulated total
  const displaySeconds = isThisActive
    ? accumulatedSeconds + elapsed
    : accumulatedSeconds;

  const display = formatTimer(displaySeconds);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={isPending || (anotherActive && !isThisActive)}
        onClick={handleToggle}
        title={anotherActive ? 'Pare o timer da outra task primeiro' : undefined}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-[var(--mtech-radius-sm)] text-xs font-medium transition-colors border border-[var(--mtech-border)] bg-[var(--mtech-surface)] hover:border-[var(--mtech-border-strong)] disabled:opacity-40"
      >
        {isThisActive ? (
          <>
            <Pause className="h-3 w-3 text-[var(--mtech-accent)]" />
            <motion.span
              data-mono
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[var(--mtech-accent)]"
            >
              {display}
            </motion.span>
          </>
        ) : (
          <>
            <Play className="h-3 w-3 text-[var(--mtech-text-muted)]" />
            <span data-mono className={accumulatedSeconds > 0 ? 'text-[var(--mtech-text)]' : 'text-[var(--mtech-text-muted)]'}>
              {display}
            </span>
          </>
        )}
      </button>

      {isThisActive && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleStop}
          className="inline-flex items-center justify-center h-7 w-7 rounded-[var(--mtech-radius-sm)] text-xs border border-[var(--mtech-border)] bg-[var(--mtech-surface)] hover:border-[var(--mtech-danger)] transition-colors disabled:opacity-40"
          aria-label="Parar timer"
        >
          <Square className="h-3 w-3 text-[var(--mtech-danger)]" />
        </button>
      )}
    </span>
  );
}
