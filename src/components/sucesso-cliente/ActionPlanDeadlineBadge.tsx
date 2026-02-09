import { differenceInDays, format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Severity, SEVERITY_CONFIG } from '@/hooks/useCSActionPlans';

interface ActionPlanDeadlineBadgeProps {
  dueDate: string;
  severity: Severity;
  status: 'active' | 'completed' | 'cancelled';
  problemLabel: string;
  compact?: boolean;
}

const PERIOD_COLORS: Record<Severity, {
  bg: string;
  border: string;
  text: string;
  accent: string;
}> = {
  leve: {
    bg: 'bg-success/10',
    border: 'border-success',
    text: 'text-success',
    accent: 'bg-success',
  },
  moderado: {
    bg: 'bg-warning/10',
    border: 'border-warning',
    text: 'text-warning',
    accent: 'bg-warning',
  },
  critico: {
    bg: 'bg-destructive/10',
    border: 'border-destructive',
    text: 'text-destructive',
    accent: 'bg-destructive',
  },
};

export default function ActionPlanDeadlineBadge({ 
  dueDate, 
  severity, 
  status,
  problemLabel,
  compact = false
}: ActionPlanDeadlineBadgeProps) {
  const due = new Date(dueDate);
  const daysRemaining = differenceInDays(due, new Date());
  const isOverdue = isPast(due) && status === 'active';
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';

  const colors = PERIOD_COLORS[severity];
  const severityConfig = SEVERITY_CONFIG[severity];

  if (compact) {
    return (
      <div className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        isCompleted && 'bg-success/10 text-success',
        isCancelled && 'bg-muted text-muted-foreground',
        !isCompleted && !isCancelled && isOverdue && 'bg-destructive text-destructive-foreground animate-pulse',
        !isCompleted && !isCancelled && !isOverdue && colors.bg,
        !isCompleted && !isCancelled && !isOverdue && colors.text
      )}>
        {isCompleted ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Plano Concluído
          </>
        ) : isCancelled ? (
          <span>Plano Cancelado</span>
        ) : isOverdue ? (
          <>
            <AlertTriangle className="h-3 w-3" />
            Atrasado
          </>
        ) : (
          <>
            <Clock className="h-3 w-3" />
            {daysRemaining}d restantes
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl overflow-hidden border-2 shadow-lg',
      isCompleted && 'border-success',
      isCancelled && 'border-muted',
      !isCompleted && !isCancelled && isOverdue && 'border-destructive',
      !isCompleted && !isCancelled && !isOverdue && colors.border
    )}>
      {/* Header with period */}
      <div className={cn(
        'px-4 py-2 flex items-center justify-between',
        isCompleted && 'bg-success text-white',
        isCancelled && 'bg-muted text-muted-foreground',
        !isCompleted && !isCancelled && isOverdue && 'bg-destructive text-white animate-pulse',
        !isCompleted && !isCancelled && !isOverdue && colors.accent,
        !isCompleted && !isCancelled && !isOverdue && 'text-white'
      )}>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <span className="font-bold text-lg">
            {isCompleted ? 'Plano Concluído' : isCancelled ? 'Cancelado' : `${severityConfig.days} dias`}
          </span>
        </div>
        {!isCompleted && !isCancelled && (
          <span className="text-sm font-medium opacity-90">
            {isOverdue ? 'ATRASADO' : `${daysRemaining}d restantes`}
          </span>
        )}
      </div>

      {/* Body */}
      <div className={cn(
        'px-4 py-3',
        isCompleted && 'bg-success/5',
        isCancelled && 'bg-muted/30',
        !isCompleted && !isCancelled && colors.bg
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold',
            isCompleted && 'bg-success/20',
            isCancelled && 'bg-muted',
            !isCompleted && !isCancelled && colors.bg
          )}>
            {isCompleted ? (
              <CheckCircle2 className={cn('h-6 w-6', colors.text)} />
            ) : isOverdue ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <span className={colors.text}>{daysRemaining}</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {problemLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              Prazo: {format(due, "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
