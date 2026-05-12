import { useState, useMemo } from 'react';
import { Plus, ListChecks, CalendarDays, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ManagementColumn } from '../ManagementColumn';
import { TaskCard } from './TaskCard';
import { useAllProjectTasks, useCreateAllProjectTask } from '@/hooks/useAllProjectTasks';
import { useTechProjects } from '../../hooks/useTechProjects';

// ---------------------------------------------------------------------------
// Config per task type
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  'daily' | 'weekly' | 'step',
  { title: string; icon: LucideIcon }
> = {
  daily: { title: 'Diarias', icon: ListChecks },
  weekly: { title: 'Semanais', icon: CalendarDays },
  step: { title: 'Por Etapa', icon: Layers },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TaskColumnProps {
  type: 'daily' | 'weekly' | 'step';
}

export function TaskColumn({ type }: TaskColumnProps) {
  const { data: tasks = [], isLoading } = useAllProjectTasks(type);
  const { data: projects = [] } = useTechProjects();
  const createTask = useCreateAllProjectTask();

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProjectId, setNewProjectId] = useState<string>('__none__');

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed'),
    [projects],
  );

  const pendingCount = tasks.filter((t) => t.status !== 'done').length;
  const cfg = TYPE_CONFIG[type];

  // Sort: todo first, then doing, then done
  const sorted = useMemo(() => {
    const order = { todo: 0, doing: 1, done: 2 };
    return [...tasks].sort(
      (a, b) =>
        (order[a.status as keyof typeof order] ?? 3) -
        (order[b.status as keyof typeof order] ?? 3),
    );
  }, [tasks]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createTask.mutateAsync({
      title: newTitle,
      task_type: type,
      related_project_id: newProjectId === '__none__' ? null : newProjectId,
    });
    setNewTitle('');
    setNewProjectId('__none__');
    setIsAdding(false);
  };

  return (
    <ManagementColumn
      title={cfg.title}
      icon={cfg.icon}
      count={pendingCount}
      headerRight={
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-[var(--mtech-accent)] hover:text-[var(--mtech-accent)]/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      }
    >
      {/* Add task form */}
      {isAdding && (
        <div className="space-y-1.5 p-2 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
          <Input
            placeholder="Titulo da tarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            autoFocus
            className={`${inputCls} h-7 text-[11px]`}
          />
          {(type === 'daily' || type === 'step') && (
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger className={`${inputCls} h-7 text-[10px]`}>
                <SelectValue placeholder="Vincular a projeto..." />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="__none__">Sem projeto</SelectItem>
                {activeProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={createTask.isPending || !newTitle.trim()}
              className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 h-6 px-2 text-[10px] font-semibold flex-1"
            >
              {createTask.isPending ? 'Criando...' : 'Adicionar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewTitle('');
                setNewProjectId('__none__');
              }}
              className="h-6 px-2 text-[var(--mtech-text-subtle)] text-[10px]"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 rounded-[var(--mtech-radius-md)] bg-[var(--mtech-surface-elev)] animate-pulse"
          />
        ))}

      {/* Task cards */}
      {!isLoading && sorted.length === 0 && (
        <p className="text-center text-[10px] text-[var(--mtech-text-subtle)] py-6">
          Nenhuma tarefa.
        </p>
      )}
      {!isLoading && sorted.map((task) => <TaskCard key={task.id} task={task} />)}
    </ManagementColumn>
  );
}
