import { ReactNode } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type State = 'pending' | 'revision' | 'done' | 'archived';

interface Props {
  title: string;
  dueDate: string;
  state: State;
  daysOverdue?: number;
  justificationText?: string;
  masterComment?: string | null;
  ownerName?: string;
  children?: ReactNode;
}

const stateClass: Record<State, string> = {
  pending: 'border-danger/50',
  revision: 'border-warning',
  done: 'border-border',
  archived: 'border-border opacity-50',
};

export default function JustificativaItem({
  title,
  dueDate,
  state,
  justificationText,
  masterComment,
  ownerName,
  children,
}: Props) {
  const due = new Date(dueDate);
  const overdue = formatDistanceToNowStrict(due, { locale: ptBR });

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', stateClass[state])}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-danger/15 flex items-center justify-center flex-shrink-0">
          <Clock size={16} className="text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground">
            Prazo: {format(due, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })} · {overdue} de atraso
          </p>
          {ownerName && (
            <p className="text-xs text-muted-foreground">
              Responsável: <span className="text-foreground">{ownerName}</span>
            </p>
          )}
        </div>
      </div>

      {state === 'revision' && masterComment && (
        <div className="flex items-start gap-2 p-2 rounded border border-warning/40 bg-warning/10 text-sm">
          <AlertTriangle size={14} className="text-warning mt-0.5" />
          <p className="text-foreground">
            <span className="font-medium">Motivo:</span> {masterComment}
          </p>
        </div>
      )}

      {state === 'done' && justificationText && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{justificationText}</p>
      )}

      {children}
    </div>
  );
}
