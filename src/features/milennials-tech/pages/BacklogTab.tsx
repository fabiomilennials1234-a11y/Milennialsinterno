import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useBacklogIssues,
  useCreateIssue,
  useReorderIssue,
  useUpdateStoryPoints,
} from '../hooks/useTechIssues';
import { useTechProjects } from '../hooks/useTechProjects';
import { useTechEpics, useEpicRollupMap } from '../hooks/useTechEpics';
import { groupIssuesByEpic, type GroupEpic } from '../lib/groupByEpic';
import { useTechClients } from '../hooks/useClients';
import { useTechProfiles } from '../hooks/useProfiles';
import { computeReorderNeighbors } from '../lib/backlogRanking';
import type { StoryPointValue } from '../lib/issueSystem';
import {
  EMPTY_BACKLOG_FILTERS,
  hasAnyFilter,
  type BacklogFilters,
  type ProjectOption,
  type ClientOption,
  type AssigneeOption,
} from '../components/backlogTypes';
import { BacklogQueue } from '../components/BacklogQueue';
import { BacklogFilterBar } from '../components/BacklogFilterBar';
import { IssueCreateModal, type IssueCreatePayload } from '../components/IssueCreateModal';
import { BacklogEpicCreate } from '../components/BacklogEpicCreate';
import type { EpicSelectOption } from '../components/EpicSelect';
import { TaskDetailModal } from '../components/TaskDetailModal';

export function BacklogTab() {
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get('project');

  const [filters, setFilters] = useState<BacklogFilters>(() =>
    projectParam
      ? { ...EMPTY_BACKLOG_FILTERS, projectIds: [projectParam] }
      : EMPTY_BACKLOG_FILTERS,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(true);
  const [collapsedEpicIds, setCollapsedEpicIds] = useState<Set<string>>(() => new Set());

  const { data: issues = [], isLoading } = useBacklogIssues(filters);
  const { data: projects = [] } = useTechProjects();
  const { data: clients = [] } = useTechClients();
  const { data: profiles = [] } = useTechProfiles();
  const { data: epics = [] } = useTechEpics();
  const rollupMap = useEpicRollupMap();

  const createIssue = useCreateIssue();
  const reorderIssue = useReorderIssue();
  const updateStoryPoints = useUpdateStoryPoints();

  const projectOptions = useMemo<ProjectOption[]>(
    () => projects.map((p) => ({ id: p.id, name: p.name, prefix: p.key_prefix ?? '' })),
    [projects],
  );
  const clientOptions = useMemo<ClientOption[]>(
    () => clients.map((c) => ({ id: c.id, name: c.name })),
    [clients],
  );
  const assigneeOptions = useMemo<AssigneeOption[]>(
    () => profiles.map((p) => ({ id: p.user_id, name: p.name })),
    [profiles],
  );
  const epicOptions = useMemo<EpicSelectOption[]>(
    () => epics.map((e) => ({ id: e.id, title: e.title, key: e.key, projectId: e.projectId })),
    [epics],
  );

  const sections = useMemo(() => {
    const groupEpics: GroupEpic[] = epics.map((e) => ({ id: e.id, title: e.title, key: e.key }));
    return groupIssuesByEpic(issues, groupEpics, rollupMap);
  }, [issues, epics, rollupMap]);

  const handleToggleCollapse = useCallback((key: string) => {
    setCollapsedEpicIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isFiltered = hasAnyFilter(filters);

  // An epic needs a project: the backlog's "current project" is the deep-link
  // param or a filter narrowed to exactly one project — otherwise none.
  const currentProjectId =
    projectParam ?? (filters.projectIds.length === 1 ? filters.projectIds[0] : null);
  const currentProjectLabel = currentProjectId
    ? projectOptions.find((p) => p.id === currentProjectId)?.name ?? null
    : null;

  const handleReorder = useCallback(
    (movedId: string, targetIndex: number) => {
      const neighbors = computeReorderNeighbors(
        issues.map((i) => ({ id: i.id, rank: i.rank })),
        movedId,
        targetIndex,
      );
      reorderIssue.mutate(
        { id: movedId, ...neighbors },
        { onError: () => toast.error('Não foi possível reordenar. Tente de novo.') },
      );
    },
    [issues, reorderIssue],
  );

  const handleEstimate = useCallback(
    (issueId: string, points: StoryPointValue) => {
      updateStoryPoints.mutate(
        { id: issueId, points },
        { onError: () => toast.error('Não foi possível salvar a estimativa.') },
      );
    },
    [updateStoryPoints],
  );

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

  const handleCopyFormLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/submit-task`);
    toast.success('Link copiado.');
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Backlog</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyFormLink}
            className="border-[var(--mtech-border)] text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:border-[var(--mtech-border-strong)] gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Copiar link
          </Button>
          <BacklogEpicCreate projectId={currentProjectId} projectLabel={currentProjectLabel} />
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nova Issue
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <BacklogFilterBar
          projects={projectOptions}
          clients={clientOptions}
          assignees={assigneeOptions}
          filters={filters}
          onChange={setFilters}
          grouped={grouped}
          onGroupedChange={setGrouped}
        />
      </div>

      <BacklogQueue
        issues={issues}
        isLoading={isLoading}
        isFiltered={isFiltered}
        selectedId={openIssueId}
        onReorder={handleReorder}
        onIssueClick={setOpenIssueId}
        onEstimate={handleEstimate}
        onCreateClick={() => setShowCreate(true)}
        onClearFilters={() => setFilters(EMPTY_BACKLOG_FILTERS)}
        grouped={grouped}
        sections={sections}
        collapsedEpicIds={collapsedEpicIds}
        onToggleCollapse={handleToggleCollapse}
      />

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
