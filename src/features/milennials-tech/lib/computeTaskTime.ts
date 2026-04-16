import type { TechTimeEntry } from '../types';

export function computeTaskSeconds(entries: TechTimeEntry[], now: Date = new Date()): number {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let total = 0;
  let openAt: number | null = null;
  for (const e of sorted) {
    const at = new Date(e.created_at).getTime();
    if (e.type === 'START' || e.type === 'RESUME') {
      openAt = at;
    } else if ((e.type === 'PAUSE' || e.type === 'STOP') && openAt != null) {
      total += (at - openAt) / 1000;
      openAt = null;
    }
  }
  if (openAt != null) total += (now.getTime() - openAt) / 1000;
  return Math.round(total);
}

export function isTimerActive(entries: TechTimeEntry[]): boolean {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const last = sorted[sorted.length - 1];
  return last ? (last.type === 'START' || last.type === 'RESUME') : false;
}
