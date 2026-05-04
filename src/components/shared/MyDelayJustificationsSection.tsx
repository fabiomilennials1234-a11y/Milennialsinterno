import { useMemo } from 'react';
import {
  useJustificativasPendentes,
  useJustificativasDoneMine,
  type PendenteItem,
  type DoneItem,
} from '@/hooks/useJustificativas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  compact?: boolean;
}

type Section =
  | { kind: 'pendente'; data: PendenteItem }
  | { kind: 'done'; data: DoneItem };

export default function MyDelayJustificationsSection({ compact }: Props) {
  const { data: pendentes = [], isLoading: loadingPendentes } = useJustificativasPendentes();
  const { data: dones = [], isLoading: loadingDones } = useJustificativasDoneMine();
  const isLoading = loadingPendentes || loadingDones;

  const items = useMemo<Section[]>(() => {
    return [
      ...pendentes.map<Section>((p) => ({ kind: 'pendente', data: p })),
      ...dones.map<Section>((d) => ({ kind: 'done', data: d })),
    ];
  }, [pendentes, dones]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (compact) {
    const pendingCount = pendentes.length;
    return (
      <div className="space-y-3">
        <div className={cn(
          'p-3 rounded-lg text-center',
          pendingCount > 0 ? 'bg-warning/20' : 'bg-muted/30',
        )}>
          <p className={cn(
            'font-bold text-2xl',
            pendingCount > 0 ? 'text-warning' : 'text-muted-foreground',
          )}>
            {pendingCount}
          </p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Suas justificativas para tarefas atrasadas em todos os departamentos
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="text-success" size={20} />
            </div>
            <p className="font-medium text-sm">Nenhuma justificativa</p>
            <p className="text-xs mt-1">Você não tem atrasos pendentes nem justificados</p>
          </div>
        ) : (
          items.map((section) => {
            if (section.kind === 'pendente') {
              const it = section.data;
              const requiresRevision = it.requires_revision;
              return (
                <div
                  key={`pend-${it.notification_id}`}
                  className={cn(
                    'p-3 bg-card border rounded-lg',
                    requiresRevision ? 'border-warning/40 bg-warning/5' : 'border-destructive/30 bg-destructive/5',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                      requiresRevision ? 'bg-warning/20' : 'bg-destructive/20',
                    )}>
                      <AlertTriangle size={14} className={requiresRevision ? 'text-warning' : 'text-destructive'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{it.task_title || 'Tarefa'}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        {requiresRevision ? 'Requer nova justificativa' : 'Pendente de justificativa'}
                      </p>

                      {it.master_comment && (
                        <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/20">
                          <p className="text-[10px] uppercase tracking-wide text-warning/80 mb-0.5">Comentário do gestor</p>
                          <p className="text-xs text-foreground line-clamp-3">{it.master_comment}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock size={10} />
                        <span>
                          Vencida em {format(new Date(it.task_due_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const it = section.data;
            return (
              <div key={`done-${it.justification_id}`} className="p-3 bg-card border border-warning/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{it.task_title || 'Tarefa'}</p>

                    <div className="mt-2 p-2 bg-muted/30 rounded-md">
                      <p className="text-xs text-foreground">{it.justification}</p>
                    </div>

                    {it.master_comment && (
                      <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/20">
                        <p className="text-[10px] uppercase tracking-wide text-destructive/80 mb-0.5">Comentário do gestor</p>
                        <p className="text-xs text-foreground line-clamp-3">{it.master_comment}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock size={10} />
                      <span>
                        Justificado em {format(new Date(it.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
