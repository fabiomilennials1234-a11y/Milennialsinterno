import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import { Clock, Hourglass, Tag } from 'lucide-react';

export interface ClientTagBadgeProps {
  name: string;
  expiresAt?: string | null;
  expiredAt?: string | null;
  dismissedAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showHistory?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<ClientTagBadgeProps['size']>, { pill: string; icon: number }> = {
  sm: { pill: 'text-[10px] px-2 py-0.5 gap-1.5', icon: 10 },
  md: { pill: 'text-[11px] px-2.5 py-1 gap-1.5', icon: 12 },
  lg: { pill: 'text-xs px-3 py-1.5 gap-2', icon: 13 },
};

const BASE = 'inline-flex items-center rounded-full leading-[1.35] font-semibold uppercase tracking-wider select-none transition-colors duration-150';

export default function ClientTagBadge({
  name,
  expiresAt,
  expiredAt,
  dismissedAt,
  size = 'sm',
  showHistory = false,
  className,
}: ClientTagBadgeProps) {
  const s = SIZE_CLASS[size];

  if (dismissedAt) {
    if (!showHistory) return null;
    return (
      <span
        role="status"
        aria-label={`Etiqueta dispensada: ${name}`}
        className={cn(BASE, s.pill, 'bg-transparent border border-dashed border-border/30 text-muted-foreground/35 line-through', className)}
      >
        <Tag size={s.icon} className="opacity-40 shrink-0" />
        {name}
      </span>
    );
  }

  if (expiredAt) {
    const diff = Date.now() - new Date(expiredAt).getTime();
    const expiredDays = Number.isFinite(diff) ? Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000))) : 0;
    return (
      <span
        role="alert"
        aria-label={`Etiqueta expirada há ${expiredDays} dias: ${name}`}
        className={cn(
          BASE, s.pill,
          'bg-danger/10 border border-danger/30 text-danger shadow-[0_0_8px_rgba(239,68,68,0.15)]',
          'animate-in fade-in slide-in-from-top-1 duration-200 ease-out',
          className,
        )}
      >
        <span aria-hidden className="relative flex shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
          <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-danger animate-ping opacity-50" />
        </span>
        <span className="opacity-70">{name}</span>
        <span className="font-mono tabular-nums normal-case tracking-normal">
          {expiredDays}d atrás
        </span>
      </span>
    );
  }

  return <LiveBadge name={name} expiresAt={expiresAt ?? null} size={size} sizeClass={s} className={className} />;
}

function LiveBadge({
  name,
  expiresAt,
  size,
  sizeClass: s,
  className,
}: {
  name: string;
  expiresAt: string | null;
  size: NonNullable<ClientTagBadgeProps['size']>;
  sizeClass: (typeof SIZE_CLASS)[keyof typeof SIZE_CLASS];
  className?: string;
}) {
  const { remaining, severity, isExpired } = useCountdown(expiresAt);

  if (expiresAt && isExpired) {
    return (
      <span
        role="alert"
        aria-label={`Etiqueta acabou de expirar: ${name}`}
        className={cn(
          BASE, s.pill,
          'bg-danger/10 border border-danger/30 text-danger shadow-[0_0_8px_rgba(239,68,68,0.15)]',
          className,
        )}
      >
        <span aria-hidden className="relative flex shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
          <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-danger animate-ping opacity-50" />
        </span>
        <span className="opacity-70">{name}</span>
        <span className="font-mono tabular-nums normal-case tracking-normal">0d</span>
      </span>
    );
  }

  if (!expiresAt) {
    return (
      <span
        role="status"
        aria-label={`Etiqueta: ${name}`}
        className={cn(
          BASE, s.pill,
          'bg-amber-500/8 border border-amber-500/20 text-amber-400',
          className,
        )}
      >
        <Hourglass size={s.icon} className="shrink-0 opacity-60" />
        {name}
      </span>
    );
  }

  const isDanger = severity === 'danger';
  const isWarning = severity === 'warning';

  return (
    <span
      role="status"
      aria-label={`Etiqueta ${name}, ${remaining} restantes`}
      className={cn(
        BASE, s.pill,
        isDanger && 'bg-danger/10 border border-danger/30 text-danger shadow-[0_0_6px_rgba(239,68,68,0.1)]',
        isWarning && 'bg-warning/8 border border-warning/25 text-warning',
        !isDanger && !isWarning && 'bg-emerald-500/8 border border-emerald-500/20 text-emerald-400',
        className,
      )}
    >
      {isDanger ? (
        <span aria-hidden className="relative flex shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
          <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-danger animate-ping opacity-50" />
        </span>
      ) : (
        <Clock size={s.icon} className={cn('shrink-0 opacity-60', isWarning ? 'text-warning' : 'text-emerald-400')} />
      )}
      {name}
      <span
        className={cn(
          'font-mono tabular-nums normal-case tracking-normal font-bold',
          isDanger && 'text-danger',
          isWarning && 'text-warning',
          !isDanger && !isWarning && 'text-emerald-400',
        )}
      >
        {remaining}
      </span>
    </span>
  );
}
