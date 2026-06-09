import { differenceInCalendarDays } from 'date-fns';

export type ExpiryState = 'none' | 'overdue' | 'due_soon' | 'future';

/**
 * Classifica a expiração de uma concessão para fins de UI/governança.
 *
 *   none      — sem prazo de revisão (contract_expires_at null).
 *   overdue   — data de revisão já passou (< hoje).
 *   due_soon  — vence em 0..7 dias (inclusive) — janela de alerta.
 *   future    — vence em > 7 dias.
 *
 * `now` injetável para testes determinísticos (default = agora).
 */
export function classifyExpiry(
  contractExpiresAt: string | null | undefined,
  now: Date = new Date(),
): ExpiryState {
  if (!contractExpiresAt) return 'none';
  const days = differenceInCalendarDays(new Date(contractExpiresAt), now);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'due_soon';
  return 'future';
}

/**
 * Conta concessões ATIVAS com revisão vencendo na janela de 7 dias (due_soon).
 * Vencidas (overdue) NÃO entram — "expirando em 7 dias" é alerta proativo, não
 * dívida já estourada.
 */
export function countExpiringSoon<
  T extends { status: string; contract_expires_at: string | null },
>(rows: T[], now: Date = new Date()): number {
  return rows.filter(
    (r) => r.status === 'ativa' && classifyExpiry(r.contract_expires_at, now) === 'due_soon',
  ).length;
}
