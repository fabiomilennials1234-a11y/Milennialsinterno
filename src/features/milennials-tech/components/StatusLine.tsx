import { useMemo } from 'react';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { useTechTasks } from '../hooks/useTechTasks';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const cmdKey = isMac ? '⌘' : 'Ctrl+';

export function StatusLine() {
  const { activeTaskId, elapsed } = useActiveTimer();
  const { data: tasks } = useTechTasks();

  const activeTaskTitle = useMemo(() => {
    if (!activeTaskId || !tasks) return null;
    return tasks.find((t) => t.id === activeTaskId)?.title ?? null;
  }, [activeTaskId, tasks]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-8 flex items-center justify-between px-6 text-[11px] border-t z-40"
      style={{
        background: 'var(--mtech-surface)',
        borderColor: 'var(--mtech-border)',
        color: 'var(--mtech-text-muted)',
      }}
    >
      <div className="flex items-center gap-4">
        {activeTaskId ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--mtech-accent)' }}
            />
            <span className="truncate max-w-[300px]" title={activeTaskTitle ?? undefined}>
              {activeTaskTitle ?? 'Timer ativo'}
            </span>
            <span data-mono className="font-medium text-[var(--mtech-text)]">
              {formatElapsed(elapsed)}
            </span>
          </span>
        ) : (
          <span>Nenhum timer ativo</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>
          <kbd className="px-1 py-0.5 rounded text-[10px] border border-[var(--mtech-border)]">{cmdKey}K</kbd>
          {' '}Comandos
        </span>
      </div>
    </div>
  );
}
