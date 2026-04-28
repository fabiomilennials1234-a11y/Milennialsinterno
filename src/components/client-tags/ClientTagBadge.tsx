import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';

export interface ClientTagBadgeProps {
  name: string;
  expiresAt?: string | null;
  expiredAt?: string | null;
  dismissedAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Quando true, renderiza tags dismissed em estado tachado (default: false → null). */
  showHistory?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<ClientTagBadgeProps['size']>, string> = {
  sm: 'text-[10.5px] px-2 py-0.5',
  md: 'text-[11px] px-2.5 py-1',
  lg: 'text-xs px-3 py-1.5',
};

const BASE = 'inline-flex items-center gap-1.5 rounded-md leading-[1.4] font-medium uppercase tracking-wide';

/**
 * Pill achatado para etiquetas de processo do cliente. Estados A-F:
 *  A — sem cronômetro (neutro)
 *  B — >3d restantes (calmo, success no timer)
 *  C — ≤3d e >24h (warning)
 *  D — ≤24h (danger pré-vencimento, dot pulsante)
 *  E — expirada (border-2 danger, label "EXPIRADA · Xd")
 *  F — dismissed (somente com showHistory; tracejado, line-through)
 *
 * Diferenciado visualmente do `ClientLabelBadge` (classificação CS) por intenção:
 * "metadado de processo", neutro por default. Usa `useCountdown` quando aplicável.
 */
export default function ClientTagBadge({
  name,
  expiresAt,
  expiredAt,
  dismissedAt,
  size = 'sm',
  showHistory = false,
  className,
}: ClientTagBadgeProps) {
  // F — dismissed: oculto por padrão; só renderiza se showHistory.
  if (dismissedAt) {
    if (!showHistory) return null;
    return (
      <span
        role="status"
        aria-label={`Etiqueta dispensada: ${name}`}
        className={cn(
          BASE,
          SIZE_CLASS[size],
          'bg-transparent border border-dashed border-border/40 text-muted-foreground/40 line-through',
          className,
        )}
      >
        <span aria-hidden className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        {name}
      </span>
    );
  }

  // E — expirada: prioridade sobre cronômetro vivo.
  if (expiredAt) {
    // Calcula dias decorridos via expiredAt directly (sem hook — não muda).
    const diff = Date.now() - new Date(expiredAt).getTime();
    const expiredDays = Number.isFinite(diff) ? Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000))) : 0;
    return (
      <span
        role="alert"
        aria-label={`Etiqueta expirada há ${expiredDays} dias: ${name}`}
        className={cn(
          BASE,
          SIZE_CLASS[size],
          'bg-danger/15 border-2 border-danger/50 text-danger animate-in fade-in slide-in-from-top-1 duration-200 ease-out',
          className,
        )}
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse motion-reduce:animate-none"
        />
        EXPIRADA · {expiredDays}d
        <span className="opacity-70">· {name}</span>
      </span>
    );
  }

  // Caminho com cronômetro vivo (B/C/D) ou neutro (A).
  return <LiveBadge name={name} expiresAt={expiresAt ?? null} size={size} className={className} />;
}

function LiveBadge({
  name,
  expiresAt,
  size,
  className,
}: {
  name: string;
  expiresAt: string | null;
  size: NonNullable<ClientTagBadgeProps['size']>;
  className?: string;
}) {
  const { remaining, severity, isExpired } = useCountdown(expiresAt);

  // Defesa: se cronômetro virou enquanto montado (sem expiredAt vindo do DB ainda).
  if (expiresAt && isExpired) {
    return (
      <span
        role="alert"
        aria-label={`Etiqueta acabou de expirar: ${name}`}
        className={cn(
          BASE,
          SIZE_CLASS[size],
          'bg-danger/15 border-2 border-danger/50 text-danger',
          className,
        )}
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse motion-reduce:animate-none"
        />
        EXPIRADA · 0d
        <span className="opacity-70">· {name}</span>
      </span>
    );
  }

  // A — sem cronômetro
  if (!expiresAt) {
    return (
      <span
        role="status"
        aria-label={`Etiqueta: ${name}`}
        className={cn(
          BASE,
          SIZE_CLASS[size],
          'bg-muted/40 text-muted-foreground border border-border/60',
          className,
        )}
      >
        <span aria-hidden className="w-1 h-1 rounded-full bg-muted-foreground/50" />
        {name}
      </span>
    );
  }

  // B/C/D
  const isDanger = severity === 'danger';
  const isWarning = severity === 'warning';

  return (
    <span
      role="status"
      aria-label={`Etiqueta ${name}, ${remaining} restantes`}
      className={cn(
        BASE,
        SIZE_CLASS[size],
        isDanger && 'bg-danger/10 border border-danger/40 text-danger',
        isWarning && 'bg-warning/10 border border-warning/30 text-warning',
        !isDanger && !isWarning && 'bg-muted/40 text-muted-foreground border border-border/60',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'w-1 h-1 rounded-full',
          isDanger
            ? 'w-1.5 h-1.5 bg-danger animate-pulse motion-reduce:animate-none'
            : isWarning
              ? 'bg-warning'
              : 'bg-muted-foreground/50',
        )}
      />
      {name}
      <span
        className={cn(
          'font-mono tabular-nums normal-case tracking-normal',
          isDanger && 'text-danger',
          isWarning && 'text-warning',
          !isDanger && !isWarning && 'text-success/90',
        )}
      >
        {remaining}
      </span>
    </span>
  );
}
