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
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 font-mono tabular-nums select-none border transition-colors',
        isDanger
          ? 'bg-danger/10 border-danger/30 text-danger'
          : 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        isAlmostLimit && 'animate-pulse',
      )}
    >
      <Timer size={16} className="shrink-0 opacity-70" />
      <span className="text-2xl font-black leading-none">{days}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {days === 1 ? 'dia' : 'dias'}
      </span>
    </div>
  );
}
