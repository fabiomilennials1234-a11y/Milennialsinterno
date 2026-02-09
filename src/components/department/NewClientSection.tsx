import { useState } from 'react';
import { DepartmentClient } from '@/hooks/useDepartmentManager';
import { UserPlus, Clock, Building2, Timer, DollarSign, Eye, ArrowRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';

interface NewClientSectionProps {
  clients: DepartmentClient[];
  isLoading: boolean;
  emptyMessage?: string;
}

export default function NewClientSection({ 
  clients, 
  isLoading,
  emptyMessage = "Nenhum cliente novo" 
}: NewClientSectionProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Filter new clients
  const newClients = clients.filter(c => c.status === 'new_client' && !c.archived);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (newClients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserPlus className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">{emptyMessage}</p>
        <p className="text-xs mt-1">Aguarde novos clientes</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Info Box */}
        <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-xs">
          <strong className="text-success">Novos Clientes:</strong>{' '}
          <span className="text-muted-foreground">
            {newClients.length} cliente{newClients.length !== 1 ? 's' : ''} novo{newClients.length !== 1 ? 's' : ''} aguardando processamento.
          </span>
        </div>

        {/* Clients List */}
        <div className="space-y-2">
          {newClients.map(client => {
            const daysSinceCreation = differenceInDays(new Date(), new Date(client.created_at));

            return (
              <div
                key={client.id}
                className="p-3 bg-card border border-border rounded-lg hover:border-success/50 transition-colors"
              >
                {/* Overdue Invoice Badge */}
                <OverdueInvoiceBadge clientId={client.id} className="w-full justify-center mb-2" />
                {/* Contract Status Badge */}
                <ContractStatusBadge clientId={client.id} className="w-full justify-center mb-2" />
                
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                        <UserPlus size={14} className="text-success" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{client.name}</h4>
                        {client.razao_social && (
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {client.razao_social}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                      daysSinceCreation > 3 ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
                    )}>
                      <Timer size={10} />
                      {daysSinceCreation} {daysSinceCreation === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {client.cnpj && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        CNPJ: {client.cnpj}
                      </span>
                    )}
                    {client.cpf && !client.cnpj && (
                      <span className="flex items-center gap-1">
                        CPF: {client.cpf}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {format(new Date(client.created_at), 'dd/MM', { locale: ptBR })}
                    </span>
                  </div>

                  {client.expected_investment && (
                    <div className="flex items-center gap-1 text-xs text-success font-medium">
                      <DollarSign size={12} />
                      R$ {client.expected_investment.toLocaleString('pt-BR')}
                    </div>
                  )}

                  {/* Client Label Badge */}
                  {client.client_label && (
                    <div className="flex justify-start">
                      <ClientLabelBadge label={client.client_label} size="sm" />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="px-2 py-1 bg-success/10 rounded text-[10px] text-success font-medium inline-block">
                      NOVO CLIENTE
                    </div>
                    <div className="flex items-center gap-1">
                      <ClientLabelSelector 
                        clientId={client.id} 
                        currentLabel={client.client_label} 
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-primary hover:text-primary"
                        onClick={() => setSelectedClientId(client.id)}
                      >
                        Ver Cliente
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client View Modal */}
      {selectedClientId && (
        <ClientViewModal
          isOpen={!!selectedClientId}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}
