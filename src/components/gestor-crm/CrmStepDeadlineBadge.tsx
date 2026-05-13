import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** 'ok' | 'warning' | 'critical' | 'overdue' | 'none' */
  status: 'ok' | 'warning' | 'critical' | 'overdue' | 'none';
  remainingMs: number;
  totalMs: number;
  className?: string;
}

/**
 * Per-step deadline badge. Shows time remaining with color scale:
 * - green (>50% time) → yellow (25-50%) → red (<25%) → skull (overdue)
 *
 * Distinct from CrmDeadlineBadge (global config deadline).
 * This tracks step_entered_at + deadline_days per individual step.
 */
export default function CrmStepDeadlineBadge({ status, remainingMs, totalMs, className }: Props) {
  if (status === 'none') return null;

  const hours = Math.abs(Math.ceil(remainingMs / (1000 * 60 * 60)));
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;

  const timeLabel = (() => {
    if (status === 'overdue') {
      return days > 0 ? `${days}d ${remainderHours}h atrasado` : `${hours}h atrasado`;
    }
    return days > 0 ? `${days}d ${remainderHours}h` : `${hours}h`;
  })();

  if (status === 'overdue') {
    return (
      <Badge
        variant="destructive"
        className={cn(
          'text-[9px] px-1.5 py-0 gap-0.5 animate-pulse',
          'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-700',
          className
        )}
      >
        <Skull size={9} />
        {timeLabel}
      </Badge>
    );
  }

  if (status === 'critical') {
    return (
      <Badge
        variant="destructive"
        className={cn('text-[9px] px-1.5 py-0 gap-0.5', className)}
      >
        <AlertTriangle size={9} />
        {timeLabel}
      </Badge>
    );
  }

  if (status === 'warning') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[9px] px-1.5 py-0 gap-0.5 border-warning text-warning bg-warning/5',
          className
        )}
      >
        <Clock size={9} />
        {timeLabel}
      </Badge>
    );
  }

  // ok
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[9px] px-1.5 py-0 gap-0.5 border-emerald-500/40 text-emerald-700 bg-emerald-500/5',
        className
      )}
    >
      <Clock size={9} />
      {timeLabel}
    </Badge>
  );
}
