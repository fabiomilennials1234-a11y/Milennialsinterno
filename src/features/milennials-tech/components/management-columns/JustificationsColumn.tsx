import { useMemo } from 'react';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ManagementColumn } from '../ManagementColumn';
import { useJustificativasTeam, type TeamItem } from '@/hooks/useJustificativas';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JustificationsColumn() {
  const { data: items = [], isLoading } = useJustificativasTeam(false, ['tech_tasks']);

  const activeItems = useMemo(
    () => items.filter((i) => !i.archived && !i.task_archived),
    [items],
  );

  const pendingCount = activeItems.filter((i) => !i.justification_id).length;

  return (
    <ManagementColumn
      title="Justificativas"
      icon={ClipboardList}
      count={pendingCount}
    >
      {isLoading &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 rounded-[var(--mtech-radius-md)] bg-[var(--mtech-surface-elev)] animate-pulse"
          />
        ))}

      {!isLoading && activeItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-1.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <p className="text-[10px] text-emerald-400 font-medium">Sem justificativas</p>
        </div>
      )}

      {!isLoading &&
        activeItems.map((item) => (
          <JustificationCard key={item.notification_id} item={item} />
        ))}
    </ManagementColumn>
  );
}

// ---------------------------------------------------------------------------
// Card
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
      className="rounded-[var(--mtech-radius-md)] border bg-[var(--mtech-surface)] p-2.5 space-y-1 transition-colors"
      style={{ borderColor: `${statusColor}33` }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[11px] font-medium text-[var(--mtech-text)] truncate flex-1 leading-tight">
          {item.task_title}
        </p>
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider whitespace-nowrap select-none flex-shrink-0"
          style={{ color: statusColor, backgroundColor: `${statusColor}1a` }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-[var(--mtech-text-subtle)]">
        <span className="truncate max-w-[100px]">{item.user_name}</span>
        <span className="opacity-40">|</span>
        <span>{format(new Date(item.task_due_date), 'dd MMM', { locale: ptBR })}</span>
      </div>
      {item.justification_text && (
        <p className="text-[9px] text-[var(--mtech-text-muted)] line-clamp-2 italic">
          "{item.justification_text}"
        </p>
      )}
    </div>
  );
}
