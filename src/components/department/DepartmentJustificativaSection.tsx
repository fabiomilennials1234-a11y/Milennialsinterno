import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAddJustification } from '@/hooks/useTaskJustification';
import { useTaskDelayJustificationsByRole, ROLE_LABELS } from '@/hooks/useTaskDelayNotifications';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import JustificationModal from '@/components/shared/JustificationModal';

interface Props {
  department: string;
  compact?: boolean;
}

interface OverdueTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  task_type: string;
  justification: string | null;
  justification_at: string | null;
  created_at: string;
}

export default function DepartmentJustificativaSection({ department, compact }: Props) {
  const { user } = useAuth();
  const [justificationModal, setJustificationModal] = useState<{ open: boolean; task?: OverdueTask }>({ open: false });
  
  const addJustification = useAddJustification('department_tasks', ['department-overdue-tasks', department]);
  
  // Fetch overdue tasks for this department
  const { data: overdueTasks = [], isLoading } = useQuery({
    queryKey: ['department-overdue-tasks', department, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department_tasks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('department', department)
        .eq('archived', false)
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      // Filter to only include truly overdue tasks and cast as any to handle justification fields
      const tasks = (data || []) as any[];
      return tasks.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      }) as OverdueTask[];
    },
    enabled: !!user?.id,
  });

  // Fetch justificativas de tarefas atrasadas DESTE CARGO (não do usuário logado)
  const { data: justificationsByRole, isLoading: adsLoading } = useTaskDelayJustificationsByRole(department);
  const adsDelayJustifications = justificationsByRole?.active || [];
  
  // Verifica se o departamento deve mostrar justificativas de Ads
  const showAdsJustifications = ['sucesso_cliente', 'gestor_projetos'].includes(department);

  const pendingJustifications = overdueTasks.filter(t => !t.justification);
  const justifiedTasks = overdueTasks.filter(t => !!t.justification);

  if (isLoading || adsLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (compact) {
    const pendingCount = pendingJustifications.length;
    const adsJustifiedCount = showAdsJustifications ? adsDelayJustifications.length : 0;
    
    return (
      <div className="space-y-3">
        <div className={cn(
          "p-3 rounded-lg text-center",
          pendingCount > 0 ? "bg-danger/20" : "bg-success/20"
        )}>
          <p className={cn(
            "font-bold text-2xl",
            pendingCount > 0 ? "text-danger" : "text-success"
          )}>
            {pendingCount}
          </p>
          <p className="text-xs text-muted-foreground">Pendências</p>
        </div>
        {pendingCount > 0 && (
          <div className="p-2 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger">
            <AlertTriangle size={12} className="inline mr-1" />
            Justifique os atrasos!
          </div>
        )}
        {adsJustifiedCount > 0 && (
          <div className="p-2 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning">
            <CheckCircle size={12} className="inline mr-1" />
            {adsJustifiedCount} justificativa(s) de Ads
          </div>
        )}
      </div>
    );
  }

  // Se mostrar justificativas de Ads, usar tabs
  if (showAdsJustifications) {
    return (
      <>
        <Tabs defaultValue="my-tasks" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-3">
            <TabsTrigger value="my-tasks" className="text-xs">
              Minhas Tarefas ({overdueTasks.length})
            </TabsTrigger>
            <TabsTrigger value="ads-tasks" className="text-xs">
              Tarefas Ads ({adsDelayJustifications.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-tasks" className="space-y-3">
            {renderOverdueTasks()}
          </TabsContent>

          <TabsContent value="ads-tasks" className="space-y-3">
            {renderAdsJustifications()}
          </TabsContent>
        </Tabs>

        {/* Justification Modal */}
        <JustificationModal
          isOpen={justificationModal.open}
          onClose={() => setJustificationModal({ open: false })}
          onSubmit={async (justification) => {
            if (justificationModal.task) {
              await addJustification.mutateAsync({
                taskId: justificationModal.task.id,
                justification,
              });
            }
          }}
          taskTitle={justificationModal.task?.title}
          existingJustification={justificationModal.task?.justification}
          isPending={addJustification.isPending}
        />
      </>
    );
  }

  // Renderização normal sem tabs
  return (
    <div className="space-y-3">
      {renderOverdueTasks()}

      {/* Justification Modal */}
      <JustificationModal
        isOpen={justificationModal.open}
        onClose={() => setJustificationModal({ open: false })}
        onSubmit={async (justification) => {
          if (justificationModal.task) {
            await addJustification.mutateAsync({
              taskId: justificationModal.task.id,
              justification,
            });
          }
        }}
        taskTitle={justificationModal.task?.title}
        existingJustification={justificationModal.task?.justification}
        isPending={addJustification.isPending}
      />
    </div>
  );

  function renderOverdueTasks() {
    return (
      <>
        {/* Alert Banner (if pending) */}
        {pendingJustifications.length > 0 && (
          <div className="p-3 bg-danger/20 border border-danger/50 rounded-lg">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={16} />
              <p className="font-medium text-sm">{pendingJustifications.length} pendência(s) sem justificativa</p>
            </div>
          </div>
        )}

        {/* List */}
        <div className="space-y-2">
          {overdueTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="text-success" size={20} />
              </div>
              <p className="font-medium text-sm">Tudo em dia!</p>
              <p className="text-xs mt-1">Nenhuma tarefa atrasada</p>
            </div>
          ) : (
            overdueTasks.map(task => {
              const hasJustification = !!task.justification;
              
              return (
                <div
                  key={task.id}
                  className={cn(
                    "p-3 bg-card border rounded-lg transition-colors",
                    hasJustification ? "border-warning/50" : "border-danger/50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1 text-xs text-danger">
                          <Clock size={10} />
                          Venceu em {format(new Date(task.due_date), 'dd/MM HH:mm', { locale: ptBR })}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">
                          • {task.task_type === 'daily' ? 'Diária' : 'Semanal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Justification Section */}
                  <div className="mt-3">
                    {hasJustification ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-warning/10 text-warning text-xs rounded-md cursor-pointer">
                              <CheckCircle size={12} />
                              <span className="font-medium">Justificado</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{task.justification}</p>
                            {task.justification_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Em {format(new Date(task.justification_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary */}
        {overdueTasks.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total: {overdueTasks.length} atrasada(s)</span>
              <span className={cn(
                "font-medium",
                pendingJustifications.length > 0 ? "text-danger" : "text-success"
              )}>
                {justifiedTasks.length}/{overdueTasks.length} justificadas
              </span>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderAdsJustifications() {
    return (
      <div className="space-y-2">
        {adsDelayJustifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/30 flex items-center justify-center">
              <CheckCircle className="text-muted-foreground" size={20} />
            </div>
            <p className="font-medium text-sm">Nenhuma justificativa</p>
            <p className="text-xs mt-1">Nenhuma justificativa do cargo {ROLE_LABELS[department] || department}</p>
          </div>
        ) : (
          adsDelayJustifications.map((item: any) => {
            const notification = item.notification;
            const userName = item.profile?.name || 'Usuário';
            
            return (
              <div
                key={item.id}
                className="p-3 bg-card border border-warning/30 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={14} className="text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {notification?.task_title || 'Tarefa'}
                    </p>
                    
                    <p className="text-xs text-muted-foreground">
                      Justificado por: {userName}
                    </p>
                    
                    <div className="mt-2 p-2 bg-muted/30 rounded-md">
                      <p className="text-xs text-foreground">{item.justification}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock size={10} />
                      <span>
                        {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }
}
