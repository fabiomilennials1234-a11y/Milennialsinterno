import { useActiveTimer } from '../hooks/useActiveTimer';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function StatusLine() {
  const { activeTaskId, elapsed } = useActiveTimer();

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
            Timer ativo
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
          <kbd className="px-1 py-0.5 rounded text-[10px] border border-[var(--mtech-border)]">⌘K</kbd>
          {' '}Comandos
        </span>
      </div>
    </div>
  );
}
