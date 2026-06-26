import { describe, it, expect } from 'vitest';
import type { IssueStatus } from './issueSystem';
import { canTransition, nextStatuses, applyTransition, type TransitionCtx } from './workflow';

// ---------------------------------------------------------------------------
// Exhaustive workflow matrix (#157). The legal-edge table below is an
// INDEPENDENT re-encoding of the pinned spec — not imported from the module
// under test — so the loop is a real oracle, not a tautology. We iterate the
// full cartesian product 7 from × 7 to × hasClient{T,F} × isBlocked{T,F} = 196
// cells and assert each against the oracle.
// ---------------------------------------------------------------------------

const ALL: IssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'AWAITING_APPROVAL',
  'CHANGES_REQUESTED',
  'DONE',
];

const CTXS: TransitionCtx[] = [
  { hasClient: true, isBlocked: false },
  { hasClient: false, isBlocked: false },
  { hasClient: true, isBlocked: true },
  { hasClient: false, isBlocked: true },
];

/** Hand-typed oracle from the canonical matrix. Blocked freezes everything. */
function oracle(from: IssueStatus, to: IssueStatus, ctx: TransitionCtx): boolean {
  if (ctx.isBlocked) return false;
  switch (`${from}->${to}`) {
    case 'BACKLOG->TODO':
      return true;
    case 'TODO->IN_PROGRESS':
      return true;
    case 'IN_PROGRESS->REVIEW':
      return true;
    case 'IN_PROGRESS->TODO':
      return true;
    case 'REVIEW->AWAITING_APPROVAL':
      return ctx.hasClient;
    case 'REVIEW->DONE':
      return !ctx.hasClient;
    case 'REVIEW->CHANGES_REQUESTED':
      return true;
    case 'REVIEW->IN_PROGRESS':
      return true;
    case 'AWAITING_APPROVAL->DONE':
      return true;
    case 'AWAITING_APPROVAL->CHANGES_REQUESTED':
      return true;
    case 'CHANGES_REQUESTED->IN_PROGRESS':
      return true;
    case 'DONE->IN_PROGRESS':
      return true;
    default:
      return false;
  }
}

describe('canTransition — full cartesian product', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      for (const ctx of CTXS) {
        const label = `${from} → ${to} [client=${ctx.hasClient} blocked=${ctx.isBlocked}]`;
        it(label, () => {
          expect(canTransition(from, to, ctx)).toBe(oracle(from, to, ctx));
        });
      }
    }
  }
});

describe('client gate on REVIEW (approval skip)', () => {
  const unblockedWithClient: TransitionCtx = { hasClient: true, isBlocked: false };
  const unblockedNoClient: TransitionCtx = { hasClient: false, isBlocked: false };

  it('with client: REVIEW → AWAITING_APPROVAL legal, REVIEW → DONE illegal', () => {
    expect(canTransition('REVIEW', 'AWAITING_APPROVAL', unblockedWithClient)).toBe(true);
    expect(canTransition('REVIEW', 'DONE', unblockedWithClient)).toBe(false);
  });

  it('without client: REVIEW → DONE legal (skip), REVIEW → AWAITING_APPROVAL illegal', () => {
    expect(canTransition('REVIEW', 'DONE', unblockedNoClient)).toBe(true);
    expect(canTransition('REVIEW', 'AWAITING_APPROVAL', unblockedNoClient)).toBe(false);
  });
});

describe('changes-requested loop', () => {
  const ctx: TransitionCtx = { hasClient: true, isBlocked: false };
  it('REVIEW → CHANGES_REQUESTED → IN_PROGRESS', () => {
    expect(canTransition('REVIEW', 'CHANGES_REQUESTED', ctx)).toBe(true);
    expect(canTransition('CHANGES_REQUESTED', 'IN_PROGRESS', ctx)).toBe(true);
  });
  it('client reproves from AWAITING_APPROVAL → CHANGES_REQUESTED', () => {
    expect(canTransition('AWAITING_APPROVAL', 'CHANGES_REQUESTED', ctx)).toBe(true);
  });
});

describe('blocked freezes every transition', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      it(`${from} → ${to} blocked ⇒ false (client=true)`, () => {
        expect(canTransition(from, to, { hasClient: true, isBlocked: true })).toBe(false);
      });
      it(`${from} → ${to} blocked ⇒ false (client=false)`, () => {
        expect(canTransition(from, to, { hasClient: false, isBlocked: true })).toBe(false);
      });
    }
  }
});

describe('no self-transition', () => {
  for (const s of ALL) {
    it(`${s} → ${s} ⇒ false`, () => {
      expect(canTransition(s, s, { hasClient: true, isBlocked: false })).toBe(false);
      expect(canTransition(s, s, { hasClient: false, isBlocked: false })).toBe(false);
    });
  }
});

describe('nextStatuses agrees with canTransition for every from × ctx', () => {
  for (const from of ALL) {
    for (const ctx of CTXS) {
      it(`${from} [client=${ctx.hasClient} blocked=${ctx.isBlocked}]`, () => {
        const expected = ALL.filter((to) => canTransition(from, to, ctx));
        const actual = nextStatuses(from, ctx);
        expect([...actual].sort()).toEqual([...expected].sort());
        // never includes self
        expect(actual).not.toContain(from);
      });
    }
  }
});

describe('nextStatuses concrete shapes', () => {
  it('REVIEW with client offers approval path, not direct done', () => {
    const ns = nextStatuses('REVIEW', { hasClient: true, isBlocked: false });
    expect(ns).toContain('AWAITING_APPROVAL');
    expect(ns).not.toContain('DONE');
  });
  it('REVIEW without client offers direct done, not approval', () => {
    const ns = nextStatuses('REVIEW', { hasClient: false, isBlocked: false });
    expect(ns).toContain('DONE');
    expect(ns).not.toContain('AWAITING_APPROVAL');
  });
  it('blocked ⇒ empty', () => {
    expect(nextStatuses('IN_PROGRESS', { hasClient: true, isBlocked: true })).toEqual([]);
  });
});

describe('no terminal status when unblocked (board draggability invariant)', () => {
  // The presentational board sets draggable={hasAnyLegalTarget(id)}. If any
  // status had an empty nextStatuses, those cards would be un-draggable. DONE
  // → IN_PROGRESS (reopen) guarantees DONE is not terminal either.
  for (const from of ALL) {
    it(`${from} has ≥1 legal target (client=true)`, () => {
      expect(nextStatuses(from, { hasClient: true, isBlocked: false }).length).toBeGreaterThan(0);
    });
    it(`${from} has ≥1 legal target (client=false)`, () => {
      expect(nextStatuses(from, { hasClient: false, isBlocked: false }).length).toBeGreaterThan(0);
    });
  }
});

describe('applyTransition', () => {
  const ctx: TransitionCtx = { hasClient: false, isBlocked: false };
  it('returns the target on a legal move', () => {
    expect(applyTransition('TODO', 'IN_PROGRESS', ctx)).toBe('IN_PROGRESS');
  });
  it('throws on an illegal move', () => {
    expect(() => applyTransition('TODO', 'DONE', ctx)).toThrow();
  });
  it('throws when blocked even for an otherwise-legal edge', () => {
    expect(() => applyTransition('TODO', 'IN_PROGRESS', { hasClient: false, isBlocked: true })).toThrow();
  });
});
