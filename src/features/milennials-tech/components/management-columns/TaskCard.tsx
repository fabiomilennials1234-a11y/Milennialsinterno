import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MoreHorizontal,
  FolderKanban,
  Shield,
  Calendar,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUpdateDepartmentTaskStatus } from '@/hooks/useDepartmentTasks';
import { allProjectTaskKeys, type ProjectTaskWithName } from '@/hooks/useAllProjectTasks';
import { fireCelebration } from '@/lib/confetti';
import { isPast, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PROJECT_STEP_LABEL,
  type ProjectStep,
} from '../../lib/projectSteps';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  todo: { label: 'A fazer', dot: 'bg-blue-500', color: 'text-blue-500' },
  doing: { label: 'Fazendo', dot: 'bg-orange-500', color: 'text-orange-500' },
  done: { label: 'Feitas', dot: 'bg-green-500', color: 'text-green-500' },
} as const;

const STATUSES = ['todo', 'doing', 'done'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: ProjectTaskWithName;
}

export function TaskCard({ task }: TaskCardProps) {
  const queryClient = useQueryClient();
  const updateStatus = useUpdateDepartmentTaskStatus('devs');
  const isDone = task.status === 'done';
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isDone;
  const cfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.todo;

  const handleStatusChange = useCallback(
    (newStatus: 'todo' | 'doing' | 'done') => {
      if (newStatus === 'done') fireCelebration();
      updateStatus.mutate(
        { taskId: task.id, status: newStatus },
        {
          onSettled: () => {
            queryClient.invalidateQueries({ queryKey: allProjectTaskKeys.all });
          },
        },
      );
    },
    [task.id, updateStatus, queryClient],
  );

  return (
    <div
      className={cn(
        'rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-2.5 group transition-colors hover:border-[var(--mtech-border-strong)]',
        isDone && 'opacity-50',
        isOverdue && 'border-l-2 border-l-[var(--mtech-danger)]',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p
            className={cn(
              'text-[11px] font-medium text-[var(--mtech-text)] leading-tight flex items-center gap-1',
              isDone && 'line-through text-[var(--mtech-text-subtle)]',
            )}
          >
            {/* Status dot */}
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
            {task.is_blocking && task.related_project_id && (
              <Shield className="h-2.5 w-2.5 text-[var(--mtech-accent)] flex-shrink-0" />
            )}
            <span className="truncate">{task.title}</span>
          </p>

          {/* Project badge */}
          {task.project_name && (
            <div className="flex items-center gap-1 mt-1">
              <FolderKanban className="h-2.5 w-2.5 text-[var(--mtech-accent)] flex-shrink-0" />
              <span className="text-[9px] text-[var(--mtech-accent)] font-medium truncate">
                {task.project_name}
              </span>
            </div>
          )}

          {/* Advance step badge */}
          {task.advance_to_step && (
            <span className="inline-block mt-1 text-[9px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              &rarr; {PROJECT_STEP_LABEL[task.advance_to_step as ProjectStep] ?? task.advance_to_step}
            </span>
          )}

          {/* Due date */}
          {task.due_date && (
            <div
              className={cn(
                'flex items-center gap-1 mt-1 text-[9px]',
                isOverdue ? 'text-[var(--mtech-danger)]' : 'text-[var(--mtech-text-subtle)]',
              )}
            >
              <Calendar className="h-2.5 w-2.5" />
              <span>
                {format(new Date(task.due_date), 'dd/MM HH:mm', { locale: ptBR })}
                {isOverdue && ' (Atrasado!)'}
              </span>
            </div>
          )}
        </div>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[var(--mtech-surface-elev)] rounded">
              <MoreHorizontal className="h-3 w-3 text-[var(--mtech-text-subtle)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50"
          >
            {STATUSES.filter((s) => s !== task.status).map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(s);
                }}
              >
                <div className={cn('w-2 h-2 rounded-full mr-2', STATUS_CONFIG[s].dot)} />
                Mover para {STATUS_CONFIG[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
