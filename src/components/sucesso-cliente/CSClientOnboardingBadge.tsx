import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Rocket, CheckCircle2, Loader2, Clock, ArrowRight } from 'lucide-react';
import { CSOnboardingTask, ONBOARDING_STEP_LABELS, calculateOnboardingProgress, getCurrentOnboardingStep } from '@/hooks/useCSOnboardingTracking';

interface CSClientOnboardingBadgeProps {
  tasks: CSOnboardingTask[];
  isComplete?: boolean;
  compact?: boolean;
}

export default function CSClientOnboardingBadge({ tasks, isComplete, compact = false }: CSClientOnboardingBadgeProps) {
  if (isComplete) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {!compact && <span>Campanha Publicada</span>}
              {compact && <span>Publicado</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cliente com campanha publicada - Onboarding concluído</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  const progress = calculateOnboardingProgress(tasks);
  const currentStep = getCurrentOnboardingStep(tasks);
  const currentStepLabel = currentStep ? ONBOARDING_STEP_LABELS[currentStep] || currentStep : 'Aguardando';
  
  const doingTask = tasks.find(t => t.status === 'doing');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const doneTasks = tasks.filter(t => t.status === 'done');

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1 max-w-full">
              <Rocket className="h-3 w-3 shrink-0" />
              <span className="truncate text-xs">{currentStepLabel}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 w-16" />
                <span className="text-xs font-medium">{progress}%</span>
              </div>
              <p className="font-medium text-sm">Etapa atual: {currentStepLabel}</p>
              <p className="text-xs text-muted-foreground">
                {doneTasks.length}/{tasks.length} tarefas concluídas
              </p>
              {pendingTasks.length > 1 && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium">Próximas etapas:</p>
                  {pendingTasks.slice(1, 4).map((t, i) => (
                    <p key={t.id} className="flex items-center gap-1">
                      <ArrowRight className="h-2.5 w-2.5" />
                      {ONBOARDING_STEP_LABELS[t.task_type] || t.title}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">ONBOARDING</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary">
          {progress}%
        </Badge>
      </div>
      
      <Progress value={progress} className="h-1.5" />
      
      {/* Current step - highlighted */}
      <div className="bg-primary/10 rounded px-2 py-1.5">
        <div className="flex items-center gap-1.5 text-xs">
          {doingTask ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="font-medium text-primary">Fazendo:</span>
            </>
          ) : pendingTasks.length > 0 ? (
            <>
              <Clock className="h-3 w-3 text-primary" />
              <span className="font-medium text-primary">Próxima:</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span className="font-medium text-success">Concluído</span>
            </>
          )}
          <span className="text-foreground font-medium truncate">
            {doingTask 
              ? (ONBOARDING_STEP_LABELS[doingTask.task_type] || doingTask.title)
              : pendingTasks.length > 0 
                ? (ONBOARDING_STEP_LABELS[pendingTasks[0].task_type] || pendingTasks[0].title)
                : ''
            }
          </span>
        </div>
      </div>
      
      {/* Task count */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{doneTasks.length} de {tasks.length} concluídas</span>
        {pendingTasks.length > 1 && (
          <span>+{pendingTasks.length - 1} restantes</span>
        )}
      </div>
    </div>
  );
}
