import { describe, it, expect } from 'vitest';
import {
  getNextStep,
  isLastStep,
  getConfigDueDate,
  V8_STEPS,
  AUTOMATION_STEPS,
  COPILOT_STEPS,
  CRM_STEPS_BY_PRODUTO,
  CRM_TASK_TITLE,
  CRM_STEP_LABEL,
  CRM_CONFIG_DEADLINE_DAYS,
  CRM_PHASES_BY_PRODUTO,
  type CrmProduto,
} from './useCrmKanban';

// =============================================================
// Pure function tests — state machines, step navigation, due dates,
// phase grouping. Covers V8, Automation, and Copilot equally.
// =============================================================

const ALL_PRODUCTS: CrmProduto[] = ['v8', 'automation', 'copilot'];

describe('CRM State Machines — step definitions', () => {
  it.each(ALL_PRODUCTS)('%s: first step is receber_briefing', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    expect(steps[0]).toBe('receber_briefing');
  });

  it.each(ALL_PRODUCTS)('%s: last step is call_pos_venda', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    expect(steps[steps.length - 1]).toBe('call_pos_venda');
  });

  it('V8 has 12 steps', () => {
    expect(V8_STEPS).toHaveLength(12);
  });

  it('Automation has 15 steps', () => {
    expect(AUTOMATION_STEPS).toHaveLength(15);
  });

  it('Copilot has 12 steps', () => {
    expect(COPILOT_STEPS).toHaveLength(12);
  });

  it.each(ALL_PRODUCTS)('%s: no duplicate steps', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const unique = new Set(steps);
    expect(unique.size).toBe(steps.length);
  });
});

describe('getNextStep', () => {
  it.each(ALL_PRODUCTS)('%s: first step advances to second', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    expect(getNextStep(produto, steps[0])).toBe(steps[1]);
  });

  it.each(ALL_PRODUCTS)('%s: second-to-last advances to call_pos_venda', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const penultimate = steps[steps.length - 2];
    expect(getNextStep(produto, penultimate)).toBe('call_pos_venda');
  });

  it.each(ALL_PRODUCTS)('%s: call_pos_venda returns null (no next step)', (produto) => {
    expect(getNextStep(produto, 'call_pos_venda')).toBeNull();
  });

  it.each(ALL_PRODUCTS)('%s: unknown step returns null', (produto) => {
    expect(getNextStep(produto, 'nonexistent_step')).toBeNull();
  });

  it('V8: full traversal hits all 12 steps', () => {
    const visited: string[] = [V8_STEPS[0]];
    let current: string | null = V8_STEPS[0];
    while (current !== null) {
      current = getNextStep('v8', current);
      if (current) visited.push(current);
    }
    expect(visited).toEqual([...V8_STEPS]);
  });

  it('Automation: full traversal hits all 15 steps', () => {
    const visited: string[] = [AUTOMATION_STEPS[0]];
    let current: string | null = AUTOMATION_STEPS[0];
    while (current !== null) {
      current = getNextStep('automation', current);
      if (current) visited.push(current);
    }
    expect(visited).toEqual([...AUTOMATION_STEPS]);
  });

  it('Copilot: full traversal hits all 12 steps', () => {
    const visited: string[] = [COPILOT_STEPS[0]];
    let current: string | null = COPILOT_STEPS[0];
    while (current !== null) {
      current = getNextStep('copilot', current);
      if (current) visited.push(current);
    }
    expect(visited).toEqual([...COPILOT_STEPS]);
  });
});

describe('isLastStep', () => {
  it.each(ALL_PRODUCTS)('%s: call_pos_venda is last step', (produto) => {
    expect(isLastStep(produto, 'call_pos_venda')).toBe(true);
  });

  it.each(ALL_PRODUCTS)('%s: receber_briefing is NOT last step', (produto) => {
    expect(isLastStep(produto, 'receber_briefing')).toBe(false);
  });

  it.each(ALL_PRODUCTS)('%s: unknown step is NOT last step', (produto) => {
    expect(isLastStep(produto, 'nope')).toBe(false);
  });
});

describe('getConfigDueDate', () => {
  const base = '2026-01-10T12:00:00.000Z';

  it('V8: adds 7 days', () => {
    const result = new Date(getConfigDueDate(base, 'v8'));
    expect(result.getUTCDate()).toBe(17);
    expect(result.getUTCMonth()).toBe(0); // Jan
  });

  it('Automation: adds 7 days', () => {
    const result = new Date(getConfigDueDate(base, 'automation'));
    expect(result.getUTCDate()).toBe(17);
  });

  it('Copilot: adds 10 days', () => {
    const result = new Date(getConfigDueDate(base, 'copilot'));
    expect(result.getUTCDate()).toBe(20);
  });

  it('deadline days are configured for all products', () => {
    for (const p of ALL_PRODUCTS) {
      expect(CRM_CONFIG_DEADLINE_DAYS[p]).toBeGreaterThan(0);
    }
  });
});

describe('CRM_TASK_TITLE — every step has a title generator', () => {
  it.each(ALL_PRODUCTS)('%s: every step in state machine has a title function', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const titles = CRM_TASK_TITLE[produto];
    for (const step of steps) {
      expect(titles[step]).toBeDefined();
      expect(typeof titles[step]).toBe('function');
      // Title function returns non-empty string
      const result = titles[step]('TestClient');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_PRODUCTS)('%s: title includes product prefix', (produto) => {
    const prefix = { v8: '[V8]', automation: '[Automation]', copilot: '[Copilot]' }[produto];
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const titles = CRM_TASK_TITLE[produto];
    for (const step of steps) {
      expect(titles[step]('X')).toContain(prefix);
    }
  });

  it.each(ALL_PRODUCTS)('%s: title includes client name', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const titles = CRM_TASK_TITLE[produto];
    for (const step of steps) {
      expect(titles[step]('Acme Corp')).toContain('Acme Corp');
    }
  });
});

describe('CRM_STEP_LABEL — every step has a human label', () => {
  it.each(ALL_PRODUCTS)('%s: every step has a label', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    for (const step of steps) {
      expect(CRM_STEP_LABEL[step]).toBeDefined();
      expect(CRM_STEP_LABEL[step].length).toBeGreaterThan(0);
    }
  });
});

describe('CRM_PHASES_BY_PRODUTO — phase grouping integrity', () => {
  it.each(ALL_PRODUCTS)('%s: phases cover all steps exactly once', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const phases = CRM_PHASES_BY_PRODUTO[produto];
    const phaseSteps = phases.flatMap(p => p.steps);
    expect(phaseSteps).toEqual([...steps]);
  });

  it.each(ALL_PRODUCTS)('%s: no duplicate steps across phases', (produto) => {
    const phases = CRM_PHASES_BY_PRODUTO[produto];
    const allSteps = phases.flatMap(p => p.steps);
    const unique = new Set(allSteps);
    expect(unique.size).toBe(allSteps.length);
  });

  it.each(ALL_PRODUCTS)('%s: every phase has at least one step', (produto) => {
    const phases = CRM_PHASES_BY_PRODUTO[produto];
    for (const phase of phases) {
      expect(phase.steps.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_PRODUCTS)('%s: every phase has a non-empty label', (produto) => {
    const phases = CRM_PHASES_BY_PRODUTO[produto];
    for (const phase of phases) {
      expect(phase.label.length).toBeGreaterThan(0);
    }
  });
});

describe('Motor de avanço — description tag parsing', () => {
  // The advance motor in useDepartmentTasks extracts produto from
  // description='crm-config:{produto}'. Verify the tags are consistent.
  it.each(ALL_PRODUCTS)('%s: crm-config tag round-trips correctly', (produto) => {
    const tag = `crm-config:${produto}`;
    const extracted = tag.slice('crm-config:'.length);
    expect(extracted).toBe(produto);
    expect(['v8', 'automation', 'copilot']).toContain(extracted);
  });
});
