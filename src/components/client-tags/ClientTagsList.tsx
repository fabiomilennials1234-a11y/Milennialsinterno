import { cn } from '@/lib/utils';
import ClientTagBadge, { type ClientTagBadgeProps } from './ClientTagBadge';

/** Canonical tag names — use these instead of raw strings to avoid typos. */
export const TAG_TORQUE_BLOQUEADO = 'TORQUE BLOQUEADO';
export const TAG_AGUARDANDO_ESTRATEGIA_ADS = 'Aguardando Estratégia de Tráfego';
export const TAG_BLOQUEADO_CX = 'BLOQUEADO: ESPERAR LIGACAO CX';
export const TAG_ESPERAR_BRIEFING = 'Esperar Briefing';

/** Tags that visually block progress — rendered with pulsating red style. */
export const BLOCKING_TAGS = new Set([TAG_BLOQUEADO_CX, TAG_ESPERAR_BRIEFING]);

export interface ClientTagItem {
  id: string;
  name: string;
  created_at?: string;
  expires_at?: string | null;
  expired_at?: string | null;
  dismissed_at?: string | null;
}

interface Props {
  tags: ClientTagItem[];
  size?: ClientTagBadgeProps['size'];
  layout?: 'wrap' | 'stack';
  showHistory?: boolean;
  /** 'hidden' (default) renderiza nada quando lista vazia; 'inline' mostra placeholder discreto. */
  emptyState?: 'hidden' | 'inline';
  /** Tag names to hide in this context (role-based visibility). */
  excludeNames?: string[];
  className?: string;
}

/**
 * Render simples de uma lista de `ClientTagBadge`. Sort vem do hook upstream
 * (não reordenamos aqui pra não duplicar lógica).
 */
export default function ClientTagsList({
  tags,
  size = 'sm',
  layout = 'wrap',
  showHistory = false,
  emptyState = 'hidden',
  excludeNames,
  className,
}: Props) {
  const excludeSet = excludeNames?.length ? new Set(excludeNames) : null;
  const visible = (showHistory ? tags : tags.filter(t => !t.dismissed_at))
    .filter(t => !excludeSet || !excludeSet.has(t.name));

  if (visible.length === 0) {
    if (emptyState === 'hidden') return null;
    return (
      <span
        className={cn(
          'inline-flex text-[10px] uppercase tracking-wide text-muted-foreground/50',
          className,
        )}
      >
        Sem etiquetas
      </span>
    );
  }

  return (
    <div
      className={cn(
        layout === 'stack' ? 'flex flex-col gap-1' : 'flex flex-wrap gap-1.5',
        className,
      )}
    >
      {visible.map(tag => (
        <ClientTagBadge
          key={tag.id}
          name={tag.name}
          createdAt={tag.created_at}
          expiresAt={tag.expires_at}
          expiredAt={tag.expired_at}
          dismissedAt={tag.dismissed_at}
          size={size}
          showHistory={showHistory}
          blocking={BLOCKING_TAGS.has(tag.name)}
          counterMode={tag.name === TAG_TORQUE_BLOQUEADO ? 'elapsed' : 'countdown'}
        />
      ))}
    </div>
  );
}
