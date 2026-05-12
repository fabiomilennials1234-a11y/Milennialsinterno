/**
 * Parses a date-only string (e.g. '2025-05-15') into a Date object
 * using noon local time to avoid timezone-shift bugs.
 *
 * Problem: `new Date('2025-05-15')` interprets as UTC midnight.
 * In BRT (UTC-3), that becomes May 14 at 21:00 — one day earlier.
 *
 * Solution: Append 'T12:00:00' (no 'Z') so JS interprets as local noon.
 * Noon is safe from DST edge cases in both directions (±1h).
 *
 * ONLY use for Postgres `date` columns:
 *   - kanban_cards.due_date
 *   - ads_tasks.due_date
 *   - outbound_tasks.due_date
 *   - client_invoices.due_date
 *
 * Do NOT use for `timestamptz` columns (they already include timezone info).
 */
export function parseDateOnly(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}
