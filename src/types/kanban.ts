export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CardStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  priority: CardPriority;
  assigneeId?: string;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  progress?: number; // 0-100
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: CardStatus;
  cards: KanbanCard[];
  color?: string;
}

export interface KanbanBoard {
  id: string;
  title: string;
  description?: string;
  columns: KanbanColumn[];
  createdBy: string;
  createdAt: string;
}

// Cores por prioridade
export const PRIORITY_COLORS: Record<CardPriority, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' },
  medium: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  high: { bg: 'bg-warning/10', text: 'text-warning-foreground', border: 'border-warning/30' },
  urgent: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
};

export const PRIORITY_LABELS: Record<CardPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const STATUS_LABELS: Record<CardStatus, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  review: 'Revisão',
  done: 'Concluído',
};
