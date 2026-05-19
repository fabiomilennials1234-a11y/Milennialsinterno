export interface OnboardingInput {
  growth_gp_step: string | null;
  assigned_ads_manager: string | null;
  growth_team_added_to_groups: boolean;
}

export interface OnboardingProgress {
  call1Complete: boolean;
  teamSelected: boolean;
  addedToGroups: boolean;
  allComplete: boolean;
}

// Steps where call 1 is complete (both v1 and v2 equivalents)
const CALL1_DONE_STEPS = new Set([
  // V1: call_1_realizada onwards
  'call_1_realizada',
  // V2: escolher_equipe onwards (realizar_call_1 is the call itself, done after)
  'escolher_equipe', 'alinhar_projeto',
  // Shared final steps
  'acompanhamento_gestores', 'feito',
]);

export function getOnboardingProgress(input: OnboardingInput): OnboardingProgress {
  const call1Complete = CALL1_DONE_STEPS.has(input.growth_gp_step ?? '');
  const teamSelected = !!input.assigned_ads_manager;
  const addedToGroups = input.growth_team_added_to_groups;
  const allComplete = call1Complete && teamSelected && addedToGroups;

  return { call1Complete, teamSelected, addedToGroups, allComplete };
}
