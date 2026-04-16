import type { TechTaskStatus, TechTaskType, TechTaskPriority } from '../types';

export const STATUS_LABEL_PT: Record<TechTaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'A fazer',
  IN_PROGRESS: 'Fazendo',
  REVIEW: 'Em teste',
  DONE: 'Feito',
};

export const KANBAN_COLUMNS: TechTaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export const TYPE_LABEL: Record<TechTaskType, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  HOTFIX: 'Hotfix',
  CHORE: 'Chore',
};

export const PRIORITY_LABEL: Record<TechTaskPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const ACTIVITY_LABEL: Record<string, string> = {
  task_created: 'Task criada',
  status_changed: 'Status alterado',
  timer_started: 'Timer iniciado',
  timer_paused: 'Timer pausado',
  timer_resumed: 'Timer retomado',
  timer_stopped: 'Timer parado',
  sent_to_review: 'Enviada para review',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  task_blocked: 'Bloqueada',
  task_unblocked: 'Desbloqueada',
};
