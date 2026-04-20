import { Flag, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KanbanCard } from '@/hooks/useKanban';

export type KanbanFilter = 'all' | 'urgent' | 'high' | 'overdue';

interface KanbanFiltersProps {
  cards: KanbanCard[];
  value: KanbanFilter;
  onChange: (v: KanbanFilter) => void;
}

function isOverdue(card: KanbanCard): boolean {
  if (!card.due_date) return false;
  const due = new Date(card.due_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

export default function KanbanFilters({ cards, value, onChange }: KanbanFiltersProps) {
  const counts = {
    all: cards.length,
    urgent: cards.filter(c => c.priority === 'urgent').length,
    high: cards.filter(c => c.priority === 'high').length,
    overdue: cards.filter(isOverdue).length,
  };

  const items: Array<{ id: KanbanFilter; label: string; icon?: JSX.Element; tone?: string }> = [
    { id: 'all', label: 'Todas' },
    {
      id: 'urgent',
      label: 'Urgente',
      icon: <Flag size={11} strokeWidth={2.5} fill="currentColor" />,
      tone: 'text-danger',
    },
    {
      id: 'high',
      label: 'Alta',
      icon: <Flag size={11} strokeWidth={2.5} fill="currentColor" />,
      tone: 'text-warning',
    },
    {
      id: 'overdue',
      label: 'Atrasadas',
      icon: <AlertTriangle size={11} strokeWidth={2.5} />,
      tone: 'text-danger',
    },
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border/60">
      {items.map(item => {
        const active = value === item.id;
        const count = counts[item.id];
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {item.icon && (
              <span className={cn(!active && item.tone)}>{item.icon}</span>
            )}
            <span>{item.label}</span>
            <span className={cn(
              "tabular-nums text-[11px]",
              active ? "text-muted-foreground" : "text-muted-foreground/70"
            )}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function applyKanbanFilter(cards: KanbanCard[], filter: KanbanFilter): KanbanCard[] {
  switch (filter) {
    case 'urgent':
      return cards.filter(c => c.priority === 'urgent');
    case 'high':
      return cards.filter(c => c.priority === 'high');
    case 'overdue':
      return cards.filter(isOverdue);
    default:
      return cards;
  }
}
