import { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Inbox, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { isExecutive } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTechTasks, type TechTaskFilters } from '../hooks/useTechTasks';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { BacklogTabs } from '../components/BacklogTabs';
import { TaskRow } from '../components/TaskRow';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import type { TechTaskType } from '../types';

const TYPE_TABS: string[] = ['BUG', 'FEATURE', 'HOTFIX', 'CHORE', 'DONE'];

export function BacklogTab() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('BUG');
  const [search, setSearch] = useState('');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { activeTaskId } = useActiveTimer();
  const isExec = isExecutive(user?.role);

  const handleCopyFormLink = useCallback(() => {
    const url = `${window.location.origin}/milennials-tech/submit`;
    navigator.clipboard.writeText(url);
    toast.success('Link do formulário copiado!');
  }, []);

  const handleOpenTask = useCallback((id: string) => {
    if (activeTaskId && activeTaskId !== id) {
      toast.warning('Finalize o timer da task atual antes de abrir outra.');
      return;
    }
    setOpenTaskId(id);
  }, [activeTaskId]);

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
        <div className="flex items-center gap-2">
          {isExec && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyFormLink}
              className="border-[var(--mtech-border)] text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:border-[var(--mtech-border-strong)] gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartilhar formulário
            </Button>
          )}
        <Button
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova Task
        </Button>
        </div>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--mtech-text-subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tasks..."
            className="pl-9 border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)]"
          />
        </div>
        <BacklogTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Task table */}
      {isLoading ? (
        <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] overflow-hidden">
          <div className="flex items-center gap-3 h-9 px-3 border-b border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
            {[88, 200, 80, 64, 64, 64, 56].map((w, i) => (
              <div key={i} className="animate-pulse rounded bg-[var(--mtech-surface)] h-3" style={{ width: w }} />
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 h-10 px-3 border-b border-[var(--mtech-border)]">
              <div className="w-[88px] flex-shrink-0"><div className="h-4 w-16 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" /></div>
              <div className="flex-1"><div className="h-4 rounded bg-[var(--mtech-surface-elev)] animate-pulse" style={{ width: `${60 + (i * 7) % 30}%` }} /></div>
              <div className="w-20 flex-shrink-0"><div className="h-3 w-14 ml-auto rounded bg-[var(--mtech-surface-elev)] animate-pulse" /></div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Inbox className="h-12 w-12 text-[var(--mtech-text-subtle)] opacity-40" />
          <p className="text-sm text-[var(--mtech-text-muted)]">
            {search ? 'Nenhuma task corresponde à busca.' : 'Nenhuma task nesta categoria.'}
          </p>
          {!search && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5 mt-1"
            >
              <Plus className="h-4 w-4" />
              Criar primeira task
            </Button>
          )}
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
              onClick={() => handleOpenTask(task.id)}
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
