import { describe, it, expect } from 'vitest';
import { computeTaskSeconds, isTimerActive } from './computeTaskTime';
import type { TechTimeEntry } from '../types';

const entry = (type: TechTimeEntry['type'], time: string): TechTimeEntry => ({
  id: crypto.randomUUID(), task_id: 't1', user_id: 'u1', type, created_at: time,
});

describe('computeTaskSeconds', () => {
  it('returns 0 for empty', () => {
    expect(computeTaskSeconds([])).toBe(0);
  });
  it('computes START/STOP interval', () => {
    const entries = [
      entry('START', '2026-01-01T00:00:00Z'),
      entry('STOP', '2026-01-01T01:00:00Z'),
    ];
    expect(computeTaskSeconds(entries)).toBe(3600);
  });
  it('handles START/PAUSE/RESUME/STOP', () => {
    const entries = [
      entry('START', '2026-01-01T00:00:00Z'),
      entry('PAUSE', '2026-01-01T00:30:00Z'),
      entry('RESUME', '2026-01-01T01:00:00Z'),
      entry('STOP', '2026-01-01T01:30:00Z'),
    ];
    expect(computeTaskSeconds(entries)).toBe(3600);
  });
  it('extends open timer to now', () => {
    const entries = [entry('START', '2026-01-01T00:00:00Z')];
    const now = new Date('2026-01-01T00:10:00Z');
    expect(computeTaskSeconds(entries, now)).toBe(600);
  });
});

describe('isTimerActive', () => {
  it('false when empty', () => {
    expect(isTimerActive([])).toBe(false);
  });
  it('true after START', () => {
    expect(isTimerActive([entry('START', '2026-01-01T00:00:00Z')])).toBe(true);
  });
  it('false after STOP', () => {
    const entries = [entry('START', '2026-01-01T00:00:00Z'), entry('STOP', '2026-01-01T01:00:00Z')];
    expect(isTimerActive(entries)).toBe(false);
  });
});
