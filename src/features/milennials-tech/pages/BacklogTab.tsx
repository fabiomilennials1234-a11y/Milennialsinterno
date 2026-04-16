import { useState, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTechTasks, type TechTaskFilters } from '../hooks/useTechTasks';
import { BacklogTabs } from '../components/BacklogTabs';
import { TaskRow } from '../components/TaskRow';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import type { TechTaskType } from '../types';

const TYPE_TABS: string[] = ['BUG', 'FEATURE', 'HOTFIX', 'CHORE', 'DONE'];

export function BacklogTab() {
  const [activeTab, setActiveTab] = useState<string>('BUG');
  const [search, setSearch] = useState('');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Build filters based on active tab
  const filters = useMemo<TechTaskFilters>(() => {
    const f: TechTaskFilters = {};
    if (search) f.search = search;

    if (activeTab === 'DONE') {
      // "Concluídas" tab shows completed tasks of all types
      f.status = 'DONE';
    } else {
      // Type tabs show backlog tasks of that type
      f.type = activeTab as TechTaskType;
      f.status = 'BACKLOG';
    }
    return f;
  }, [activeTab, search]);

  const { data: tasks = [], isLoading } = useTechTasks(filters);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Backlog</h2>
        <Button
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova Task
        </Button>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--mtech-text-subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tasks..."
            className="pl-9 border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)]"
          />
        </div>
        <BacklogTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Task table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-[var(--mtech-text-muted)] text-sm">
          Carregando...
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-[var(--mtech-text-muted)] text-sm">
          Nenhuma task encontrada.
        </div>
      ) : (
        <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 h-9 px-3 border-b border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)]">
            <span className="w-[88px] flex-shrink-0">Tipo</span>
            <span className="flex-1">Título</span>
            <span className="w-20 text-right flex-shrink-0">Responsável</span>
            <span className="w-16 text-center flex-shrink-0">Sprint</span>
            <span className="w-16 text-center flex-shrink-0">Prazo</span>
            <span className="w-16 text-center flex-shrink-0">Status</span>
            <span className="w-14 text-center flex-shrink-0">Prio</span>
            <span className="w-8 flex-shrink-0" />
          </div>

          {/* Rows */}
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={() => setOpenTaskId(task.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <TaskFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          open={!!openTaskId}
          onOpenChange={(open) => {
            if (!open) setOpenTaskId(null);
          }}
        />
      )}
    </>
  );
}
