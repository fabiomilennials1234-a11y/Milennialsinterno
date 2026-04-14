import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Wrench } from 'lucide-react';
import {
  useCrmConfiguracoes,
  CRM_PRODUTO_LABEL,
  CRM_PRODUTO_COLOR,
  CRM_STEP_LABEL,
  CRM_STEPS_BY_PRODUTO,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import CrmConfigViewModal from './CrmConfigViewModal';
import CrmDeadlineBadge from './CrmDeadlineBadge';

interface Props {
  produto: CrmProduto;
}

/**
 * Coluna de configuração de um produto (V8 / Automation / Copilot).
 *
 * Renderiza uma faixa por etapa da state-machine do produto (padrão
 * visual do Paddock Onboarding) — cada etapa é uma barra cinza com
 * numeração `[N] Nome da etapa`. Os cards dos clientes aparecem logo
 * abaixo da faixa da etapa ATUAL deles.
 *
 * Independência total: cada crm_configuracoes tem seu próprio
 * current_step, então nada compartilha avanço entre cards.
 */
export default function CrmConfigColumnSection({ produto }: Props) {
  const { data: configs = [], isLoading } = useCrmConfiguracoes({ produto, finalizado: false });
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);

  const label = CRM_PRODUTO_LABEL[produto];
  const color = CRM_PRODUTO_COLOR[produto];
  const steps = CRM_STEPS_BY_PRODUTO[produto];

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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (configs.length === 0) {
    // Mesmo sem cards, mostra as etapas vazias para o gestor enxergar o fluxo
    return (
      <>
        <div className="space-y-2">
          {steps.map((stepId, idx) => {
            const stepLabel = CRM_STEP_LABEL[stepId] || stepId;
            return (
              <div
                key={stepId}
                className="p-2.5 bg-gradient-to-r from-muted/80 to-muted/60 rounded-xl border border-border/50 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">
                    [{idx + 1}] {stepLabel}
                  </h4>
                </div>
              </div>
            );
          })}
          <div className="text-center py-4 text-muted-foreground">
            <Wrench size={24} className="mx-auto mb-1.5 opacity-40" />
            <p className="text-xs">Nenhum card {label}</p>
            <p className="text-[10px] mt-0.5 opacity-70">Use "Gerar tarefa" no olhinho do cliente</p>
          </div>
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
      <div className="space-y-3">
        {steps.map((stepId, idx) => {
          const stepLabel = CRM_STEP_LABEL[stepId] || stepId;
          const stepConfigs = configsByStep.get(stepId) || [];

          return (
            <div key={stepId} className="space-y-2">
              {/* Faixa da etapa (igual Paddock Onboarding) */}
              <div className="p-2.5 bg-gradient-to-r from-muted/80 to-muted/60 rounded-xl border border-border/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">
                    [{idx + 1}] {stepLabel}
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
                return (
                  <Card key={cfg.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>

      <CrmConfigViewModal
        isOpen={!!selectedConfig}
        onClose={() => setSelectedConfig(null)}
        config={selectedConfig}
      />
    </>
  );
}
