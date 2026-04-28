import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActionJustification } from '@/contexts/JustificationContext';
import { useAllCrmDelayedConfigs, type DelayedConfigSummary } from '@/hooks/useAllCrmDelayedConfigs';
import {
  useCrmConfigCollectiveJustifications,
  type CollectiveJustification,
} from '@/hooks/useCrmConfigCollectiveJustifications';
import { avatarColor, initials } from '@/lib/avatar';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PRODUTO_LABEL: Record<string, string> = {
  v8: 'V8',
  automation: 'Automation',
  copilot: 'Copilot',
};

const PRODUTO_BORDER: Record<string, string> = {
  v8: 'border-violet-500',
  automation: 'border-cyan-500',
  copilot: 'border-amber-500',
};

const ROLE_LABEL: Record<string, string> = {
  gestor_crm: 'Gestor de CRM',
  consultor_comercial: 'Treinador Comercial',
  gestor_ads: 'Gestor de Ads',
  sucesso_cliente: 'Sucesso do Cliente',
};

interface Props {
  className?: string;
  /** Renderiza empty state com ícone "tudo ok"; default: null silencioso. */
  showEmptyState?: boolean;
}

// Section reutilizável de justificativas coletivas em atraso CRM.
// 1 card por config_id; cada card busca suas 4 perspectivas via RPC.
// Visualmente: own perspective destacado, outras compactas, footer com progresso.
export default function CrmDelayJustificationsSection({
  className,
  showEmptyState = false,
}: Props) {
  const { data: configs = [], isLoading } = useAllCrmDelayedConfigs();

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[0, 1].map(i => (
          <div
            key={i}
            className="border-t-2 border-muted bg-card border border-border rounded-lg overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-muted/40 rounded animate-pulse" />
            </div>
            <div className="px-4 py-3 space-y-3">
              {[0, 1, 2].map(j => (
                <div key={j} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-muted/40 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-muted/40 rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-muted/40 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (configs.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CircleCheck size={20} className="text-success" />
        </div>
        <p className="text-sm font-medium text-foreground mt-3">Sem configs atrasadas</p>
        <p className="text-xs text-muted-foreground mt-1">Tudo dentro do prazo</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {configs.map(c => (
        <ConfigCard key={c.config_id} config={c} />
      ))}
    </div>
  );
}

function ConfigCard({ config }: { config: DelayedConfigSummary }) {
  const { user } = useAuth();
  const { requireJustification } = useActionJustification();
  const { data: perspectives = [] } = useCrmConfigCollectiveJustifications(config.config_id);

  const myPerspective = useMemo(
    () => perspectives.find(p => p.user_id === user?.id) ?? null,
    [perspectives, user],
  );
  const others = useMemo(() => {
    const o = perspectives.filter(p => p.user_id !== user?.id);
    return o.sort((a, b) => {
      if (a.is_pending !== b.is_pending) return a.is_pending ? 1 : -1;
      return (a.justified_at || '').localeCompare(b.justified_at || '');
    });
  }, [perspectives, user]);

  const justifiedCount = perspectives.filter(p => !p.is_pending).length;
  const totalCount = perspectives.length;
  const allDone = justifiedCount === totalCount && totalCount > 0;

  const severity: 'danger' | 'warning' = config.delayed_days >= 8 ? 'danger' : 'warning';
  const showDot = config.delayed_days >= 4;

  const produtoLabel = PRODUTO_LABEL[config.produto] ?? config.produto;

  const handleJustifyMe = async () => {
    if (!myPerspective || !myPerspective.is_pending) return;
    try {
      await requireJustification({
        title: 'Tarefa CRM atrasada',
        subtitle: `${produtoLabel} · ${config.client_name}`,
        message: `Esta configuração está atrasada há ${config.delayed_days} dia(s).`,
        taskId: config.config_id,
        taskTable: `crm_config_delay__${myPerspective.user_role}`,
        taskTitle: `${produtoLabel} - ${config.client_name}`,
        priority: config.delayed_days >= 8 ? 'urgent' : 'high',
      });
    } catch {
      // user fechou — sem ação.
    }
  };

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg overflow-hidden border-t-2 animate-in fade-in slide-in-from-top-1 duration-200 ease-out',
        PRODUTO_BORDER[config.produto] ?? 'border-muted',
      )}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70 shrink-0">
            {produtoLabel} ·
          </span>
          <span className="text-base font-semibold text-foreground truncate">
            {config.client_name}
          </span>
        </div>
        <span
          className={cn(
            'text-xs tabular-nums shrink-0 inline-flex items-center gap-1.5',
            severity === 'danger'
              ? 'text-danger font-semibold'
              : config.delayed_days >= 4
                ? 'text-warning font-semibold'
                : 'text-warning font-medium',
          )}
        >
          {showDot && (
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full animate-pulse',
                severity === 'danger' ? 'bg-danger' : 'bg-warning',
              )}
            />
          )}
          {config.delayed_days}d atrasada
        </span>
      </div>

      {/* Sua perspectiva */}
      {myPerspective && (
        <div className="mx-4 mb-3 pl-3 py-2.5 border-l-2 border-foreground/40 bg-muted/30 rounded-r-md">
          <PerspectiveContent
            perspective={myPerspective}
            isOwn
            onJustify={handleJustifyMe}
          />
        </div>
      )}

      {/* Outras perspectivas */}
      {others.length > 0 && (
        <div className="divide-y divide-border">
          {others.map(p => (
            <div key={p.user_id} className="px-4 py-2.5 flex items-start gap-3">
              <Avatar userId={p.user_id} userName={p.user_name} />
              <div className="flex-1 min-w-0">
                <PerspectiveContent perspective={p} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] tabular-nums">
        <span className={cn(allDone ? 'text-success font-medium' : 'text-warning')}>
          {justifiedCount} de {totalCount} justificadas
        </span>
        <span className="text-muted-foreground">
          Detectado em {format(new Date(config.detected_at), 'dd/MM HH:mm', { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}

function Avatar({ userId, userName }: { userId: string; userName: string }) {
  return (
    <div
      aria-label={userName}
      className={cn(
        'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0',
        avatarColor(userId),
      )}
    >
      {initials(userName)}
    </div>
  );
}

function PerspectiveContent({
  perspective,
  isOwn = false,
  onJustify,
}: {
  perspective: CollectiveJustification;
  isOwn?: boolean;
  onJustify?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {isOwn && <Avatar userId={perspective.user_id} userName={perspective.user_name} />}
        <span className="text-sm font-medium text-foreground">{perspective.user_name}</span>
        <span className="text-[11px] text-muted-foreground">
          · {ROLE_LABEL[perspective.user_role] ?? perspective.user_role}
          {isOwn ? ' (você)' : ''}
        </span>
      </div>

      {perspective.is_pending ? (
        <p className="text-sm italic text-muted-foreground/60 mt-1">
          {isOwn
            ? 'Aguardando sua justificativa'
            : `Aguardando justificativa de ${perspective.user_name.split(' ')[0]}`}
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground/80 mt-1 line-clamp-2 leading-relaxed">
            {perspective.justification_text}
          </p>
          {perspective.justified_at && (
            <p className="text-[11px] text-muted-foreground/70 mt-1 tabular-nums">
              {formatDistanceToNow(new Date(perspective.justified_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          )}
        </>
      )}

      {isOwn && perspective.is_pending && onJustify && (
        <button
          onClick={onJustify}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-warning transition-colors"
        >
          Justificar agora
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
