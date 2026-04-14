import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCrmConfiguracoes,
  CRM_PRODUTO_LABEL,
  CRM_PRODUTO_COLOR,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import CrmConfigViewModal from './CrmConfigViewModal';
import CrmDeadlineBadge from './CrmDeadlineBadge';

/**
 * Coluna "CRMs Finalizados" — lista todas as configurações com
 * `is_finalizado=true` (V8 / Automation / Copilot, independentes).
 *
 * Cada card continua vinculado ao produto de origem e preserva os dados
 * do formulário. Finalizar uma configuração NÃO encerra as demais do
 * mesmo cliente.
 */
export default function CrmFinalizadosSection() {
  const { data: configs = [], isLoading } = useCrmConfiguracoes({ finalizado: true });
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);

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
        <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum CRM finalizado</p>
      </div>
    );
  }

  // Ordena por finalizado_at desc (mais recentes primeiro)
  const sorted = [...configs].sort((a: any, b: any) => {
    const da = a.finalizado_at ? new Date(a.finalizado_at).getTime() : 0;
    const db = b.finalizado_at ? new Date(b.finalizado_at).getTime() : 0;
    return db - da;
  });

  return (
    <>
      <div className="space-y-2">
        {sorted.map((cfg: any) => {
          const clientName = cfg.clients?.razao_social || cfg.clients?.name || 'Cliente';
          const produto = cfg.produto as CrmProduto;
          const label = CRM_PRODUTO_LABEL[produto];
          const color = CRM_PRODUTO_COLOR[produto];
          const finalizadoDate = cfg.finalizado_at ? parseISO(cfg.finalizado_at) : null;

          return (
            <Card key={cfg.id} className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                      <h4 className="font-medium text-sm text-foreground line-clamp-1">{clientName}</h4>
                    </div>
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
                    <CrmDeadlineBadge createdAt={cfg.created_at} produto={produto} finalizado />
                  )}
                </div>

                {finalizadoDate && (
                  <p className="text-[10px] text-emerald-700">
                    Finalizado em {format(finalizadoDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
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
