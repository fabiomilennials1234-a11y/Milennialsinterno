import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useComercialPaddockClients } from '@/hooks/useComercialClients';
import { PADDOCK_STEPS, PADDOCK_STEP_LABELS } from '@/hooks/useComercialAutomation';
import PaddockDiagnosticoBadge from './PaddockDiagnosticoBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ClientViewModal from '@/components/client/ClientViewModal';
import ProductBadges, { TorqueCRMProductBadges } from '@/components/shared/ProductBadges';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PendingTask {
  id: string;
  title: string;
  due_date: string | null;
  auto_task_type: string | null;
  status: string;
  related_client_id: string | null;
}

function usePaddockPendingTasks() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['paddock-pending-tasks', user?.id],
    queryFn: async (): Promise<PendingTask[]> => {
      let queryBuilder = supabase
        .from('comercial_tasks')
        .select('id, title, due_date, auto_task_type, status, related_client_id')
        .eq('is_auto_generated', true)
        .neq('status', 'done')
        .or('archived.is.null,archived.eq.false');

      if (user?.role === 'consultor_comercial') {
        queryBuilder = queryBuilder.eq('user_id', user?.id);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return (data || []) as PendingTask[];
    },
    enabled: !!user,
  });
}

function TaskDeadlineBadge({ task }: { task: PendingTask }) {
  if (!task.due_date) return null;

  const due = new Date(task.due_date);
  const now = new Date();
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffHours / 24);

  if (diffHours < 0) {
    const overdueDays = Math.abs(Math.floor(diffHours / 24));
    return (
      <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5 animate-pulse">
        <AlertTriangle size={8} />
        Atrasada {overdueDays}d
      </Badge>
    );
  }

  if (diffHours <= 24) {
    return (
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-warning text-warning">
        <Clock size={8} />
        {Math.ceil(diffHours)}h restantes
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-muted-foreground/30 text-muted-foreground">
      <Clock size={8} />
      {diffDays}d restantes
    </Badge>
  );
}

export default function PaddockOnboardingSection() {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useComercialPaddockClients();
  const { data: tasks = [] } = usePaddockPendingTasks();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [confirmFinalizeId, setConfirmFinalizeId] = useState<string | null>(null);

  const getClientTask = (clientId: string) => {
    return tasks.find(t => t.related_client_id === clientId);
  };

  const finalizeMutation = useMutation({
    mutationFn: async (clientId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('dismiss_client_torque_tag', {
        p_client_id: clientId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('CRM finalizado', { description: 'Etiqueta e cronômetro removidos do cliente' });
      queryClient.invalidateQueries({ queryKey: ['client-tags'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });
      queryClient.invalidateQueries({ queryKey: ['client-tag-delay-pending'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao finalizar CRM', { description: err.message });
    },
  });

  const finalizingClient = clients.find(c => c.id === confirmFinalizeId);

  return (
    <>
      <div className="space-y-3">
        {PADDOCK_STEPS.map((stepId) => {
          const label = PADDOCK_STEP_LABELS[stepId];
          const stepClients = clients.filter(c => c.paddock_onboarding_step === stepId);

          return (
            <div key={stepId} className="space-y-2">
              {/* Step Header Card */}
              <div className="p-3 bg-gradient-to-r from-muted/80 to-muted/60 rounded-xl border border-border/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                  {stepClients.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {stepClients.length}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Client Cards */}
              {stepClients.map((client) => {
                const clientName = client.razao_social || client.name || 'Cliente';
                const pendingTask = getClientTask(client.id);

                return (
                  <Card key={client.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      {/* Diagnostic Badge - Always visible at top */}
                      <PaddockDiagnosticoBadge clientId={client.id} />

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-foreground line-clamp-2">
                            {clientName}
                          </h4>
                          <div className="mt-1 flex flex-col gap-1">
                            <ProductBadges products={(client as any).contracted_products} size="sm" maxVisible={4} />
                            <TorqueCRMProductBadges products={(client as any).torque_crm_products} size="sm" />
                          </div>
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

                      {/* Pending Task with Deadline */}
                      {pendingTask && (
                        <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                          <span className="text-[10px] text-muted-foreground truncate flex-1">
                            {pendingTask.title}
                          </span>
                          <TaskDeadlineBadge task={pendingTask} />
                        </div>
                      )}

                      {/* CRM FINALIZADO — visível só na coluna crm_solicitado e enquanto não finalizado */}
                      {stepId === 'crm_solicitado' && !(client as { crm_finalizado_at?: string | null }).crm_finalizado_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[11px] font-semibold uppercase tracking-wide gap-1.5 border-success/40 text-success hover:bg-success/10 hover:text-success"
                          onClick={() => setConfirmFinalizeId(client.id)}
                        >
                          <CheckCircle2 size={12} />
                          CRM Finalizado
                        </Button>
                      )}
                      {stepId === 'crm_solicitado' && (client as { crm_finalizado_at?: string | null }).crm_finalizado_at && (
                        <div className="w-full h-7 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-success bg-success/10 border border-success/30 rounded-md">
                          <CheckCircle2 size={12} />
                          CRM Finalizado
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}

        {clients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Nenhum cliente em onboarding</p>
          </div>
        )}
      </div>

      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}

      <AlertDialog
        open={!!confirmFinalizeId}
        onOpenChange={(open) => { if (!open) setConfirmFinalizeId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar finalização do CRM</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que o CRM de{' '}
              <span className="font-semibold text-foreground">
                {finalizingClient?.razao_social || finalizingClient?.name || 'este cliente'}
              </span>{' '}
              está pronto? A etiqueta &quot;Esperar Torque ser finalizado&quot; e o cronômetro de 10 dias serão removidos do kanban do gestor de Ads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizeMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!confirmFinalizeId) return;
                finalizeMutation.mutate(confirmFinalizeId, {
                  onSuccess: () => setConfirmFinalizeId(null),
                });
              }}
            >
              {finalizeMutation.isPending ? 'Finalizando…' : 'Sim, está pronto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
