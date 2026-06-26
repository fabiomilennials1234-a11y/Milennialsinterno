import { useCreateSubtask } from '../hooks/useTechIssues';
import { SubtaskSection, type SubtaskItem, type SubtaskCreatePayload } from './SubtaskSection';
import type { AssigneeOption } from './backlogTypes';

// ---------------------------------------------------------------------------
// SubtaskSectionContainer (#158) — wires the inline composer to the mutation.
//
// The sub-task LIST (and the assignee options) are owned by the issue-view that
// hosts this section, so they arrive as props; the container owns only the
// create round-trip. tech_issue_create gates tech staff server-side and rejects
// points/epic on a sub-task, so a 42501 surfaces as a permission message inline.
// ---------------------------------------------------------------------------

export interface SubtaskSectionContainerProps {
  parentId: string;
  subtasks: SubtaskItem[];
  assignees: AssigneeOption[];
  onSubtaskClick?: (id: string) => void;
  readOnly?: boolean;
  className?: string;
}

function messageFor(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '42501') return 'Você não tem permissão para criar sub-tarefas.';
  const message = (error as { message?: string } | null)?.message;
  return message ?? 'Não foi possível criar a sub-tarefa.';
}

export function SubtaskSectionContainer({
  parentId,
  subtasks,
  assignees,
  onSubtaskClick,
  readOnly = false,
  className,
}: SubtaskSectionContainerProps) {
  const createSubtask = useCreateSubtask();

  function handleCreate(payload: SubtaskCreatePayload) {
    createSubtask.mutate({
      parentId,
      title: payload.title,
      assigneeId: payload.assigneeId,
    });
  }

  return (
    <SubtaskSection
      subtasks={subtasks}
      assignees={assignees}
      onCreate={handleCreate}
      isCreating={createSubtask.isPending}
      error={createSubtask.isError ? messageFor(createSubtask.error) : null}
      onSubtaskClick={onSubtaskClick}
      readOnly={readOnly}
      className={className}
    />
  );
}
