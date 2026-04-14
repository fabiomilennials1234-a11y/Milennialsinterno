import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Wrench, Clock } from 'lucide-react';
import {
  useCrmConfiguracoes,
  CRM_PRODUTO_LABEL,
  CRM_PRODUTO_COLOR,
  CRM_STEP_LABEL,
  CRM_STEPS_BY_PRODUTO,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import CrmConfigViewModal from './CrmConfigViewModal';

interface Props {
  produto: CrmProduto;
}

/**
 * Coluna de configuração de um produto (V8 / Automation / Copilot).
 *
 * Lista cards onde `crm_configuracoes.produto = {produto}` e
 * `is_finalizado = false`. Cada card:
 *   - Nome do cliente
 *   - Etiqueta do produto (única deste card, não compartilhada)
 *   - Etapa atual + % de progresso na state-machine
 *   - Olhinho para abrir os dados do formulário (CrmConfigViewModal)
 *
 * Independência total: conclusão/avanço em outro produto do mesmo cliente
 * não afeta este card (cada linha em crm_configuracoes tem seu próprio
 * `current_step` e `is_finalizado`).
 */
export default function CrmConfigColumnSection({ produto }: Props) {
  const { data: configs = [], isLoading } = useCrmConfiguracoes({ produto, finalizado: false });
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);

  const label = CRM_PRODUTO_LABEL[produto];
  const color = CRM_PRODUTO_COLOR[produto];
  const steps = CRM_STEPS_BY_PRODUTO[produto];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wrench size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum card {label}</p>
        <p className="text-[11px] mt-1 opacity-70">Use "Gerar tarefa" no olhinho do cliente</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {configs.map((cfg: any) => {
          const clientName = cfg.clients?.razao_social || cfg.clients?.name || 'Cliente';
          const stepIdx = steps.indexOf(cfg.current_step);
          const progress = stepIdx >= 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0;
          const stepLabel = CRM_STEP_LABEL[cfg.current_step] || cfg.current_step;

          return (
            <Card key={cfg.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-sm text-foreground line-clamp-1">{clientName}</h4>
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

                <Badge className={`${color} border text-[10px]`}>{label}</Badge>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock size={10} />
                    <span className="line-clamp-1">{stepLabel}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Etapa {stepIdx + 1} de {steps.length}
                  </p>
                </div>
              </CardContent>
            </Card>
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
