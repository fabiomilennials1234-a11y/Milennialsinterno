import { cn } from '@/lib/utils';
import { Timer } from 'lucide-react';

interface GrowthCounterBadgeProps {
  counterStartedAt: string;
  counterEndedAt: string | null;
}

const THRESHOLD_WARNING = 14;
const THRESHOLD_DANGER = 21;

export default function GrowthCounterBadge({
  counterStartedAt,
  counterEndedAt,
}: GrowthCounterBadgeProps) {
  if (counterEndedAt) return null;

  const days = Math.floor(
    (Date.now() - new Date(counterStartedAt).getTime()) / (24 * 60 * 60 * 1000),
  );

  const isDanger = days >= THRESHOLD_WARNING;
  const isAlmostLimit = days >= THRESHOLD_DANGER;

  return (
    <div
      role="status"
      aria-label={`Contador: ${days} dias`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono tabular-nums select-none border text-[10px] transition-colors',
        isDanger
          ? 'bg-danger/10 border-danger/30 text-danger'
          : 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        isAlmostLimit && 'animate-pulse',
      )}
    >
      <Timer size={12} className="shrink-0 opacity-70" />
      <span className="font-bold leading-none">{days}</span>
      <span className="font-semibold uppercase tracking-wider opacity-70">
        {days === 1 ? 'dia' : 'dias'}
      </span>
    </div>
  );
}
