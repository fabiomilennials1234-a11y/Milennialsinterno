import { isPast, isToday } from 'date-fns';
import { parseDateOnly } from './dateUtils';

/**
 * Invariante de domínio: um card só pode estar ATRASADO se ainda NÃO foi
 * entregue. "Entregue" = o card atingiu um status terminal de aprovação do seu
 * board (ex.: `para_aprovacao`/`aprovado` no Design; `aguardando_aprovacao`/
 * `aprovados` no Vídeo e Devs).
 *
 * Antes desta função, a regra de overdue vivia duplicada em 3 lugares
 * (SpecializedKanbanBoard, createKanbanDelayHooks, CardDetailModal) e nenhum
 * deles considerava o status — cards aprovados apareciam como atrasados, o que
 * disparava modal de justificativa indevida e inflava relatórios de delay.
 *
 * Esta é a fonte única da verdade. Os status terminais vêm da config de cada
 * board (não há literal de status aqui) — ver `terminalStatusesFromConfig`.
 */
export interface OverdueCardLike {
  due_date: string | null;
  status: string | null;
}

export function isCardOverdue(
  card: OverdueCardLike,
  terminalStatuses: readonly string[] = [],
): boolean {
  if (!card.due_date) return false;
  // Card entregue/aprovado nunca conta como atrasado, independente do deadline.
  if (card.status && terminalStatuses.includes(card.status)) return false;
  const dueDate = parseDateOnly(card.due_date);
  return isPast(dueDate) && !isToday(dueDate);
}

/**
 * Extrai os status terminais a partir da lista de status do board.
 * Um status é terminal quando marcado com `terminal: true` na config.
 */
export function terminalStatusesFromConfig(
  statuses: readonly { id: string; terminal?: boolean }[],
): string[] {
  return statuses.filter((s) => s.terminal).map((s) => s.id);
}
