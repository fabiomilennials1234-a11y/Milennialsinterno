import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  Zap,
  Package,
  ListTodo,
  Calendar,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useActionPlanTasks,
  useToggleActionPlanTask,
  useUpdateActionPlanStatus,
  useDeleteActionPlan,
  PROBLEM_TYPES,
  SEVERITY_CONFIG,
  type ActionPlan,
  type Severity,
} from '@/hooks/useCSActionPlans';
import { cn } from '@/lib/utils';

interface ActionPlanCardProps {
  plan: ActionPlan;
  isViewOnly?: boolean;
}

// Period configuration for 30/60/90 structure
const PERIOD_CONFIG: Record<Severity, {
  title: string;
  days: number;
  headerColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  leve: {
    title: '30 dias',
    days: 30,
    headerColor: 'bg-success text-white',
    bgColor: 'bg-success/5',
    borderColor: 'border-success/30',
  },
  moderado: {
    title: '60 dias',
    days: 60,
    headerColor: 'bg-warning text-white',
    bgColor: 'bg-warning/5',
    borderColor: 'border-warning/30',
  },
  critico: {
    title: '90 dias',
    days: 90,
    headerColor: 'bg-destructive text-white',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/30',
  },
};

export default function ActionPlanCard({ plan, isViewOnly }: ActionPlanCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: tasks = [], isLoading: tasksLoading } = useActionPlanTasks(plan.id);
  const toggleTask = useToggleActionPlanTask();
  const updateStatus = useUpdateActionPlanStatus();
  const deletePlan = useDeleteActionPlan();

  const problemConfig = PROBLEM_TYPES[plan.problem_type];
  const severityConfig = SEVERITY_CONFIG[plan.severity];
  const periodConfig = PERIOD_CONFIG[plan.severity];

  const dueDate = new Date(plan.due_date);
  const daysRemaining = differenceInDays(dueDate, new Date());
  const isOverdue = isPast(dueDate) && plan.status === 'active';

  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const actionTasks = tasks.filter(t => t.task_type === 'action');
  const quickWinTasks = tasks.filter(t => t.task_type === 'quick_win');
  const deliverableTasks = tasks.filter(t => t.task_type === 'deliverable');

  const handleComplete = () => {
    updateStatus.mutate({
      planId: plan.id,
      clientId: plan.client_id,
      status: 'completed',
    });
  };

  const handleCancel = () => {
    updateStatus.mutate({
      planId: plan.id,
      clientId: plan.client_id,
      status: 'cancelled',
    });
  };

  const handleDelete = () => {
    deletePlan.mutate({ planId: plan.id, clientId: plan.client_id });
    setDeleteConfirm(false);
  };

  const renderTaskItem = (task: typeof tasks[0]) => (
    <label
      key={task.id}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border',
        task.is_completed
          ? 'bg-muted/50 border-muted line-through text-muted-foreground'
          : 'bg-card border-border hover:border-primary/30 hover:bg-primary/5'
      )}
    >
      <Checkbox
        checked={task.is_completed}
        disabled={isViewOnly || plan.status !== 'active' || toggleTask.isPending}
        onCheckedChange={(checked) => {
          toggleTask.mutate({
            taskId: task.id,
            actionPlanId: plan.id,
            isCompleted: !!checked,
          });
        }}
        className="mt-0.5"
      />
      <span className="text-sm flex-1">{task.title}</span>
      {task.is_completed && (
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
      )}
    </label>
  );

  const renderTaskSection = (
    title: string,
    icon: React.ReactNode,
    sectionTasks: typeof tasks,
    iconBgColor: string
  ) => {
    if (sectionTasks.length === 0) return null;

    const completedCount = sectionTasks.filter(t => t.is_completed).length;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', iconBgColor)}>
            {icon}
          </div>
          <div className="flex-1">
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{sectionTasks.length}
          </Badge>
        </div>
        <div className="space-y-2 pl-1">
          {sectionTasks.map(renderTaskItem)}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className={cn(
        'overflow-hidden transition-all border-2',
        periodConfig.borderColor,
        plan.status === 'completed' && 'opacity-60',
        plan.status === 'cancelled' && 'opacity-40',
        isOverdue && 'border-destructive'
      )}>
        {/* Period Header - Visual like the screenshots */}
        <div className={cn('px-4 py-3', periodConfig.headerColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              <span className="font-bold text-lg">{periodConfig.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {plan.status === 'completed' && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  ✓ Concluído
                </Badge>
              )}
              {plan.status === 'cancelled' && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  Cancelado
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="bg-white text-destructive">
                  Atrasado!
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button className={cn(
              'w-full p-4 text-left hover:bg-muted/30 transition-colors',
              periodConfig.bgColor
            )}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{problemConfig.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {problemConfig.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>
                      Prazo: {format(dueDate, "dd/MM/yyyy", { locale: ptBR })}
                      {plan.status === 'active' && (
                        <span className={cn(
                          'ml-1 font-medium',
                          daysRemaining <= 7 && 'text-warning',
                          daysRemaining <= 0 && 'text-destructive'
                        )}>
                          ({daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Vencido'})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-bold">{completedTasks}/{totalTasks} tarefas</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>
                <div className="shrink-0 p-2 rounded-full bg-muted/50">
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-5 border-t border-border pt-4">
              {/* Indicators */}
              {plan.indicators && plan.indicators.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-muted-foreground">📌 Indicadores identificados:</span>
                  <div className="flex flex-wrap gap-2">
                    {plan.indicators.map((ind, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-muted/50">
                        {ind}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {plan.notes && (
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                  <span className="text-sm font-semibold text-muted-foreground block mb-1">
                    📝 Observações:
                  </span>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}

              {/* Tasks organized by type */}
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {renderTaskSection(
                    'Ações',
                    <ListTodo className="w-4 h-4 text-primary" />,
                    actionTasks,
                    'bg-primary/10'
                  )}
                  {renderTaskSection(
                    'Quick Wins',
                    <Zap className="w-4 h-4 text-warning" />,
                    quickWinTasks,
                    'bg-warning/10'
                  )}
                  {renderTaskSection(
                    'Entregáveis',
                    <Package className="w-4 h-4 text-info" />,
                    deliverableTasks,
                    'bg-info/10'
                  )}
                </div>
              )}

              {/* Action buttons */}
              {!isViewOnly && plan.status === 'active' && (
                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 bg-success hover:bg-success/90"
                    onClick={handleComplete}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Concluir Plano
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={handleCancel}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive ml-auto"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Created info */}
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Criado em {format(new Date(plan.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano de Ação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlan.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}