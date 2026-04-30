import { useState } from 'react';
import { Calendar, Eye, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useComercialClientsByStatus, getDaysSinceOnboardingStart } from '@/hooks/useComercialClients';
import { useComercialTasksByClient } from '@/hooks/useComercialTasks';
import { useCompleteComercialTaskWithAutomation, AUTO_TASK_TYPES } from '@/hooks/useComercialAutomation';
import ClientViewModal from '@/components/client/ClientViewModal';
import { fireCelebration } from '@/lib/confetti';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ProductBadges, { TorqueCRMProductBadges } from '@/components/shared/ProductBadges';
import { cn } from '@/lib/utils';

function getTaskDeadlineInfo(dueDate?: string) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffHours <= 0) {
    const overdueHours = Math.abs(diffHours);
    const overdueDays = Math.floor(overdueHours / 24);
    return {
      label: overdueDays > 0 ? `Atrasada ${overdueDays}d` : `Atrasada ${overdueHours}h`,
      isOverdue: true,
      isUrgent: true,
    };
  }
  if (diffHours <= 6) {
    return { label: `${diffHours}h restantes`, isOverdue: false, isUrgent: true };
  }
  if (diffHours <= 24) {
    return { label: `${diffHours}h restantes`, isOverdue: false, isUrgent: false };
  }
  const diffDays = Math.ceil(diffHours / 24);
  return { label: `${diffDays}d restantes`, isOverdue: false, isUrgent: false };
}

function ClientCard({ client }: { client: any }) {
  const [showModal, setShowModal] = useState(false);
  const { data: tasks = [] } = useComercialTasksByClient(client.id);
  const completeTask = useCompleteComercialTaskWithAutomation();
  
  const days = getDaysSinceOnboardingStart(client.comercial_onboarding_started_at);
  const isDelayed = days >= 5;
  const pendingTask = tasks.find(
    t => t.status !== 'done' && t.auto_task_type === AUTO_TASK_TYPES.REALIZAR_CONSULTORIA
  );

  const handleCompleteTask = async () => {
    if (!pendingTask) return;
    
    // When completing "Realizar consultoria", client goes directly to Acompanhamento
    await completeTask.mutateAsync({
      taskId: pendingTask.id,
      taskType: pendingTask.auto_task_type,
      clientId: client.id,
      clientName: client.name,
      managerId: client.assigned_ads_manager,
      managerName: client.assigned_ads_manager_name || 'Gestor',
    });
    fireCelebration();
  };

  return (
    <>
      <div 
        className={`p-3 rounded-lg border transition-all ${
          isDelayed 
            ? 'bg-destructive/10 border-destructive/30' 
            : 'bg-card border-subtle hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-medium text-sm truncate">{client.name}</h3>
              <ClientLabelBadge
                label={((client.client_label ?? null) as ClientLabel)}
                size="sm"
                className="shrink-0"
              />
            </div>
            {client.niche && (
              <p className="text-xs text-muted-foreground truncate">{client.niche}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setShowModal(true)}
          >
            <Eye size={12} />
          </Button>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <ProductBadges products={client.contracted_products} size="sm" maxVisible={3} />
          <TorqueCRMProductBadges products={client.torque_crm_products} size="sm" />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Calendar size={10} className={isDelayed ? 'text-destructive' : 'text-muted-foreground'} />
          <span className={`text-xs ${isDelayed ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {days} dia{days !== 1 ? 's' : ''} no onboarding
          </span>
          {isDelayed && (
            <AlertTriangle size={10} className="text-destructive" />
          )}
        </div>

        {pendingTask && (() => {
          const deadlineInfo = getTaskDeadlineInfo(pendingTask.due_date);
          return (
            <div className="mt-2 pt-2 border-t border-subtle space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {pendingTask.title}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2 shrink-0"
                  onClick={handleCompleteTask}
                  disabled={completeTask.isPending}
                >
                  <CheckCircle2 size={10} className="mr-1" />
                  Concluir
                </Button>
              </div>
              {deadlineInfo && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 gap-0.5 w-fit",
                    deadlineInfo.isOverdue
                      ? "border-destructive text-destructive bg-destructive/10 animate-pulse"
                      : deadlineInfo.isUrgent
                      ? "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/20"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {deadlineInfo.isOverdue ? (
                    <AlertTriangle size={8} className="mr-0.5" />
                  ) : (
                    <Timer size={8} className="mr-0.5" />
                  )}
                  {deadlineInfo.label}
                </Badge>
              )}
            </div>
          );
        })()}
      </div>

      <ClientViewModal
        key={client.id}
        isOpen={showModal}
        clientId={client.id}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

export default function ComercialConsultoriaMarcadaSection() {
  const { data: clients = [], isLoading } = useComercialClientsByStatus('consultoria_marcada');

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Calendar className="mx-auto mb-2 opacity-50" size={28} />
        <p className="text-sm font-medium">Nenhuma consultoria marcada</p>
        <p className="text-xs mt-1">Clientes aparecerão após marcar consultoria</p>
      </div>
    );
  }

  const delayedCount = clients.filter(c => getDaysSinceOnboardingStart(c.comercial_onboarding_started_at) >= 5).length;

  return (
    <div className="space-y-2">
      {delayedCount > 0 && (
        <div className="p-2 bg-destructive/10 rounded-lg border border-destructive/30">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={14} />
            <span className="text-xs font-medium">
              {delayedCount} há mais de 5 dias
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
