import { describe, it, expect } from 'vitest';
import { Bookmark, CircleDot, SquareCheck } from 'lucide-react';
import {
  epicColorFromKey,
  EPIC_PALETTE,
  ISSUE_TYPE_CONFIG,
  ISSUE_STATUS_CONFIG,
  BOARD_STATUS_ORDER,
  ISSUE_EXCEPTION_CONFIG,
  type IssueStatus,
  type IssueType,
  type IssueExceptionState,
} from './issueSystem';

// Invariant (a): epic color is BY HASH (deterministic), never persisted.
describe('epicColorFromKey', () => {
  it('is deterministic — same key always maps to the same color', () => {
    const keys = ['AGS', 'epic-42', 'torque', 'a', 'longer-key-value-here'];
    for (const key of keys) {
      const first = epicColorFromKey(key);
      // repeated calls must never drift
      for (let i = 0; i < 50; i += 1) {
        expect(epicColorFromKey(key)).toBe(first);
      }
    }
  });

  it('always returns a color from EPIC_PALETTE', () => {
    for (let i = 0; i < 200; i += 1) {
      const color = epicColorFromKey(`key-${i}`);
      expect(EPIC_PALETTE).toContain(color);
    }
  });

  it('distributes across the palette (uses more than one bucket)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(epicColorFromKey(`project-${i}`));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('falls back to the stable --mtech-epic-8 for null / undefined / empty', () => {
    expect(epicColorFromKey(null)).toBe('var(--mtech-epic-8)');
    expect(epicColorFromKey(undefined)).toBe('var(--mtech-epic-8)');
    expect(epicColorFromKey('')).toBe('var(--mtech-epic-8)');
  });
});

// Invariant (b): type glyphs are lucide-react, fixed per type.
describe('ISSUE_TYPE_CONFIG', () => {
  it('covers exactly STORY / BUG / TASK', () => {
    expect(Object.keys(ISSUE_TYPE_CONFIG).sort()).toEqual(['BUG', 'STORY', 'TASK']);
  });

  it('maps each type to its canonical lucide glyph', () => {
    expect(ISSUE_TYPE_CONFIG.STORY.icon).toBe(Bookmark);
    expect(ISSUE_TYPE_CONFIG.BUG.icon).toBe(CircleDot);
    expect(ISSUE_TYPE_CONFIG.TASK.icon).toBe(SquareCheck);
  });

  it('every type has a non-empty label, color and bg', () => {
    (Object.keys(ISSUE_TYPE_CONFIG) as IssueType[]).forEach((t) => {
      const cfg = ISSUE_TYPE_CONFIG[t];
      expect(cfg.label).toBeTruthy();
      expect(cfg.color).toMatch(/^var\(--mtech-/);
      expect(cfg.bg).toMatch(/^var\(--mtech-/);
    });
  });
});

describe('ISSUE_STATUS_CONFIG', () => {
  const statuses = Object.keys(ISSUE_STATUS_CONFIG) as IssueStatus[];

  it('covers the 7 canonical workflow statuses', () => {
    expect(statuses.sort()).toEqual(
      [
        'AWAITING_APPROVAL',
        'BACKLOG',
        'CHANGES_REQUESTED',
        'DONE',
        'IN_PROGRESS',
        'REVIEW',
        'TODO',
      ].sort(),
    );
  });

  it('has order values 0..6 with no gaps and no duplicates', () => {
    const orders = statuses.map((s) => ISSUE_STATUS_CONFIG[s].order).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('orders the workflow BACKLOG → TODO → ... → DONE', () => {
    const byOrder = [...statuses].sort(
      (a, b) => ISSUE_STATUS_CONFIG[a].order - ISSUE_STATUS_CONFIG[b].order,
    );
    expect(byOrder).toEqual([
      'BACKLOG',
      'TODO',
      'IN_PROGRESS',
      'REVIEW',
      'AWAITING_APPROVAL',
      'CHANGES_REQUESTED',
      'DONE',
    ]);
  });
});

describe('BOARD_STATUS_ORDER', () => {
  it('excludes BACKLOG (backlog lives in its own view)', () => {
    expect(BOARD_STATUS_ORDER).not.toContain('BACKLOG');
  });

  it('keeps the canonical left-to-right board order', () => {
    expect(BOARD_STATUS_ORDER).toEqual([
      'TODO',
      'IN_PROGRESS',
      'REVIEW',
      'AWAITING_APPROVAL',
      'CHANGES_REQUESTED',
      'DONE',
    ]);
  });

  it('is monotonically increasing by status order', () => {
    const orders = BOARD_STATUS_ORDER.map((s) => ISSUE_STATUS_CONFIG[s].order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });
});

describe('ISSUE_EXCEPTION_CONFIG', () => {
  it('covers BLOCKED / CHANGES_REQUESTED / AWAITING_APPROVAL', () => {
    expect(Object.keys(ISSUE_EXCEPTION_CONFIG).sort()).toEqual([
      'AWAITING_APPROVAL',
      'BLOCKED',
      'CHANGES_REQUESTED',
    ]);
  });

  it('every exception state has label, icon, color and bg', () => {
    (Object.keys(ISSUE_EXCEPTION_CONFIG) as IssueExceptionState[]).forEach((s) => {
      const cfg = ISSUE_EXCEPTION_CONFIG[s];
      expect(cfg.label).toBeTruthy();
      expect(cfg.icon).toBeTruthy();
      expect(cfg.color).toMatch(/^var\(--mtech-/);
      expect(cfg.bg).toMatch(/^var\(--mtech-/);
    });
  });
});
