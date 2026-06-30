import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCreateIssue } from '../hooks/useTechIssues';
import { useTechProjects } from '../hooks/useTechProjects';
import { useTechEpics } from '../hooks/useTechEpics';
import { useTechProfiles } from '../hooks/useProfiles';
import {
  EMPTY_BACKLOG_FILTERS,
  type BacklogFilters,
  type ProjectOption,
  type AssigneeOption,
} from '../components/backlogTypes';
import { KanbanBoardContainer } from '../components/KanbanBoardContainer';
import { IssueCreateModal, type IssueCreatePayload } from '../components/IssueCreateModal';
import type { EpicSelectOption } from '../components/EpicSelect';
import { TaskDetailModal } from '../components/TaskDetailModal';

// ---------------------------------------------------------------------------
// KanbanTab (#168) — thin page over KanbanBoardContainer (squad swimlanes +
// workflow columns, every cross-project issue). The URL owns the project
// filter: `?project=<id>` constrains the board and shows a removable chip, so
// deep links from TeamMatrixView / ProjectDetailModal keep working and the
// CommandPalette entry (no param) shows the full board.
// ---------------------------------------------------------------------------

export function KanbanTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectParam = searchParams.get('project');

  const [showCreate, setShowCreate] = useState(false);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  const filters = useMemo<BacklogFilters | undefined>(
    () =>
      projectParam
        ? { ...EMPTY_BACKLOG_FILTERS, projectIds: [projectParam] }
        : undefined,
    [projectParam],
  );

  const { data: projects = [] } = useTechProjects();
  const { data: profiles = [] } = useTechProfiles();
  const { data: epics = [] } = useTechEpics();
  const createIssue = useCreateIssue();

  const projectOptions = useMemo<ProjectOption[]>(
    () => projects.map((p) => ({ id: p.id, name: p.name, prefix: p.key_prefix ?? '' })),
    [projects],
  );
  const assigneeOptions = useMemo<AssigneeOption[]>(
    () => profiles.map((p) => ({ id: p.user_id, name: p.name })),
    [profiles],
  );
  const epicOptions = useMemo<EpicSelectOption[]>(
    () => epics.map((e) => ({ id: e.id, title: e.title, key: e.key, projectId: e.projectId })),
    [epics],
  );

  const filterProjectName = useMemo(() => {
    if (!projectParam) return null;
    return projects.find((p) => p.id === projectParam)?.name ?? 'Projeto';
  }, [projectParam, projects]);

  const clearProjectFilter = useCallback(() => {
    setSearchParams((prev) => {
      prev.delete('project');
      return prev;
    });
  }, [setSearchParams]);

  const handleCreate = useCallback(
    (payload: IssueCreatePayload) => {
      createIssue.mutate(
        {
          projectId: payload.projectId,
          title: payload.title,
          type: payload.type,
          priority: payload.priority,
          squad: payload.squad,
          storyPoints: payload.storyPoints,
          assigneeId: payload.assigneeId,
          epicId: payload.epicId,
          description: payload.description,
        },
        {
          onSuccess: () => {
            toast.success('Issue criada.');
            setShowCreate(false);
          },
          onError: () => toast.error('Não foi possível criar a issue.'),
        },
      );
    },
    [createIssue],
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-[var(--mtech-text)]">Kanban</h2>
          {filterProjectName && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)] border border-[var(--mtech-accent)]/20">
              <FolderKanban className="h-3 w-3" />
              {filterProjectName}
              <button
                onClick={clearProjectFilter}
                className="ml-0.5 hover:text-white transition-colors"
                title="Limpar filtro de projeto"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova Issue
        </Button>
      </div>

      <KanbanBoardContainer filters={filters} onOpenCard={setOpenIssueId} />

      <IssueCreateModal
        open={showCreate}
        onOpenChange={setShowCreate}
        projects={projectOptions}
        assignees={assigneeOptions}
        epics={epicOptions}
        onSubmit={handleCreate}
        isSubmitting={createIssue.isPending}
        defaultProjectId={projectParam}
      />

      {openIssueId && (
        <TaskDetailModal
          taskId={openIssueId}
          open={!!openIssueId}
          onOpenChange={(open) => {
            if (!open) setOpenIssueId(null);
          }}
        />
      )}
    </>
  );
}
