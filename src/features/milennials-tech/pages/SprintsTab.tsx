import { useState, useMemo } from 'react';
import { Plus, Play, Square, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTechSprints,
  useStartSprint,
  useEndSprint,
} from '../hooks/useTechSprints';
import { useTechTasks } from '../hooks/useTechTasks';
import { canApprove } from '../lib/permissions';
import { TaskRow } from '../components/TaskRow';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { SprintFormModal } from '../components/SprintFormModal';
import type { TechSprint, TechSprintStatus } from '../types';

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const SPRINT_STATUS_BADGE: Record<TechSprintStatus, { label: string; color: string; bg: string }> = {
  PLANNING: { label: 'Planejamento', color: '#8A8A95', bg: 'rgba(138,138,149,0.12)' },
  ACTIVE: { label: 'Ativa', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  COMPLETED: { label: 'Concluída', color: 'var(--mtech-text-subtle)', bg: 'rgba(90,90,102,0.12)' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SprintsTab() {
  const { user } = useAuth();
  const { data: sprints = [], isLoading: sprintsLoading } = useTechSprints();
  const startSprint = useStartSprint();
  const endSprint = useEndSprint();

  const isExec = canApprove(user?.role);

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [editingSprint, setEditingSprint] = useState<TechSprint | undefined>(undefined);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Auto-select first sprint when data loads
  const activeSprint = useMemo(() => {
    if (selectedSprintId) return sprints.find((s) => s.id === selectedSprintId) ?? null;
    if (sprints.length > 0) return sprints[0];
    return null;
  }, [sprints, selectedSprintId]);

  // Fetch tasks for the selected sprint
  const { data: sprintTasks = [], isLoading: tasksLoading } = useTechTasks(
    activeSprint ? { sprintId: activeSprint.id } : undefined,
  );

  const handleCreateSprint = () => {
    setEditingSprint(undefined);
    setShowSprintForm(true);
  };

  const handleEditSprint = (sprint: TechSprint) => {
    setEditingSprint(sprint);
    setShowSprintForm(true);
  };

  if (sprintsLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--mtech-text-muted)] text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-6 min-h-[60vh]">
        {/* Left panel: sprint list */}
        <div className="w-72 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[var(--mtech-text)]">Sprints</h2>
            {isExec && (
              <Button
                size="sm"
                onClick={handleCreateSprint}
                className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5 h-8 px-2.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Sprint
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            {sprints.length === 0 && (
              <p className="text-sm text-[var(--mtech-text-muted)] py-8 text-center">
                Nenhuma sprint criada.
              </p>
            )}
            {sprints.map((sprint) => {
              const badge = SPRINT_STATUS_BADGE[sprint.status];
              const isSelected = activeSprint?.id === sprint.id;

              return (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => setSelectedSprintId(sprint.id)}
                  className="group flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-[var(--mtech-radius-sm)] transition-colors"
                  style={{
                    background: isSelected
                      ? 'var(--mtech-surface-elev)'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid var(--mtech-border-strong)'
                      : '1px solid transparent',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate text-[var(--mtech-text)]">
                      {sprint.name}
                    </span>
                    {sprint.goal && (
                      <span className="block text-xs text-[var(--mtech-text-muted)] truncate mt-0.5">
                        {sprint.goal}
                      </span>
                    )}
                  </div>
                  <span
                    className="flex-shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                    style={{ color: badge.color, backgroundColor: badge.bg }}
                  >
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel: selected sprint detail */}
        <div className="flex-1 min-w-0">
          {!activeSprint ? (
            <div className="flex items-center justify-center h-64 text-[var(--mtech-text-muted)] text-sm">
              Selecione uma sprint.
            </div>
          ) : (
            <>
              {/* Sprint header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium text-[var(--mtech-text)]">
                    {activeSprint.name}
                  </h3>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                    style={{
                      color: SPRINT_STATUS_BADGE[activeSprint.status].color,
                      backgroundColor: SPRINT_STATUS_BADGE[activeSprint.status].bg,
                    }}
                  >
                    {SPRINT_STATUS_BADGE[activeSprint.status].label}
                  </span>
                </div>

                {isExec && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditSprint(activeSprint)}
                      className="text-[var(--mtech-text-muted)] gap-1.5 h-8"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>

                    {activeSprint.status === 'PLANNING' && (
                      <Button
                        size="sm"
                        onClick={() => startSprint.mutate(activeSprint.id)}
                        disabled={startSprint.isPending}
                        className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5 h-8"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {startSprint.isPending ? 'Iniciando...' : 'Iniciar Sprint'}
                      </Button>
                    )}

                    {activeSprint.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => endSprint.mutate(activeSprint.id)}
                        disabled={endSprint.isPending}
                        className="border-[var(--mtech-border)] text-[var(--mtech-text)] gap-1.5 h-8"
                      >
                        <Square className="h-3.5 w-3.5" />
                        {endSprint.isPending ? 'Encerrando...' : 'Encerrar Sprint'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Sprint meta */}
              {activeSprint.goal && (
                <p className="text-sm text-[var(--mtech-text-muted)] mb-4">
                  {activeSprint.goal}
                </p>
              )}

              <div className="flex gap-4 mb-5 text-xs text-[var(--mtech-text-subtle)]" data-mono>
                <span>
                  Início:{' '}
                  {new Date(activeSprint.start_date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span>
                  Fim:{' '}
                  {new Date(activeSprint.end_date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Tasks table */}
              {tasksLoading ? (
                <div className="flex items-center justify-center h-40 text-[var(--mtech-text-muted)] text-sm">
                  Carregando tasks...
                </div>
              ) : sprintTasks.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-[var(--mtech-text-muted)] text-sm">
                  Nenhuma task nesta sprint.
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

                  {sprintTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onClick={() => setOpenTaskId(task.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sprint form modal */}
      <SprintFormModal
        open={showSprintForm}
        onOpenChange={setShowSprintForm}
        sprint={editingSprint}
      />

      {/* Task detail modal */}
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
