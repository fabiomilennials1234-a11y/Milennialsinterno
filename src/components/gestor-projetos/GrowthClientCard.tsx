import { ChevronDown, ChevronRight, CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { detectGrowthTaskType } from '@/hooks/useGrowthOnboarding';
import ClientTagBadge from '@/components/client-tags/ClientTagBadge';
import { BLOCKING_TAGS, TAG_BLOQUEADO_CX, TAG_TORQUE_BLOQUEADO } from '@/components/client-tags/ClientTagsList';
import type { ClientTag } from '@/hooks/useClientTags';
import type { GrowthClient } from '@/hooks/useGrowthOnboarding';

interface GrowthTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  due_date: string | null;
  related_client_id: string | null;
}

interface Props {
  client: GrowthClient;
  tags: ClientTag[];
  tasks: GrowthTask[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTaskComplete: (taskId: string, taskTitle: string, taskDescription: string | null, clientId: string, clientName: string) => void;
  isCompletingTask: boolean;
}

export default function GrowthClientCard({
  client,
  tags,
  tasks,
  isExpanded,
  onToggleExpand,
  onTaskComplete,
  isCompletingTask,
}: Props) {
  const displayName = client.razao_social || client.name;
  const hasBloqueadoTag = tags.some(t => t.name === TAG_BLOQUEADO_CX);

  // Find current active task (first non-done growth task)
  const activeTask = tasks.find(t => {
    const type = detectGrowthTaskType(t);
    return type !== null && t.status !== 'done';
  });

  // Count completed growth tasks
  const completedCount = tasks.filter(t => {
    const type = detectGrowthTaskType(t);
    return type !== null && t.status === 'done';
  }).length;

  // Total possible steps: welcome, schedule_call, do_call, align_project = 4
  // But align_project only exists after team assignment, so show 3 initially
  const totalSteps = tasks.some(t => t.title.startsWith('Alinhar Projeto')) ? 4 : 3;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        hasBloqueadoTag
          ? 'border-danger/30 bg-danger/5'
          : 'border-subtle bg-card hover:bg-muted/50',
      )}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {displayName}
            </p>
            {/* Progress indicator */}
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {completedCount}/{totalSteps}
            </span>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.map(tag => (
              <ClientTagBadge
                key={tag.id}
                name={tag.name}
                createdAt={tag.created_at}
                expiresAt={tag.expires_at}
                expiredAt={tag.expired_at}
                size="sm"
                blocking={BLOCKING_TAGS.has(tag.name)}
                counterMode={tag.name === TAG_TORQUE_BLOQUEADO ? 'elapsed' : 'countdown'}
              />
            ))}
          </div>

          {/* Current task preview (collapsed) */}
          {!isExpanded && activeTask && (
            <div className="flex items-center gap-1.5 mt-2">
              <Circle size={10} className="text-info shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {activeTask.title}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded: task list */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-1.5 border-t border-subtle/50">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2 pl-1">
              Nenhuma tarefa criada ainda
            </p>
          ) : (
            tasks.map(task => {
              const isDone = task.status === 'done';
              const isOverdue = task.due_date && !isDone && isPast(new Date(task.due_date));
              const isActive = activeTask?.id === task.id;
              const growthType = detectGrowthTaskType(task);
              const canComplete = isActive && !isDone && !isCompletingTask && growthType !== null;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-start gap-2 py-2 px-2 rounded-lg transition-colors',
                    isActive && !isDone && 'bg-info/5',
                  )}
                >
                  {/* Status icon / action button */}
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  ) : canComplete ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskComplete(
                          task.id,
                          task.title,
                          task.description ?? null,
                          client.id,
                          client.razao_social || client.name,
                        );
                      }}
                      className="shrink-0 mt-0.5 group/check"
                      title="Concluir tarefa"
                    >
                      <Circle
                        size={16}
                        className="text-info group-hover/check:text-success transition-colors"
                      />
                    </button>
                  ) : (
                    <Circle size={16} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-xs font-medium',
                        isDone && 'line-through text-muted-foreground',
                        isOverdue && 'text-danger',
                      )}
                    >
                      {task.title}
                    </p>
                    {task.due_date && (
                      <div
                        className={cn(
                          'flex items-center gap-1 mt-0.5 text-[10px]',
                          isOverdue ? 'text-danger' : 'text-muted-foreground',
                        )}
                      >
                        <Clock size={10} />
                        <span>
                          {format(new Date(task.due_date), 'dd/MM HH:mm', { locale: ptBR })}
                          {isOverdue && ' (Atrasado)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
