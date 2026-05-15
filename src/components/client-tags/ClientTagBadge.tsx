import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import { Clock, Hourglass, Tag } from 'lucide-react';

export interface ClientTagBadgeProps {
  name: string;
  createdAt?: string;
  expiresAt?: string | null;
  expiredAt?: string | null;
  dismissedAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showHistory?: boolean;
  /** Render with pulsating red glow — for tags that block user progress. */
  blocking?: boolean;
  /** 'countdown' (default): shows time remaining via expires_at.
   *  'elapsed': shows days since created_at. <14d = blue, >=14d = red. */
  counterMode?: 'countdown' | 'elapsed';
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
  createdAt,
  expiresAt,
  expiredAt,
  dismissedAt,
  size = 'sm',
  showHistory = false,
  blocking = false,
  counterMode = 'countdown',
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

  if (counterMode === 'elapsed') {
    return <ElapsedBadge name={name} createdAt={createdAt ?? null} sizeClass={s} className={className} />;
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

  return <LiveBadge name={name} expiresAt={expiresAt ?? null} size={size} sizeClass={s} blocking={blocking} className={className} />;
}

function LiveBadge({
  name,
  expiresAt,
  size,
  sizeClass: s,
  blocking = false,
  className,
}: {
  name: string;
  expiresAt: string | null;
  size: NonNullable<ClientTagBadgeProps['size']>;
  sizeClass: (typeof SIZE_CLASS)[keyof typeof SIZE_CLASS];
  blocking?: boolean;
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
    if (blocking) {
      return (
        <span
          role="alert"
          aria-label={`Etiqueta bloqueante: ${name}`}
          className={cn(
            BASE, s.pill,
            'bg-danger/10 border border-danger/30 text-danger tag-blocking-pulse',
            className,
          )}
        >
          <span aria-hidden className="relative flex shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-danger animate-ping opacity-50" />
          </span>
          {name}
        </span>
      );
    }
    return (
      <span
        role="status"
        aria-label={`Etiqueta: ${name}`}
        className={cn(
          BASE, s.pill,
          'bg-slate-400/8 border border-slate-400/15 text-slate-400',
          className,
        )}
      >
        <Hourglass size={s.icon} className="shrink-0 opacity-50" />
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

const ELAPSED_THRESHOLD_DAYS = 14;

function ElapsedBadge({
  name,
  createdAt,
  sizeClass: s,
  className,
}: {
  name: string;
  createdAt: string | null;
  sizeClass: (typeof SIZE_CLASS)[keyof typeof SIZE_CLASS];
  className?: string;
}) {
  const daysElapsed = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const isOverThreshold = daysElapsed >= ELAPSED_THRESHOLD_DAYS;

  return (
    <span
      role="status"
      aria-label={`${name}: ${daysElapsed} dias`}
      className={cn(
        BASE, s.pill,
        isOverThreshold
          ? 'bg-danger/10 border border-danger/30 text-danger animate-pulse'
          : 'bg-blue-500/10 border border-blue-500/30 text-blue-400',
        className,
      )}
    >
      <Clock size={s.icon} className="shrink-0 opacity-60" />
      {name}
      <span className="font-mono tabular-nums normal-case tracking-normal font-bold">
        {daysElapsed}d
      </span>
    </span>
  );
}
