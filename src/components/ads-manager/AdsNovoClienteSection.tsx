import { useState } from 'react';
import { useAssignedClients } from '@/hooks/useAdsManager';
import { useOnboardingTasks, getDaysSinceCreation, TASK_TYPE_LABELS } from '@/hooks/useOnboardingTasks';
import { useAutoCreateTaskForNewClients } from '@/hooks/useOnboardingAutomation';
import { UserPlus, ArrowRight, Clock, Building2, Timer, CheckCircle, Target, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';

export default function AdsNovoClienteSection() {
  const { data: clients = [], isLoading: clientsLoading } = useAssignedClients();
  const { data: tasks = [], isLoading: tasksLoading } = useOnboardingTasks();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Auto-create tasks for new clients
  useAutoCreateTaskForNewClients(clients);

  // Filter new clients and get their pending tasks
  const newClients = clients.filter(c => c.status === 'new_client');
  
  // Get pending tasks for display
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const isLoading = clientsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Get the current pending task for a client
  const getClientPendingTask = (clientId: string) => {
    return pendingTasks.find(t => t.client_id === clientId);
  };

  return (
    <>
      <div className="space-y-3">
        {/* Info Box */}
        <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
          <strong className="text-foreground">Nota:</strong> Clientes criados pelo Gestor de Projetos aparecem aqui. Complete as tarefas para avançar o onboarding.
        </div>

        {/* Clients List */}
        <div className="space-y-2">
          {newClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="mx-auto mb-2 opacity-50" size={32} />
              <p className="font-medium text-sm">Nenhum cliente novo</p>
              <p className="text-xs mt-1">Aguarde novos clientes</p>
            </div>
          ) : (
            newClients.map(client => {
              const pendingTask = getClientPendingTask(client.id);
              const daysSinceCreation = differenceInDays(new Date(), new Date(client.created_at));
              const isOverdue = pendingTask?.due_date && new Date(pendingTask.due_date) < new Date();

              return (
                <div
                  key={client.id}
                  className={cn(
                    "p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors",
                    isOverdue && "border-danger/50 bg-danger/5"
                  )}
                >
                  {/* Overdue Invoice Badge */}
                  <OverdueInvoiceBadge clientId={client.id} className="w-full justify-center mb-2" />
                  {/* Contract Status Badge */}
                  <ContractStatusBadge clientId={client.id} className="w-full justify-center mb-2" />
                  
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{client.name}</h4>
                          <ClientLabelBadge
                            label={((client.client_label ?? null) as ClientLabel)}
                            size="sm"
                            className="shrink-0"
                          />
                        </div>
                        {client.razao_social && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {client.razao_social}
                          </p>
                        )}
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
                          CNPJ
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {format(new Date(client.created_at), 'dd/MM', { locale: ptBR })}
                      </span>
                    </div>

                    {client.expected_investment && (
                      <p className="text-xs text-green-400">
                        R$ {client.expected_investment.toLocaleString('pt-BR')}
                      </p>
                    )}

                    {/* Current Task Display */}
                    {pendingTask && (
                      <div className={cn(
                        "p-2 rounded-lg border text-xs",
                        isOverdue ? "bg-danger/10 border-danger/30" : "bg-primary/10 border-primary/30"
                      )}>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Target size={12} className={isOverdue ? "text-danger" : "text-primary"} />
                          <span>{pendingTask.title}</span>
                        </div>
                        {pendingTask.due_date && (
                          <p className={cn(
                            "text-[10px] mt-1",
                            isOverdue ? "text-danger" : "text-muted-foreground"
                          )}>
                            Prazo: {format(new Date(pendingTask.due_date), 'dd/MM HH:mm', { locale: ptBR })}
                            {isOverdue && ' (Atrasado!)'}
                          </p>
                        )}
                      </div>
                    )}

                    <Button 
                      size="sm" 
                      className="w-full gap-1" 
                      variant="outline"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <Eye size={12} />
                      Ver Cliente
                      <ArrowRight size={12} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
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
