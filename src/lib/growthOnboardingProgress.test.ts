import { describe, it, expect } from 'vitest';
import { getOnboardingProgress } from './growthOnboardingProgress';

describe('getOnboardingProgress', () => {
  it('cliente novo: nenhuma etapa completa', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'novos_clientes',
      assigned_ads_manager: null,
      growth_team_added_to_groups: false,
    });

    expect(progress.call1Complete).toBe(false);
    expect(progress.teamSelected).toBe(false);
    expect(progress.addedToGroups).toBe(false);
    expect(progress.allComplete).toBe(false);
  });

  it('call_1_agendada: call 1 ainda não feita', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'call_1_agendada',
      assigned_ads_manager: null,
      growth_team_added_to_groups: false,
    });

    expect(progress.call1Complete).toBe(false);
  });

  it('call_1_realizada: etapa 1 completa', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'call_1_realizada',
      assigned_ads_manager: null,
      growth_team_added_to_groups: false,
    });

    expect(progress.call1Complete).toBe(true);
    expect(progress.allComplete).toBe(false);
  });

  it('equipe atribuída: etapa 2 completa', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'call_1_realizada',
      assigned_ads_manager: 'uuid-123',
      growth_team_added_to_groups: false,
    });

    expect(progress.call1Complete).toBe(true);
    expect(progress.teamSelected).toBe(true);
    expect(progress.addedToGroups).toBe(false);
    expect(progress.allComplete).toBe(false);
  });

  it('todas etapas completas: allComplete = true', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'call_1_realizada',
      assigned_ads_manager: 'uuid-123',
      growth_team_added_to_groups: true,
    });

    expect(progress.call1Complete).toBe(true);
    expect(progress.teamSelected).toBe(true);
    expect(progress.addedToGroups).toBe(true);
    expect(progress.allComplete).toBe(true);
  });

  it('growth_gp_step null: nenhuma etapa completa', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: null,
      assigned_ads_manager: null,
      growth_team_added_to_groups: false,
    });

    expect(progress.call1Complete).toBe(false);
    expect(progress.allComplete).toBe(false);
  });

  it('call1 + equipe mas sem grupos: allComplete false', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'call_1_realizada',
      assigned_ads_manager: 'uuid-123',
      growth_team_added_to_groups: false,
    });

    expect(progress.allComplete).toBe(false);
  });

  it('call1 + grupos mas sem equipe: allComplete false', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'call_1_realizada',
      assigned_ads_manager: null,
      growth_team_added_to_groups: true,
    });

    expect(progress.allComplete).toBe(false);
  });

  it('acompanhamento_gestores step: call1 still considered done', () => {
    const progress = getOnboardingProgress({
      growth_gp_step: 'acompanhamento_gestores',
      assigned_ads_manager: 'uuid-123',
      growth_team_added_to_groups: true,
    });

    expect(progress.call1Complete).toBe(true);
    expect(progress.allComplete).toBe(true);
  });
});
