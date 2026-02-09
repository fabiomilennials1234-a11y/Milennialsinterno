import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarCheck, Phone, CheckCircle2, Loader2 } from 'lucide-react';

interface CSComercialOnboardingBadgeProps {
  comercialStatus: string | null;
  pendingTaskType?: string | null;
  compact?: boolean;
}

// Labels for task types in comercial onboarding
const TASK_LABELS: Record<string, { label: string; shortLabel: string; icon: typeof Phone }> = {
  'marcar_consultoria': { label: 'Marcar Consultoria', shortLabel: 'Marcar', icon: CalendarCheck },
  'realizar_consultoria': { label: 'Realizar Consultoria', shortLabel: 'Realizar', icon: Phone },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  'novo': { label: 'Novo', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/30' },
  'consultoria_marcada': { label: 'Marcada', color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/30' },
  'consultoria_realizada': { label: 'Realizada', color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-500/30' },
  'em_acompanhamento': { label: 'Acompanhamento', color: 'text-purple-600', bgColor: 'bg-purple-500/10 border-purple-500/30' },
};

export default function CSComercialOnboardingBadge({ 
  comercialStatus, 
  pendingTaskType,
  compact = false 
}: CSComercialOnboardingBadgeProps) {
  const status = comercialStatus || 'novo';
  const statusConfig = STATUS_LABELS[status] || STATUS_LABELS['novo'];
  
  // If we have a pending task, show which task is pending
  if (pendingTaskType && TASK_LABELS[pendingTaskType]) {
    const taskConfig = TASK_LABELS[pendingTaskType];
    const TaskIcon = taskConfig.icon;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1 ${statusConfig.bgColor} ${statusConfig.color} text-[10px]`}
            >
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {compact ? taskConfig.shortLabel : taskConfig.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">Tarefa pendente: {taskConfig.label}</p>
              <p className="text-xs text-muted-foreground">Status: {statusConfig.label}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Show status badge only
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1 ${statusConfig.bgColor} ${statusConfig.color} text-[10px]`}
          >
            {status === 'em_acompanhamento' || status === 'consultoria_realizada' ? (
              <CheckCircle2 className="h-2.5 w-2.5" />
            ) : null}
            {compact ? statusConfig.label : statusConfig.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Status comercial: {statusConfig.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
