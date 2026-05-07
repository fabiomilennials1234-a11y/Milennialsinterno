import { describe, it, expect } from 'vitest';
import {
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  PROJECT_TASK_TITLE,
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  PROJECT_PRIORITY_LABEL,
  PROJECT_MEMBER_ROLE_LABEL,
  getNextProjectStep,
  isLastProjectStep,
  type ProjectStep,
} from './projectSteps';

// =============================================================
// Pure function tests — state machine, step navigation, labels.
// Mirrors useCrmKanban.test.ts pattern.
// =============================================================

describe('Project Steps — step definitions', () => {
  it('has exactly 8 steps', () => {
    expect(PROJECT_STEPS).toHaveLength(8);
  });

  it('first step is briefing', () => {
    expect(PROJECT_STEPS[0]).toBe('briefing');
  });

  it('last step is acompanhamento', () => {
    expect(PROJECT_STEPS[PROJECT_STEPS.length - 1]).toBe('acompanhamento');
  });

  it('no duplicate steps', () => {
    const unique = new Set(PROJECT_STEPS);
    expect(unique.size).toBe(PROJECT_STEPS.length);
  });

  it('all steps are in expected order', () => {
    expect([...PROJECT_STEPS]).toEqual([
      'briefing',
      'arquitetura',
      'setup_ambiente',
      'desenvolvimento',
      'code_review',
      'testes',
      'deploy',
      'acompanhamento',
    ]);
  });
});

describe('getNextProjectStep', () => {
  it('briefing advances to arquitetura', () => {
    expect(getNextProjectStep('briefing')).toBe('arquitetura');
  });

  it('deploy advances to acompanhamento', () => {
    expect(getNextProjectStep('deploy')).toBe('acompanhamento');
  });

  it('acompanhamento returns null (last step)', () => {
    expect(getNextProjectStep('acompanhamento')).toBeNull();
  });

  it('unknown step returns null', () => {
    expect(getNextProjectStep('nonexistent')).toBeNull();
  });

  it('full traversal hits all 8 steps', () => {
    const visited: string[] = [PROJECT_STEPS[0]];
    let current: string | null = PROJECT_STEPS[0];
    while (current !== null) {
      current = getNextProjectStep(current);
      if (current) visited.push(current);
    }
    expect(visited).toEqual([...PROJECT_STEPS]);
  });
});

describe('isLastProjectStep', () => {
  it('acompanhamento is last step', () => {
    expect(isLastProjectStep('acompanhamento')).toBe(true);
  });

  it('briefing is NOT last step', () => {
    expect(isLastProjectStep('briefing')).toBe(false);
  });

  it('unknown step is NOT last step', () => {
    expect(isLastProjectStep('nope')).toBe(false);
  });
});

describe('PROJECT_STEP_LABEL — every step has a label', () => {
  it.each([...PROJECT_STEPS])('%s has a non-empty label', (step) => {
    expect(PROJECT_STEP_LABEL[step as ProjectStep]).toBeDefined();
    expect(PROJECT_STEP_LABEL[step as ProjectStep].length).toBeGreaterThan(0);
  });
});

describe('PROJECT_TASK_TITLE — every step has a title generator', () => {
  it.each([...PROJECT_STEPS])('%s has a title function', (step) => {
    const fn = PROJECT_TASK_TITLE[step as ProjectStep];
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  it.each([...PROJECT_STEPS])('%s title includes project name', (step) => {
    const fn = PROJECT_TASK_TITLE[step as ProjectStep];
    const result = fn('Acme CRM');
    expect(result).toContain('Acme CRM');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Label records — completeness', () => {
  it('PROJECT_STATUS_LABEL covers all statuses', () => {
    const statuses = ['planning', 'active', 'paused', 'completed'];
    for (const s of statuses) {
      expect(PROJECT_STATUS_LABEL[s as keyof typeof PROJECT_STATUS_LABEL]).toBeDefined();
    }
  });

  it('PROJECT_TYPE_LABEL covers client and internal', () => {
    expect(PROJECT_TYPE_LABEL.client).toBeDefined();
    expect(PROJECT_TYPE_LABEL.internal).toBeDefined();
  });

  it('PROJECT_PRIORITY_LABEL covers all priorities', () => {
    const priorities = ['critical', 'high', 'medium', 'low'];
    for (const p of priorities) {
      expect(PROJECT_PRIORITY_LABEL[p as keyof typeof PROJECT_PRIORITY_LABEL]).toBeDefined();
    }
  });

  it('PROJECT_MEMBER_ROLE_LABEL covers all roles', () => {
    const roles = ['lead', 'dev', 'design', 'qa'];
    for (const r of roles) {
      expect(PROJECT_MEMBER_ROLE_LABEL[r as keyof typeof PROJECT_MEMBER_ROLE_LABEL]).toBeDefined();
    }
  });
});
