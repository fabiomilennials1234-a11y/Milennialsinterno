import { useEffect, useState } from 'react';
import { Timer, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  blockedUntil: string;
  className?: string;
}

/**
 * Live countdown for D+N blocked steps.
 * Updates every second when < 1h remaining, every minute otherwise.
 * Shows "Aguardando D+N" with visual countdown.
 */
export default function CrmBlockedCountdown({ blockedUntil, className }: Props) {
  const [now, setNow] = useState(Date.now());

  const deadline = new Date(blockedUntil).getTime();
  const remaining = deadline - now;
  const isExpired = remaining <= 0;

  useEffect(() => {
    if (isExpired) return;
    // Update every second if < 1h, every 30s otherwise
    const interval = remaining < 60 * 60 * 1000 ? 1000 : 30_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [remaining, isExpired]);

  if (isExpired) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const timeDisplay = (() => {
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  })();

  return (
    <div className={cn(
      'flex items-center gap-2.5 p-3 rounded-lg border',
      'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/25',
      className
    )}>
      <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
        <Lock size={14} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-700">Aguardando D+N</p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <Timer size={11} className="text-amber-600" />
          <span className="text-sm font-mono font-bold text-amber-800 tabular-nums">
            {timeDisplay}
          </span>
          <span className="text-[10px] text-amber-600/70">restantes</span>
        </div>
      </div>
    </div>
  );
}
