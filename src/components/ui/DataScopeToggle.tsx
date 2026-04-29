import { Eye, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageDataScope } from '@/hooks/usePageDataScope';

interface DataScopeToggleProps {
  pageSlug: string;
  className?: string;
}

/**
 * Toggle "Minhas / Todas" para visão de dados de uma página.
 *
 * Renderiza apenas quando o user tem grant à página E não é owner natural.
 * Default: 'mine'. Persistido em localStorage por (userId, pageSlug).
 */
export default function DataScopeToggle({ pageSlug, className }: DataScopeToggleProps) {
  const { scope, setScope, canShowAll } = usePageDataScope(pageSlug);

  if (!canShowAll) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-muted/50 p-0.5 text-xs',
        className,
      )}
      role="radiogroup"
      aria-label="Escopo de dados"
    >
      <button
        type="button"
        role="radio"
        aria-checked={scope === 'mine'}
        onClick={() => setScope('mine')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
          scope === 'mine'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Eye size={12} />
        Minhas
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={scope === 'all'}
        onClick={() => setScope('all')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
          scope === 'all'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Users size={12} />
        Todas
      </button>
    </div>
  );
}
