import { useMemo } from 'react';
import { MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useJustificativasTeam, type TeamItem } from '@/hooks/useJustificativas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TechTeamJustifications() {
  // Filter to tech_tasks only via the RPC parameter
  const { data: items = [], isLoading } = useJustificativasTeam(false, ['tech_tasks']);

  // Exclude archived items for the main view
  const activeItems = useMemo(
    () => items.filter((i) => !i.archived && !i.task_archived),
    [items],
  );

  const pendingCount = useMemo(
    () => activeItems.filter((i) => !i.justification_id).length,
    [activeItems],
  );

  const justifiedCount = useMemo(
    () => activeItems.filter((i) => !!i.justification_id && !i.requires_revision).length,
    [activeItems],
  );

  const revisionCount = useMemo(
    () => activeItems.filter((i) => i.requires_revision).length,
    [activeItems],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--mtech-surface-elev)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        <p className="text-xs text-emerald-400 font-medium">Sem justificativas pendentes</p>
        <p className="text-[10px] text-[var(--mtech-text-subtle)]">Time tech em dia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold bg-[var(--mtech-danger)]/10 text-[var(--mtech-danger)]">
            <AlertTriangle className="h-2.5 w-2.5" />
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
        {justifiedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {justifiedCount} justificada{justifiedCount !== 1 ? 's' : ''}
          </span>
        )}
        {revisionCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 text-amber-400">
            <MessageSquare className="h-2.5 w-2.5" />
            {revisionCount} em revisao
          </span>
        )}
      </div>

      {/* Items */}
      {activeItems.map((item) => (
        <JustificationCard key={item.notification_id} item={item} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card subcomponent
// ---------------------------------------------------------------------------

function JustificationCard({ item }: { item: TeamItem }) {
  const isPending = !item.justification_id;
  const isRevision = item.requires_revision;

  const statusColor = isPending
    ? 'var(--mtech-danger)'
    : isRevision
      ? '#f59e0b'
      : 'var(--mtech-success)';

  const statusLabel = isPending ? 'Pendente' : isRevision ? 'Revisao' : 'Justificado';

  return (
    <div
      className="rounded-lg border bg-[var(--mtech-surface)] p-2.5 transition-colors"
      style={{ borderColor: `${statusColor}33` }}
    >
      {/* Title + status */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[11px] font-medium text-[var(--mtech-text)] truncate flex-1">
          {item.task_title}
        </p>
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider whitespace-nowrap select-none"
          style={{ color: statusColor, backgroundColor: `${statusColor}1a` }}
        >
          {statusLabel}
        </span>
      </div>

      {/* User + date */}
      <div className="flex items-center gap-2 text-[10px] text-[var(--mtech-text-subtle)]">
        <span className="truncate max-w-[100px]">{item.user_name}</span>
        <span className="opacity-40">|</span>
        <span>
          {format(new Date(item.task_due_date), "dd MMM", { locale: ptBR })}
        </span>
      </div>

      {/* Justification text if present */}
      {item.justification_text && (
        <p className="mt-1.5 text-[10px] text-[var(--mtech-text-muted)] line-clamp-2 italic">
          "{item.justification_text}"
        </p>
      )}

      {/* Master comment if present */}
      {item.master_comment && (
        <p className="mt-1 text-[10px] text-amber-400/80 line-clamp-2">
          Comentario: {item.master_comment}
        </p>
      )}
    </div>
  );
}
