import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square } from 'lucide-react';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { useTechTimer } from '../hooks/useTechTimer';

interface TimerButtonProps {
  taskId: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerButton({ taskId }: TimerButtonProps) {
  const { activeTaskId, elapsed } = useActiveTimer();
  const { start, pause, resume, stop } = useTechTimer();

  const isThisActive = activeTaskId === taskId;
  const anotherActive = activeTaskId != null && activeTaskId !== taskId;

  const handleToggle = useCallback(() => {
    if (isThisActive) {
      pause.mutate(taskId);
    } else if (anotherActive) {
      // Another task is running -- start will auto-pause it on the backend
      start.mutate(taskId);
    } else {
      start.mutate(taskId);
    }
  }, [isThisActive, anotherActive, taskId, pause, start]);

  const handleStop = useCallback(() => {
    stop.mutate(taskId);
  }, [taskId, stop]);

  const isPending = start.isPending || pause.isPending || resume.isPending || stop.isPending;

  const display = useMemo(() => formatElapsed(isThisActive ? elapsed : 0), [isThisActive, elapsed]);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleToggle}
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
            <span data-mono className="text-[var(--mtech-text-muted)]">
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
