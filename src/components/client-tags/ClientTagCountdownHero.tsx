import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import type { ClientTagItem } from './ClientTagsList';

interface Props {
  tag: ClientTagItem;
  className?: string;
}

/**
 * Hero compacto pra UMA tag ativa com cronômetro. Não usar quando já houver
 * `expired_at` (esse caso fica no badge inline). Layout: nome à esquerda,
 * cronômetro grande à direita. Sem ring SVG — apenas tipografia + bg semântico.
 */
export default function ClientTagCountdownHero({ tag, className }: Props) {
  const { remaining, severity, isExpired } = useCountdown(tag.expires_at);

  // Salvaguarda — caller já garante que não está expirada, mas se o relógio
  // virar enquanto montado, mostramos estado de alerta.
  if (isExpired) {
    return (
      <div
        role="alert"
        className={cn(
          'rounded-lg border-2 border-danger/50 bg-danger/15 px-4 py-3 flex items-center justify-between gap-4',
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-medium text-danger/80">
            Etiqueta vencida
          </p>
          <p className="text-base font-semibold text-foreground truncate mt-0.5">
            {tag.name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-mono tabular-nums leading-none text-danger">0h</p>
          <p className="text-[10px] uppercase tracking-wider text-danger/80 mt-1">EXPIRADA</p>
        </div>
      </div>
    );
  }

  const isDanger = severity === 'danger';
  const isWarning = severity === 'warning';

  return (
    <div
      role="status"
      aria-label={`Etiqueta ativa ${tag.name}, ${remaining} restantes`}
      className={cn(
        'rounded-lg border px-4 py-3 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-1 duration-200 ease-out',
        isDanger && 'border-danger/40 bg-danger/10',
        isWarning && 'border-warning/30 bg-warning/10',
        !isDanger && !isWarning && 'border-border/60 bg-muted/30',
        className,
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            'text-[10px] uppercase tracking-wider font-medium',
            isDanger ? 'text-danger/80' : isWarning ? 'text-warning/90' : 'text-muted-foreground',
          )}
        >
          Etiqueta ativa
        </p>
        <p className="text-base font-semibold text-foreground truncate mt-0.5">
          {tag.name}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn(
            'text-2xl font-mono tabular-nums leading-none',
            isDanger && 'text-danger',
            isWarning && 'text-warning',
            !isDanger && !isWarning && 'text-foreground',
          )}
        >
          {remaining}
        </p>
        <p
          className={cn(
            'text-[10px] uppercase tracking-wider mt-1',
            isDanger ? 'text-danger/80' : isWarning ? 'text-warning/90' : 'text-muted-foreground',
          )}
        >
          Restantes
        </p>
      </div>
    </div>
  );
}
