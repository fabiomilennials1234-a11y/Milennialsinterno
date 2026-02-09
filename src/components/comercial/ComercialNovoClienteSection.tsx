import { useState } from 'react';
import { Clock, AlertTriangle, Eye, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useComercialNewClients, getHoursSinceEntry } from '@/hooks/useComercialClients';
import { useComercialTasksByClient } from '@/hooks/useComercialTasks';
import { useAutoCreateTasksForNewClients, useCompleteComercialTaskWithAutomation, AUTO_TASK_TYPES } from '@/hooks/useComercialAutomation';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import { fireCelebration } from '@/lib/confetti';

function ClientCard({ client }: { client: any }) {
  const [showModal, setShowModal] = useState(false);
  const { data: tasks = [] } = useComercialTasksByClient(client.id);
  const completeTask = useCompleteComercialTaskWithAutomation();
  
  const hours = getHoursSinceEntry(client.comercial_entered_at);
  const isDelayed = hours >= 24;
  const pendingTask = tasks.find(
    t => t.status !== 'done' && t.auto_task_type === AUTO_TASK_TYPES.MARCAR_CONSULTORIA
  );

  const handleCompleteTask = async () => {
    if (!pendingTask) return;
    
    await completeTask.mutateAsync({
      taskId: pendingTask.id,
      taskType: pendingTask.auto_task_type,
      clientId: client.id,
      clientName: client.name,
    });
    fireCelebration();
  };

  return (
    <>
      <div 
        className={`p-4 rounded-xl border transition-all ${
          isDelayed 
            ? 'bg-destructive/10 border-destructive/30' 
            : 'bg-card border-subtle hover:shadow-md'
        }`}
      >
        {/* Overdue Invoice Badge */}
        <OverdueInvoiceBadge clientId={client.id} className="w-full justify-center mb-2" />
        {/* Contract Status Badge */}
        <ContractStatusBadge clientId={client.id} className="w-full justify-center mb-2" />
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-sm truncate">{client.name}</h3>
              <ClientLabelBadge
                label={((client.client_label ?? null) as ClientLabel)}
                size="sm"
                className="shrink-0"
              />
            </div>
            {client.razao_social && (
              <p className="text-xs text-muted-foreground truncate">{client.razao_social}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setShowModal(true)}
          >
            <Eye size={14} />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Clock size={12} className={isDelayed ? 'text-destructive' : 'text-muted-foreground'} />
          <span className={`text-xs ${isDelayed ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {hours}h na fila
          </span>
          {isDelayed && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              <AlertTriangle size={10} className="mr-1" />
              +24h
            </Badge>
          )}
        </div>

        {pendingTask && (
          <div className="mt-3 pt-3 border-t border-subtle">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{pendingTask.title}</p>
                <p className="text-xs text-muted-foreground">
                  {pendingTask.status === 'todo' ? 'A fazer' : 'Fazendo'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={handleCompleteTask}
                disabled={completeTask.isPending}
              >
                <CheckCircle2 size={12} className="mr-1" />
                Concluir
              </Button>
            </div>
          </div>
        )}
      </div>

      <ClientViewModal
        isOpen={showModal}
        clientId={client.id}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

export default function ComercialNovoClienteSection() {
  const { data: clients = [], isLoading } = useComercialNewClients();
  
  // Auto-create tasks for new clients
  useAutoCreateTasksForNewClients();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="mx-auto mb-2 opacity-50" size={32} />
        <p className="text-sm font-medium">Nenhum cliente novo</p>
        <p className="text-xs mt-1">Clientes do cadastro aparecerão aqui</p>
      </div>
    );
  }

  const delayedCount = clients.filter(c => getHoursSinceEntry(c.comercial_entered_at) >= 24).length;

  return (
    <div className="space-y-3">
      {delayedCount > 0 && (
        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">
              {delayedCount} cliente{delayedCount > 1 ? 's' : ''} há mais de 24h
            </span>
          </div>
        </div>
      )}

      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
}
