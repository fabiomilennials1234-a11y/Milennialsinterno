import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Eye } from 'lucide-react';
import ClientViewModal from '@/components/client/ClientViewModal';
import ProductBadges, { TorqueCRMProductBadges } from '@/components/shared/ProductBadges';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import { useCrmBoasVindasClientes, getTorqueCrmProducts } from '@/hooks/useCrmKanban';

/**
 * Coluna "Boas-vindas — Novos clientes".
 *
 * Mostra clientes com `crm_status='boas_vindas'`: a tarefa de boas-vindas
 * foi criada (fica em "A fazer") e o cliente aguarda conclusão. Ao concluir
 * a tarefa, o fluxo avança automaticamente para "Acompanhamento diário"
 * no dia útil real da conclusão (lógica em useDepartmentTasks).
 */
export default function CrmBoasVindasSection() {
  const { data: clients = [], isLoading } = useCrmBoasVindasClientes();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum cliente em boas-vindas</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {clients.map((client: any) => {
          const name = client.razao_social || client.name || 'Cliente';
          const torqueProducts = getTorqueCrmProducts(client);
          return (
            <Card key={client.id} className="border-subtle">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-medium text-sm text-foreground line-clamp-1">{name}</h4>
                        <ClientLabelBadge
                          label={((client.client_label ?? null) as ClientLabel)}
                          size="sm"
                          className="shrink-0"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] gap-1 shrink-0"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <Eye size={12} />
                      Ver
                    </Button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <ProductBadges products={client.contracted_products} size="sm" maxVisible={4} />
                    {torqueProducts.length > 0 && (
                      <TorqueCRMProductBadges products={torqueProducts} size="sm" />
                    )}
                  </div>

                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Sparkles size={10} className="text-emerald-500" />
                    Aguardando conclusão da tarefa de boas-vindas
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen={true}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}
