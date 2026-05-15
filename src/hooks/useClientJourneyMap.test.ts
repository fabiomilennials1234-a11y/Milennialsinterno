import { describe, it, expect } from 'vitest';
import {
  buildOnboardingPipeline,
  buildComercialPipeline,
  buildMktplacePipeline,
  buildCrmPipeline,
  buildCrmPhases,
  type JourneyStep,
} from './useClientJourneyMap';
import { PADDOCK_STEPS } from './useComercialAutomation';
import {
  CRM_STEPS_BY_PRODUTO,
  CRM_PHASES_BY_PRODUTO,
  type CrmProduto,
} from './useCrmKanban';
import { MKTPLACE_CONSULTORIA_STEPS, MKTPLACE_GESTAO_STEPS } from './useMktplaceKanban';

// ===================== ONBOARDING GROWTH =====================

describe('buildOnboardingPipeline', () => {
  it('milestone 2 → step 0 is current, rest upcoming', () => {
    const p = buildOnboardingPipeline(2, null);
    expect(p.currentStepIndex).toBe(0);
    expect(p.isCompleted).toBe(false);
    expect(p.steps[0].status).toBe('current');
    expect(p.steps[1].status).toBe('upcoming');
    expect(p.steps[3].status).toBe('upcoming');
  });

  it('milestone 3 → step 0 completed, step 1 current', () => {
    const p = buildOnboardingPipeline(3, null);
    expect(p.currentStepIndex).toBe(1);
    expect(p.steps[0].status).toBe('completed');
    expect(p.steps[1].status).toBe('current');
    expect(p.steps[2].status).toBe('upcoming');
  });

  it('milestone 5 → step 3 is current (last milestone)', () => {
    const p = buildOnboardingPipeline(5, null);
    expect(p.currentStepIndex).toBe(3);
    expect(p.steps[3].status).toBe('current');
    expect(p.isCompleted).toBe(false);
  });

  it('completed (completed_at set) → all steps completed', () => {
    const p = buildOnboardingPipeline(5, '2026-01-01T00:00:00Z');
    expect(p.isCompleted).toBe(true);
    expect(p.currentStepIndex).toBe(4); // beyond last
    expect(p.steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('null milestone defaults to 2', () => {
    const p = buildOnboardingPipeline(null, null);
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
  });

  it('always returns 4 steps (M1 removed)', () => {
    const p = buildOnboardingPipeline(2, null);
    expect(p.steps).toHaveLength(4);
  });

  it('metadata is correct', () => {
    const p = buildOnboardingPipeline(2, null);
    expect(p.id).toBe('onboarding');
    expect(p.icon).toBe('Rocket');
    expect(p.color).toBe('amber');
    expect(p.isActive).toBe(true);
  });
});

// ===================== COMERCIAL / PADDOCK =====================

describe('buildComercialPipeline', () => {
  it('returns null when comercial_status is null', () => {
    expect(buildComercialPipeline(null, null)).toBeNull();
  });

  it('novo status → all upcoming, currentStepIndex = -1', () => {
    const p = buildComercialPipeline('novo', null)!;
    expect(p.currentStepIndex).toBe(-1);
    expect(p.steps.every(s => s.status === 'upcoming')).toBe(true);
    expect(p.isCompleted).toBe(false);
  });

  it('onboarding_paddock at step 0 → step 0 current', () => {
    const p = buildComercialPipeline('onboarding_paddock', PADDOCK_STEPS[0])!;
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
    expect(p.steps[1].status).toBe('upcoming');
  });

  it('onboarding_paddock at last step → previous steps completed, last step current', () => {
    const lastIdx = PADDOCK_STEPS.length - 1;
    const p = buildComercialPipeline('onboarding_paddock', PADDOCK_STEPS[lastIdx])!;
    expect(p.currentStepIndex).toBe(lastIdx);
    for (let i = 0; i < lastIdx; i++) {
      expect(p.steps[i].status).toBe('completed');
    }
    expect(p.steps[lastIdx].status).toBe('current');
  });

  it('em_acompanhamento → all completed', () => {
    const p = buildComercialPipeline('em_acompanhamento', null)!;
    expect(p.isCompleted).toBe(true);
    expect(p.currentStepIndex).toBe(p.steps.length);
    expect(p.steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('consultoria_marcada (legacy) → step 0 current', () => {
    const p = buildComercialPipeline('consultoria_marcada', null)!;
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
  });

  it('has correct number of steps matching PADDOCK_STEPS', () => {
    const p = buildComercialPipeline('novo', null)!;
    expect(p.steps).toHaveLength(PADDOCK_STEPS.length);
  });

  it('metadata is correct', () => {
    const p = buildComercialPipeline('novo', null)!;
    expect(p.id).toBe('comercial');
    expect(p.icon).toBe('Handshake');
    expect(p.color).toBe('rose');
  });
});

// ===================== MKT PLACE =====================

describe('buildMktplacePipeline — Consultoria', () => {
  it('returns null when mktplace_status is null', () => {
    expect(buildMktplacePipeline(null, false)).toBeNull();
  });

  it('novo → all upcoming, index = -1', () => {
    const p = buildMktplacePipeline('novo', false)!;
    expect(p.currentStepIndex).toBe(-1);
    expect(p.steps.every(s => s.status === 'upcoming')).toBe(true);
  });

  it('consultoria_marcada → step 0 current', () => {
    const p = buildMktplacePipeline('consultoria_marcada', false)!;
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
    expect(p.steps[1].status).toBe('upcoming');
  });

  it('material_enviado → step 3 current, 0-2 completed', () => {
    const p = buildMktplacePipeline('material_enviado', false)!;
    expect(p.currentStepIndex).toBe(3);
    expect(p.steps[0].status).toBe('completed');
    expect(p.steps[1].status).toBe('completed');
    expect(p.steps[2].status).toBe('completed');
    expect(p.steps[3].status).toBe('current');
  });

  it('acompanhamento_consultoria → all completed', () => {
    const p = buildMktplacePipeline('acompanhamento_consultoria', false)!;
    expect(p.isCompleted).toBe(true);
    expect(p.steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('has correct step count for consultoria', () => {
    const p = buildMktplacePipeline('novo', false)!;
    expect(p.steps).toHaveLength(MKTPLACE_CONSULTORIA_STEPS.length);
  });

  it('consultoria pipeline id and color', () => {
    const p = buildMktplacePipeline('novo', false)!;
    expect(p.id).toBe('mktplace-consultoria');
    expect(p.color).toBe('sky');
  });
});

describe('buildMktplacePipeline — Gestao', () => {
  it('onboarding_marcado → step 0 current', () => {
    const p = buildMktplacePipeline('onboarding_marcado', true)!;
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
  });

  it('operacao_auditada → step 4 current, 0-3 completed', () => {
    const p = buildMktplacePipeline('operacao_auditada', true)!;
    expect(p.currentStepIndex).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(p.steps[i].status).toBe('completed');
    }
    expect(p.steps[4].status).toBe('current');
  });

  it('acompanhamento_gestao → all completed', () => {
    const p = buildMktplacePipeline('acompanhamento_gestao', true)!;
    expect(p.isCompleted).toBe(true);
    expect(p.steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('has correct step count for gestao', () => {
    const p = buildMktplacePipeline('novo', true)!;
    expect(p.steps).toHaveLength(MKTPLACE_GESTAO_STEPS.length);
  });

  it('gestao pipeline id and color', () => {
    const p = buildMktplacePipeline('novo', true)!;
    expect(p.id).toBe('mktplace-gestao');
    expect(p.color).toBe('purple');
  });
});

// ===================== CRM =====================

const CRM_PRODUCTS: CrmProduto[] = ['v8', 'automation', 'copilot'];

describe('buildCrmPipeline', () => {
  it.each(CRM_PRODUCTS)('%s: first step current when currentStep is first', (produto) => {
    const firstStep = CRM_STEPS_BY_PRODUTO[produto][0];
    const p = buildCrmPipeline(produto, firstStep, false);
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
    expect(p.steps[1].status).toBe('upcoming');
    expect(p.isCompleted).toBe(false);
  });

  it.each(CRM_PRODUCTS)('%s: middle step marks previous as completed', (produto) => {
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const midIdx = Math.floor(steps.length / 2);
    const p = buildCrmPipeline(produto, steps[midIdx], false);
    expect(p.currentStepIndex).toBe(midIdx);
    for (let i = 0; i < midIdx; i++) {
      expect(p.steps[i].status).toBe('completed');
    }
    expect(p.steps[midIdx].status).toBe('current');
    expect(p.steps[midIdx + 1].status).toBe('upcoming');
  });

  it.each(CRM_PRODUCTS)('%s: finalizado → all completed', (produto) => {
    const p = buildCrmPipeline(produto, 'call_pos_venda', true);
    expect(p.isCompleted).toBe(true);
    expect(p.currentStepIndex).toBe(CRM_STEPS_BY_PRODUTO[produto].length);
    expect(p.steps.every(s => s.status === 'completed')).toBe(true);
  });

  it.each(CRM_PRODUCTS)('%s: null currentStep defaults to index 0', (produto) => {
    const p = buildCrmPipeline(produto, null, false);
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
  });

  it.each(CRM_PRODUCTS)('%s: step count matches source constant', (produto) => {
    const p = buildCrmPipeline(produto, null, false);
    expect(p.steps).toHaveLength(CRM_STEPS_BY_PRODUTO[produto].length);
  });

  it.each(CRM_PRODUCTS)('%s: pipeline id format is crm-{produto}', (produto) => {
    const p = buildCrmPipeline(produto, null, false);
    expect(p.id).toBe(`crm-${produto}`);
  });

  it.each(CRM_PRODUCTS)('%s: has phases', (produto) => {
    const p = buildCrmPipeline(produto, null, false);
    expect(p.phases).toBeDefined();
    expect(p.phases!.length).toBe(CRM_PHASES_BY_PRODUTO[produto].length);
  });

  it.each(CRM_PRODUCTS)('%s: phases step counts sum to total steps', (produto) => {
    const p = buildCrmPipeline(produto, null, false);
    const totalFromPhases = p.phases!.reduce((sum, ph) => sum + ph.stepCount, 0);
    expect(totalFromPhases).toBe(CRM_STEPS_BY_PRODUTO[produto].length);
  });
});

// ===================== CRM PHASES =====================

describe('buildCrmPhases', () => {
  it('all completed when finalizado', () => {
    const phases = CRM_PHASES_BY_PRODUTO['v8'];
    const steps = CRM_STEPS_BY_PRODUTO['v8'];
    const result = buildCrmPhases(phases, steps.length, steps, true);
    for (const phase of result.phases) {
      expect(phase.completedCount).toBe(phase.stepCount);
    }
    expect(result.currentPhaseIndex).toBe(phases.length);
  });

  it('currentPhaseIndex points to correct phase', () => {
    const phases = CRM_PHASES_BY_PRODUTO['v8'];
    const steps = CRM_STEPS_BY_PRODUTO['v8'];
    // Step index 0 = first phase
    const result0 = buildCrmPhases(phases, 0, steps, false);
    expect(result0.currentPhaseIndex).toBe(0);

    // Step index beyond phase 1 — should be in phase 2
    const phase1StepCount = phases[0].steps.length;
    const result1 = buildCrmPhases(phases, phase1StepCount, steps, false);
    expect(result1.currentPhaseIndex).toBe(1);
  });

  it('completed counts are correct for mid-progress', () => {
    const phases = CRM_PHASES_BY_PRODUTO['copilot'];
    const steps = CRM_STEPS_BY_PRODUTO['copilot'];
    // currentStepGlobalIndex = 4 → first 4 steps completed
    const result = buildCrmPhases(phases, 4, steps, false);
    // Phase 1 (copilot): receber_briefing, treinar_ia, agendar_call_apresentacao (3 steps)
    expect(result.phases[0].completedCount).toBe(3); // all 3 in phase 1 completed
    // Phase 2: realizar_call_apresentacao(idx=3), validacao_cliente(idx=4)
    expect(result.phases[1].completedCount).toBe(1); // idx 3 completed, idx 4 is current
  });
});

// ===================== EDGE CASES =====================

describe('Edge cases', () => {
  it('buildOnboardingPipeline with completed_at but low milestone → still completed', () => {
    const p = buildOnboardingPipeline(3, '2026-01-01T00:00:00Z');
    expect(p.isCompleted).toBe(true);
    expect(p.steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('buildComercialPipeline with unknown paddock step → defaults safely', () => {
    const p = buildComercialPipeline('onboarding_paddock', 'nonexistent_step')!;
    // Unknown step: index stays -1, all upcoming
    expect(p.currentStepIndex).toBe(-1);
    expect(p.steps.every(s => s.status === 'upcoming')).toBe(true);
  });

  it('buildCrmPipeline with unknown step defaults to index 0', () => {
    const p = buildCrmPipeline('v8', 'nonexistent', false);
    expect(p.currentStepIndex).toBe(0);
    expect(p.steps[0].status).toBe('current');
  });

  it('every step has a non-empty label', () => {
    // Onboarding
    const ob = buildOnboardingPipeline(2, null);
    for (const s of ob.steps) expect(s.label.length).toBeGreaterThan(0);

    // Comercial
    const co = buildComercialPipeline('novo', null)!;
    for (const s of co.steps) expect(s.label.length).toBeGreaterThan(0);

    // Mktplace
    const mk = buildMktplacePipeline('novo', false)!;
    for (const s of mk.steps) expect(s.label.length).toBeGreaterThan(0);

    // CRM
    for (const produto of CRM_PRODUCTS) {
      const crm = buildCrmPipeline(produto, null, false);
      for (const s of crm.steps) expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
