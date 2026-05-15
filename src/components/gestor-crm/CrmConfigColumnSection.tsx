import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Wrench, ListChecks, AlertTriangle } from 'lucide-react';
import {
  useCrmConfiguracoes,
  CRM_PRODUTO_LABEL,
  CRM_PRODUTO_COLOR,
  CRM_STEP_LABEL,
  CRM_STEPS_BY_PRODUTO,
  CRM_PHASES_BY_PRODUTO,
  CRM_CONFIG_DEADLINE_DAYS,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import { useStepValidations, type StepValidation } from '@/hooks/useCrmStepValidation';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import ClientTagsList from '@/components/client-tags/ClientTagsList';
import CrmConfigViewModal from './CrmConfigViewModal';
import CrmDeadlineBadge from './CrmDeadlineBadge';
import CrmValidationGate from './CrmValidationGate';
import { cn } from '@/lib/utils';

interface Props {
  produto: CrmProduto;
}

/**
 * Coluna de configuracao de um produto (V8 / Automation / Copilot).
 *
 * Renderiza uma faixa por etapa da state-machine do produto (padrao
 * visual do Paddock Onboarding) — cada etapa e uma barra cinza com
 * numeracao `[N] Nome da etapa`. Os cards dos clientes aparecem logo
 * abaixo da faixa da etapa ATUAL deles.
 *
 * Independencia total: cada crm_configuracoes tem seu proprio
 * current_step, entao nada compartilha avanco entre cards.
 */
export default function CrmConfigColumnSection({ produto }: Props) {
  const { data: configs = [], isLoading } = useCrmConfiguracoes({ produto, finalizado: false });
  const { data: validations = [] } = useStepValidations(produto);
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);

  // Fetch client tags for all configs' clients (show blocking labels)
  const configClientIds = useMemo(
    () => [...new Set((configs as any[]).map(c => c.client_id).filter(Boolean))],
    [configs],
  );
  const { data: tagsByClient } = useClientTagsBatch(configClientIds);

  const label = CRM_PRODUTO_LABEL[produto];
  const color = CRM_PRODUTO_COLOR[produto];
  const steps = CRM_STEPS_BY_PRODUTO[produto];
  const phases = CRM_PHASES_BY_PRODUTO[produto];
  const slaMs = CRM_CONFIG_DEADLINE_DAYS[produto] * 24 * 60 * 60 * 1000;

  // Build validation lookup: step_key -> StepValidation
  const validationMap = useMemo(() => {
    const map = new Map<string, StepValidation>();
    for (const v of validations) map.set(v.step_key, v);
    return map;
  }, [validations]);

  // Agrupa configs por step para render O(1) por step
  const configsByStep = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of steps) map.set(s, []);
    for (const cfg of configs as any[]) {
      const arr = map.get(cfg.current_step);
      if (arr) arr.push(cfg);
    }
    return map;
  }, [configs, steps]);

  // Count SLA breaches for column header badge (7.7)
  const slaBreachCount = useMemo(() => {
    const now = Date.now();
    return (configs as any[]).filter(cfg => {
      if (!cfg.created_at) return false;
      const start = new Date(cfg.created_at).getTime();
      return now > start + slaMs;
    }).length;
  }, [configs, slaMs]);

  // Compute checklist progress for a config (7.2)
  const getChecklistProgress = (cfg: any): { done: number; total: number } | null => {
    const validation = validationMap.get(cfg.current_step);
    if (!validation?.checklist_items?.length) return null;
    const state = cfg.checklist_state || {};
    const done = validation.checklist_items.filter((item: string) => state[item]).length;
    return { done, total: validation.checklist_items.length };
  };

  // Check if config is SLA-breached (7.7)
  const isSlaBreached = (cfg: any): boolean => {
    if (!cfg.created_at) return false;
    return Date.now() > new Date(cfg.created_at).getTime() + slaMs;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  // Renderiza fases e steps com numeracao global cumulativa
  const renderPhases = (showCards: boolean) => {
    let globalIdx = 0;
    return (
      <div className="space-y-4">
        {/* SLA breach header badge (7.7) */}
        {slaBreachCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle size={13} className="text-destructive" />
            <span className="text-[11px] font-bold text-destructive">
              {slaBreachCount} card{slaBreachCount > 1 ? 's' : ''} acima do SLA ({CRM_CONFIG_DEADLINE_DAYS[produto]}d)
            </span>
          </div>
        )}

        {phases.map((phase) => (
          <div key={phase.id} className="space-y-2">
            {/* Header da fase */}
            <div className="px-2.5 py-1.5 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <h3 className="text-[11px] font-bold text-primary uppercase tracking-wide">
                {phase.label}
              </h3>
            </div>

            {/* Steps dentro da fase */}
            {phase.steps.map((stepId) => {
              globalIdx++;
              const stepLabel = CRM_STEP_LABEL[stepId] || stepId;
              const stepConfigs = showCards ? (configsByStep.get(stepId) || []) : [];

              return (
                <div key={stepId} className="space-y-2">
                  {/* Faixa da etapa */}
                  <div className="p-2.5 bg-gradient-to-r from-muted/80 to-muted/60 rounded-xl border border-border/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground">
                        [{globalIdx}] {stepLabel}
                      </h4>
                      {stepConfigs.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {stepConfigs.length}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Cards do passo */}
                  {stepConfigs.map((cfg: any) => {
                    const clientName = cfg.clients?.razao_social || cfg.clients?.name || 'Cliente';
                    const progress = getChecklistProgress(cfg);
                    const breached = isSlaBreached(cfg);

                    return (
                      <Card
                        key={cfg.id}
                        className={cn(
                          'border-subtle hover:shadow-apple-hover transition-shadow',
                          breached && 'border-destructive/50 border-l-2 border-l-destructive'
                        )}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-sm text-foreground line-clamp-2">{clientName}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] gap-1 shrink-0"
                              onClick={() => setSelectedConfig(cfg)}
                            >
                              <Eye size={12} />
                              Ver
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={`${color} border text-[10px]`}>{label}</Badge>
                            {cfg.created_at && (
                              <CrmDeadlineBadge createdAt={cfg.created_at} produto={produto} />
                            )}
                            {/* Checklist progress badge (7.2) */}
                            {progress && (
                              <span className={cn(
                                'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded',
                                progress.done === progress.total
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-muted text-muted-foreground'
                              )}>
                                <ListChecks size={10} />
                                {progress.done}/{progress.total}
                              </span>
                            )}
                            {/* SLA breach icon (7.7) */}
                            {breached && (
                              <AlertTriangle size={11} className="text-destructive" />
                            )}
                          </div>
                          {/* Blocking tags (Esperar Briefing, Esperar TORQUE) */}
                          <ClientTagsList
                            tags={tagsByClient?.get(cfg.client_id) ?? []}
                            size="sm"
                            className="mt-0"
                          />
                          {/* Compact validation gate: shows blocker count + advance button */}
                          <div className="pt-1 border-t border-border/30">
                            <CrmValidationGate
                              configId={cfg.id}
                              produto={produto}
                              compact
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  if (configs.length === 0) {
    return (
      <>
        {renderPhases(false)}
        <div className="text-center py-4 text-muted-foreground">
          <Wrench size={24} className="mx-auto mb-1.5 opacity-40" />
          <p className="text-xs">Nenhum card {label}</p>
          <p className="text-[10px] mt-0.5 opacity-70">Use "Gerar tarefa" no olhinho do cliente</p>
        </div>
        <CrmConfigViewModal
          isOpen={!!selectedConfig}
          onClose={() => setSelectedConfig(null)}
          config={selectedConfig}
        />
      </>
    );
  }

  return (
    <>
      {renderPhases(true)}
      <CrmConfigViewModal
        isOpen={!!selectedConfig}
        onClose={() => setSelectedConfig(null)}
        config={selectedConfig}
      />
    </>
  );
}
