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
