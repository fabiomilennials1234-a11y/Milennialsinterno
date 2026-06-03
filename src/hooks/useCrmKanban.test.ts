import { describe, it, expect } from 'vitest';
import {
  TORQUE_STEPS,
  AUTOMATION_STEPS,
  COPILOT_STEPS,
  CRM_STEPS_BY_PRODUTO,
  CRM_STEP_LABEL,
  CRM_PHASES_BY_PRODUTO,
  type CrmProduto,
} from './useCrmKanban';

// =============================================================
// Pure data tests — step definitions (seed do checklist), step labels e
// agrupamento de fases (mapa de jornada). Cobre Torque, Automation e Copilot.
//
// Pós-Slice 7 (#97): a state-machine de avanço (getNextStep/isLastStep), o SLA
// (getConfigDueDate/CRM_CONFIG_DEADLINE_DAYS) e os geradores de título de
// tarefa (CRM_TASK_TITLE) foram aposentados — seus testes saíram junto.
// =============================================================

const ALL_PRODUCTS: CrmProduto[] = ['torque', 'automation', 'copilot'];

describe('CRM Steps — definições (seed do checklist)', () => {
  it.each(ALL_PRODUCTS)('%s: first step is receber_briefing', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    expect(steps[0]).toBe('receber_briefing');
  });

  it.each(ALL_PRODUCTS)('%s: last step is call_pos_venda', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    expect(steps[steps.length - 1]).toBe('call_pos_venda');
  });

  it('Torque has 12 steps', () => {
    expect(TORQUE_STEPS).toHaveLength(12);
  });

  it('Automation has 16 steps', () => {
    expect(AUTOMATION_STEPS).toHaveLength(16);
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

describe('CRM_STEP_LABEL — every step has a human label', () => {
  it.each(ALL_PRODUCTS)('%s: every step has a label', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    for (const step of steps) {
      expect(CRM_STEP_LABEL[step]).toBeDefined();
      expect(CRM_STEP_LABEL[step].length).toBeGreaterThan(0);
    }
  });
});

describe('CRM_PHASES_BY_PRODUTO — phase grouping integrity (mapa de jornada)', () => {
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
