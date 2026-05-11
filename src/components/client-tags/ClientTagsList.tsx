import { cn } from '@/lib/utils';
import ClientTagBadge, { type ClientTagBadgeProps } from './ClientTagBadge';

/** Canonical tag names — use these instead of raw strings to avoid typos. */
export const TAG_ESPERAR_GROWTH = 'Esperar ser finalizado o Onboarding do Growth';
export const TAG_ESPERAR_TORQUE = 'Esperar Torque ser finalizado';
export const TAG_AGUARDANDO_ESTRATEGIA_ADS = 'Aguardando Estratégia de Tráfego';

export interface ClientTagItem {
  id: string;
  name: string;
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
          expiresAt={tag.expires_at}
          expiredAt={tag.expired_at}
          dismissedAt={tag.dismissed_at}
          size={size}
          showHistory={showHistory}
        />
      ))}
    </div>
  );
}
