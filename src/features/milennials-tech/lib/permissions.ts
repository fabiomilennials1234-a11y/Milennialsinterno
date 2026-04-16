import type { UserRole } from '@/types/auth';
import { isExecutive } from '@/types/auth';
import type { TechTask } from '../types';

export function canEditTask(
  userId: string | null,
  role: UserRole | null | undefined,
  task: TechTask,
  collaboratorUserIds: string[],
): boolean {
  if (!userId || !role) return false;
  if (isExecutive(role)) return true;
  if (task.assignee_id === userId) return true;
  if (collaboratorUserIds.includes(userId)) return true;
  return false;
}

export function canApprove(role: UserRole | null | undefined): boolean {
  return isExecutive(role);
}

export function canDragToColumn(
  userId: string | null,
  role: UserRole | null | undefined,
  task: TechTask,
  collaboratorUserIds: string[],
  targetColumn: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE',
  sourceColumn: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE',
): boolean {
  if (!canEditTask(userId, role, task, collaboratorUserIds)) return false;
  if (sourceColumn === 'REVIEW' && (targetColumn === 'DONE' || targetColumn === 'IN_PROGRESS')) {
    return canApprove(role);
  }
  return true;
}
