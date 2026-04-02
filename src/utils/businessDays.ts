/**
 * Utility functions for business day calculations.
 * Business days = Monday through Friday (excludes Saturday and Sunday).
 * All date operations use Brazil timezone (America/Sao_Paulo).
 */

/** Returns date string YYYY-MM-DD in Brazil timezone */
export function getDateKeyBrazil(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Parse YYYY-MM-DD without timezone shift */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Check if a date falls on Saturday (6) or Sunday (0) */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Get the previous business day from a given date */
export function getPreviousBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  while (isWeekend(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/** Get start of day (00:00:00) for a date */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get all business days that were missed between lastMovedAt and today.
 * Only counts completed business days (not the current day).
 *
 * Example: last moved Friday, today is Wednesday →
 *   returns [Monday, Tuesday] (Sat/Sun excluded, Wed not yet ended)
 */
export function getMissedBusinessDays(lastMovedAt: Date, now: Date = new Date()): string[] {
  const todayKey = getDateKeyBrazil(now);
  const lastMovedKey = getDateKeyBrazil(lastMovedAt);

  // If moved today, no missed days
  if (lastMovedKey === todayKey) return [];

  const result: string[] = [];
  const lastMovedDate = parseLocalDate(lastMovedKey);
  const todayDate = parseLocalDate(todayKey);

  // Start from the day after last movement
  const cursor = new Date(lastMovedDate);
  cursor.setDate(cursor.getDate() + 1);

  // Go up to (but not including) today — today hasn't ended yet
  while (cursor < todayDate) {
    if (!isWeekend(cursor)) {
      result.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      );
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
