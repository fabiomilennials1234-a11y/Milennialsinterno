import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus, Eye } from 'lucide-react';
import ClientViewModal from '@/components/client/ClientViewModal';
import ProductBadges, { TorqueCRMProductBadges } from '@/components/shared/ProductBadges';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import {
  useCrmNovosClientes,
  useCreateCrmWelcomeTask,
  getTorqueCrmProducts,
} from '@/hooks/useCrmKanban';

/**
 * Coluna "Novos clientes" do kanban do Gestor de CRM.
 *
 * Exibe cada cliente com:
 *   - Nome + razão social
 *   - Etiquetas dos produtos Torque CRM (V8 / Automation / Copilot)
 *   - ClientLabelBadge
 *   - Olhinho para abrir ClientViewModal
 *
 * Ao montar, cria automaticamente a tarefa de boas-vindas para cada cliente
 * com status='novo' e move o cliente para 'boas_vindas'. Idempotente.
 */
export default function CrmNovoClienteSection() {
  const { data: clients = [], isLoading } = useCrmNovosClientes();
  const createWelcomeTask = useCreateCrmWelcomeTask();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // Auto-cria tarefa de boas-vindas + move cliente para 'boas_vindas'
  useEffect(() => {
    if (!clients.length) return;
    const pending = clients.filter((c: any) => !processedIds.has(c.id));
    if (!pending.length) return;

    const newIds = new Set(processedIds);
    pending.forEach((client: any) => {
      const name = client.razao_social || client.name || 'Cliente';
      const gestorId = client.assigned_crm;
      if (!gestorId) return; // sem gestor, não cria
      createWelcomeTask.mutate({ clientId: client.id, clientName: name, gestorId });
      newIds.add(client.id);
    });
    setProcessedIds(newIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length]);

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
        <UserPlus size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum cliente novo</p>
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
            <Card key={client.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
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
                      {client.razao_social && client.razao_social !== client.name && (
                        <p className="text-[10px] text-muted-foreground truncate">{client.razao_social}</p>
                      )}
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

                  {/* Etiquetas de produtos (principal + sub-produtos Torque CRM) */}
                  <div className="flex flex-col gap-1.5">
                    <ProductBadges products={client.contracted_products} size="sm" maxVisible={4} />
                    {torqueProducts.length > 0 && (
                      <TorqueCRMProductBadges products={torqueProducts} size="sm" />
                    )}
                  </div>

                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Gestão de CRM
                  </Badge>
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
