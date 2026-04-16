import type { TechTaskStatus, TechTaskType, TechTaskPriority } from '../types';

export const STATUS_LABEL_PT: Record<TechTaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'A fazer',
  IN_PROGRESS: 'Fazendo',
  REVIEW: 'Em Review',
  DONE: 'Feito',
};

export const KANBAN_COLUMNS: TechTaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export const TYPE_LABEL: Record<TechTaskType, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  HOTFIX: 'Hotfix',
  CHORE: 'Chore',
};

/** Friendly labels for the creation form (non-technical users) */
export const TYPE_LABEL_FRIENDLY: Record<TechTaskType, { label: string; hint: string }> = {
  BUG: { label: 'Problema', hint: 'Algo que está quebrado ou errado' },
  FEATURE: { label: 'Melhoria', hint: 'Algo novo que precisa ser construído' },
  HOTFIX: { label: 'Urgente', hint: 'Precisa ser resolvido imediatamente' },
  CHORE: { label: 'Tarefa', hint: 'Manutenção, organização, ajustes' },
};

export const PRIORITY_LABEL: Record<TechTaskPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const PRIORITY_LABEL_FRIENDLY: Record<TechTaskPriority, { label: string; hint: string }> = {
  CRITICAL: { label: 'Urgente', hint: 'Parar tudo e resolver' },
  HIGH: { label: 'Alta', hint: 'Resolver essa semana' },
  MEDIUM: { label: 'Normal', hint: 'Entrar no próximo ciclo' },
  LOW: { label: 'Pode esperar', hint: 'Quando houver tempo' },
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
