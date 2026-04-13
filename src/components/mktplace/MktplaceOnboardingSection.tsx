import { useState } from 'react';
import { useMktplaceClients, MKTPLACE_CONSULTORIA_STEPS, MKTPLACE_GESTAO_STEPS } from '@/hooks/useMktplaceKanban';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientViewModal from '@/components/client/ClientViewModal';

const CONSULTORIA_STEP_LABELS: Record<string, string> = {
  consultoria_marcada: '[ 1 ] Consultoria Marcada',
  enviar_diagnostico: '[ 2 ] Enviar Diagnóstico de Mudanças',
  diagnostico_enviado: '[ 3 ] Diagnóstico Enviado',
};

const GESTAO_STEP_LABELS: Record<string, string> = {
  onboarding_marcado: '[ 1 ] Onboarding Marcado',
  apresentar_estrategia: '[ 2 ] Apresentar Estratégia',
  estrategia_apresentada: '[ 3 ] Estratégia Apresentada',
  acessos_pegados: '[ 4 ] Acessos MKT Place Pegados',
  iniciar_plano: '[ 5 ] Iniciar Plano de Ações',
};

const COLUMNS = [
  {
    id: 'consultoria',
    title: 'Onboarding Consultoria de MKT Place',
    headerClass: 'bg-gradient-to-r from-blue-600 to-blue-700',
    steps: MKTPLACE_CONSULTORIA_STEPS,
    labels: CONSULTORIA_STEP_LABELS,
    isGestao: false,
  },
  {
    id: 'gestao',
    title: 'Onboarding Gestão de MKT Place',
    headerClass: 'bg-gradient-to-r from-purple-600 to-purple-700',
    steps: MKTPLACE_GESTAO_STEPS,
    labels: GESTAO_STEP_LABELS,
    isGestao: true,
  },
];

export default function MktplaceOnboardingSection() {
  const { data: clients = [] } = useMktplaceClients();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  return (
    <>
      {COLUMNS.map((column) => {
        const columnClients = clients.filter((c: any) =>
          (column.steps as readonly string[]).includes(c.mktplace_status)
        );

        return (
          <div
            key={column.id}
            className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple"
          >
            {/* Column Header */}
            <div className={cn('px-4 py-3', column.headerClass)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-white" />
                  <span className="font-semibold text-sm text-white">{column.title}</span>
                </div>
                {columnClients.length > 0 && (
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                    {columnClients.length}
                  </Badge>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-apple bg-card">
              {column.steps.map((stepId) => {
                const label = column.labels[stepId];
                const stepClients = clients.filter(
                  (c: any) => c.mktplace_status === stepId
                );

                return (
                  <div key={stepId} className="space-y-2">
                    {/* Step Header Card */}
                    <div className="p-3 bg-gradient-to-r from-muted/80 to-muted/60 rounded-xl border border-border/50 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                        <div className="w-8 h-8 flex items-center justify-center">
                          <span className="text-primary/30 text-2xl font-serif italic">M</span>
                        </div>
                      </div>
                    </div>

                    {/* Client Cards */}
                    {stepClients.map((client: any) => {
                      const clientName = client.razao_social || client.name || 'Cliente';

                      return (
                        <Card key={client.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm text-foreground line-clamp-2">
                                  {clientName}
                                </h4>
                                {client.monthly_value && client.monthly_value > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    R$ {Number(client.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] gap-0.5 shrink-0"
                                onClick={() => setSelectedClientId(client.id)}
                              >
                                <Eye size={10} />
                                Ver
                              </Button>
                            </div>

                            {/* Avanço é automático pela conclusão da tarefa */}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}
