import { cn } from '@/lib/utils';
import ClientTagBadge, { type ClientTagBadgeProps } from './ClientTagBadge';

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
  className,
}: Props) {
  const visible = showHistory ? tags : tags.filter(t => !t.dismissed_at);

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
