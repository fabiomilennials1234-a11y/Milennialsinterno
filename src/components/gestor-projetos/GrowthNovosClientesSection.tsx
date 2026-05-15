import { useState, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  useGrowthNovosClientes,
  useGrowthTasks,
  useCompleteGrowthTask,
} from '@/hooks/useGrowthOnboarding';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import GrowthClientCard from './GrowthClientCard';

interface Props {
  onTeamSelectionNeeded?: (clientId: string) => void;
}

const STEP_LABELS: Record<string, string> = {
  novos_clientes: 'Novos Clientes',
  call_1_agendada: 'Call 1 Agendada',
  equipe_designada: 'Onboarding',
};

export default function GrowthNovosClientesSection({ onTeamSelectionNeeded }: Props) {
  const { data: clients = [], isLoading } = useGrowthNovosClientes();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tasksMap } = useGrowthTasks(clientIds);
  const { data: tagsMap } = useClientTagsBatch(clientIds);
  const completeTask = useCompleteGrowthTask();

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  const handleTaskComplete = useCallback(
    async (taskId: string, taskTitle: string, taskDescription: string | null, clientId: string, clientName: string) => {
      const result = await completeTask.mutateAsync({
        taskId,
        taskTitle,
        taskDescription,
        clientId,
        clientName,
      });

      if (result?.action === 'team_selection_needed' && onTeamSelectionNeeded) {
        onTeamSelectionNeeded(result.clientId);
      }
    },
    [completeTask, onTeamSelectionNeeded],
  );

  // Group by step
  const grouped = useMemo(() => {
    const byStep: Record<string, typeof clients> = {
      novos_clientes: [],
      call_1_agendada: [],
      equipe_designada: [],
    };
    for (const c of clients) {
      const step = c.growth_onboarding_step || 'novos_clientes';
      if (byStep[step]) byStep[step].push(c);
    }
    return byStep;
  }, [clients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">Nenhum cliente Growth em onboarding</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 pr-2">
        {Object.entries(grouped).map(([step, stepClients]) => (
          <div key={step}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {STEP_LABELS[step] || step}
              </span>
              <Badge variant="secondary" className="text-xs">
                {stepClients.length}
              </Badge>
            </div>

            {stepClients.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic pl-1">
                Nenhum cliente
              </p>
            ) : (
              <div className="space-y-2">
                {stepClients.map(client => {
                  const tags = tagsMap?.get(client.id) || [];
                  const tasks = tasksMap?.get(client.id) || [];
                  const isExpanded = expandedClients.has(client.id);

                  return (
                    <GrowthClientCard
                      key={client.id}
                      client={client}
                      tags={tags}
                      tasks={tasks}
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleExpand(client.id)}
                      onTaskComplete={handleTaskComplete}
                      isCompletingTask={completeTask.isPending}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
