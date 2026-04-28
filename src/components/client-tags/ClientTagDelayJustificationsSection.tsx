import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActionJustification } from '@/contexts/JustificationContext';
import { cn } from '@/lib/utils';

const ROLE_COPY: Record<string, string> = {
  gestor_ads: 'Como gestor de ads responsável por este cliente,',
  sucesso_cliente: 'Como sucesso do cliente responsável por esta conta,',
};

const ROLE_AS: Record<string, string> = {
  gestor_ads: 'gestor de ads',
  sucesso_cliente: 'sucesso do cliente',
};

interface PendingTagJustification {
  notification_id: string;
  tag_id: string;
  client_id: string;
  client_name: string;
  tag_name: string;
  user_role: string;
  task_table: string;
  task_title: string | null;
  expires_at: string;
  detected_at: string;
}

function expiredDays(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
}

interface Props {
  className?: string;
  /** Renderiza empty state com ícone "tudo ok"; default: null silencioso. */
  showEmptyState?: boolean;
}

/**
 * Section reutilizável de etiquetas (client_tags) vencidas onde o user logado
 * é responsável (gestor_ads ou sucesso_cliente). 1 card por tag pendente.
 */
export default function ClientTagDelayJustificationsSection({
  className,
  showEmptyState = false,
}: Props) {
  const { user } = useAuth();
  const { requireJustification } = useActionJustification();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['client-tag-delay-pending', user?.id],
    queryFn: async (): Promise<PendingTagJustification[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        'get_pending_client_tag_justifications_for_user',
      );
      if (error) throw error;
      return (data || []) as PendingTagJustification[];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Sort: mais atrasadas primeiro.
  const sorted = useMemo(
    () => [...pending].sort((a, b) => expiredDays(b.expires_at) - expiredDays(a.expires_at)),
    [pending],
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[0, 1].map(i => (
          <div
            key={i}
            className="border-t-2 border-t-danger bg-card border border-border rounded-lg overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-muted/40 rounded animate-pulse" />
            </div>
            <div className="px-4 py-3">
              <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted/40 rounded animate-pulse mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CircleCheck size={20} className="text-success" />
        </div>
        <p className="text-sm font-medium text-foreground mt-3">Nenhuma etiqueta vencida</p>
        <p className="text-xs text-muted-foreground mt-1">Tudo dentro do prazo</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {sorted.map(p => (
        <PendingTagCard
          key={p.notification_id}
          pending={p}
          onJustify={async () => {
            const days = expiredDays(p.expires_at);
            const roleLabel = ROLE_AS[p.user_role] ?? p.user_role;
            try {
              await requireJustification({
                title: 'Etiqueta vencida',
                subtitle: `${p.tag_name} · ${p.client_name}`,
                message: `O prazo desta etiqueta venceu há ${days} dia(s). Como ${roleLabel} responsável, descreva o motivo do atraso.`,
                taskId: p.tag_id,
                taskTable: p.task_table,
                taskTitle: p.task_title || `${p.tag_name} - ${p.client_name}`,
                priority: days >= 3 ? 'urgent' : 'high',
              });
            } catch {
              // user fechou — sem ação.
            }
          }}
        />
      ))}
    </div>
  );
}

function PendingTagCard({
  pending,
  onJustify,
}: {
  pending: PendingTagJustification;
  onJustify: () => void | Promise<void>;
}) {
  const days = expiredDays(pending.expires_at);
  const copy =
    ROLE_COPY[pending.user_role] ??
    `Como responsável (${pending.user_role}),`;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden border-t-2 border-t-danger animate-in fade-in slide-in-from-top-1 duration-200 ease-out">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-danger/80 shrink-0">
            ETIQUETA ·
          </span>
          <span className="text-base font-semibold text-foreground truncate">
            {pending.client_name}
          </span>
        </div>
        <span className="text-xs tabular-nums shrink-0 inline-flex items-center gap-1.5 text-danger font-semibold">
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse motion-reduce:animate-none"
          />
          Expirada há {days}d
        </span>
      </div>

      {/* Strip lateral com nome da tag + copy + ação */}
      <div className="mx-4 mb-3 pl-3 py-2.5 border-l-2 border-danger/60 bg-danger/5 rounded-r-md">
        <p className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {pending.tag_name}
        </p>
        <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
          {copy} explique o motivo do atraso desta etiqueta para alinhar com os outros responsáveis.
        </p>
        <button
          onClick={onJustify}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-danger transition-colors"
        >
          Justificar agora
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>
          Detectada em {format(new Date(pending.detected_at), 'dd/MM HH:mm', { locale: ptBR })}
        </span>
        <span>
          Venceu em {format(new Date(pending.expires_at), 'dd/MM HH:mm', { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
