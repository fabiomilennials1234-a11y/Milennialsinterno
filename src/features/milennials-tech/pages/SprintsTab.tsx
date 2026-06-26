import { useState, useMemo, useCallback } from 'react';
import { Plus, Play, Square, Pencil, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTechSprints,
  useStartSprint,
  useCloseSprint,
} from '../hooks/useTechSprints';
import { useSprintIssues } from '../hooks/useTechIssues';
import { canApprove } from '../lib/permissions';
import {
  computeDonePoints,
  computePlannedPoints,
  partitionOnClose,
} from '../lib/sprintLifecycle';
import { useSprintBurndown } from '../hooks/useSprintBurndown';
import { useTechVelocity } from '../hooks/useTechVelocity';
import { SprintVelocityChart } from '../components/SprintVelocityChart';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { SprintFormModal } from '../components/SprintFormModal';
import { SprintBoardContainer } from '../components/SprintBoardContainer';
import { SprintBurndownChart } from '../components/SprintBurndownChart';
import { SprintCommitment } from '../components/SprintCommitment';
import { SprintCloseModal, type SprintCloseTarget } from '../components/SprintCloseModal';
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
  const closeSprint = useCloseSprint();

  // Velocity is cross-sprint (every closed sprint), not tied to the selection.
  const { series: velocitySeries } = useTechVelocity();

  const isExec = canApprove(user?.role);

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [editingSprint, setEditingSprint] = useState<TechSprint | undefined>(undefined);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const handleOpenTask = useCallback((id: string) => {
    setOpenTaskId(id);
  }, []);

  // Auto-select first sprint when data loads
  const activeSprint = useMemo(() => {
    if (selectedSprintId) return sprints.find((s) => s.id === selectedSprintId) ?? null;
    if (sprints.length > 0) return sprints[0];
    return null;
  }, [sprints, selectedSprintId]);

  // Issues scoped to the selected sprint — shares the backlog query cache.
  const { data: sprintIssues = [] } = useSprintIssues(activeSprint?.id);

  // Burndown — only ACTIVE/COMPLETED sprints with a committed baseline render it.
  const { series: burndownSeries, isEnabled: showBurndown } = useSprintBurndown(
    activeSprint?.id,
  );

  const donePoints = useMemo(() => computeDonePoints(sprintIssues), [sprintIssues]);
  const plannedPoints = useMemo(() => computePlannedPoints(sprintIssues), [sprintIssues]);
  const { completed, incomplete } = useMemo(
    () => partitionOnClose(sprintIssues),
    [sprintIssues],
  );

  // PLANNING sprints (excluding the one being closed) can receive carry-over.
  const nextSprints = useMemo(
    () =>
      sprints
        .filter((s) => s.status === 'PLANNING' && s.id !== activeSprint?.id)
        .map((s) => ({ id: s.id, name: s.name })),
    [sprints, activeSprint?.id],
  );

  const handleConfirmClose = useCallback(
    (target: SprintCloseTarget) => {
      if (!activeSprint) return;
      closeSprint.mutate(
        {
          sprintId: activeSprint.id,
          moveTo: target.kind === 'sprint' ? target.id : null,
        },
        { onSuccess: () => setShowCloseModal(false) },
      );
    },
    [activeSprint, closeSprint],
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
      <div className="flex gap-6 min-h-[60vh]">
        <div className="w-72 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-16 rounded bg-[var(--mtech-surface-elev)]" />
            <div className="h-8 w-28 rounded-md bg-[var(--mtech-surface-elev)]" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5 mb-1 rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border)]">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-24 rounded bg-[var(--mtech-surface-elev)]" />
                <div className="h-3 w-32 rounded bg-[var(--mtech-surface-elev)]" />
              </div>
              <div className="h-4 w-16 rounded-full bg-[var(--mtech-surface-elev)]" />
            </div>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-5 w-32 rounded bg-[var(--mtech-surface-elev)]" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Velocity — cross-sprint throughput, sprint over sprint (#163) */}
      <SprintVelocityChart series={velocitySeries} className="mb-6" />

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
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <CalendarDays className="h-10 w-10 text-[var(--mtech-text-subtle)] opacity-40" />
                <p className="text-sm text-[var(--mtech-text-muted)]">Nenhuma sprint criada.</p>
                {isExec && (
                  <Button
                    size="sm"
                    onClick={handleCreateSprint}
                    className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5 mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Criar primeira sprint
                  </Button>
                )}
              </div>
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
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <CalendarDays className="h-10 w-10 text-[var(--mtech-text-subtle)] opacity-40" />
              <p className="text-sm text-[var(--mtech-text-muted)]">Selecione uma sprint para ver os detalhes.</p>
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

                <div className="flex items-center gap-4">
                  <SprintCommitment
                    committedPoints={activeSprint.committed_points_snapshot}
                    donePoints={donePoints}
                    plannedPoints={plannedPoints}
                    status={activeSprint.status}
                  />

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
                          onClick={() => setShowCloseModal(true)}
                          disabled={closeSprint.isPending}
                          className="border-[var(--mtech-border)] text-[var(--mtech-text)] gap-1.5 h-8"
                        >
                          <Square className="h-3.5 w-3.5" />
                          Encerrar Sprint
                        </Button>
                      )}
                    </div>
                  )}
                </div>
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

              {/* Burndown — scope-change story for active/completed sprints */}
              {showBurndown && (
                <SprintBurndownChart series={burndownSeries} className="mb-5" />
              )}

              {/* Sprint board — squad swimlanes */}
              <SprintBoardContainer sprintId={activeSprint.id} onOpenCard={handleOpenTask} />
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

      {/* Sprint close modal */}
      {activeSprint && (
        <SprintCloseModal
          open={showCloseModal}
          onOpenChange={setShowCloseModal}
          incompleteCount={incomplete.length}
          completedCount={completed.length}
          nextSprints={nextSprints}
          onConfirm={handleConfirmClose}
          isPending={closeSprint.isPending}
        />
      )}

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
