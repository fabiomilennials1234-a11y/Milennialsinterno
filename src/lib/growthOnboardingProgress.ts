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

const CALL1_DONE_STEPS = new Set(['call_1_realizada', 'acompanhamento_gestores', 'feito']);

export function getOnboardingProgress(input: OnboardingInput): OnboardingProgress {
  const call1Complete = CALL1_DONE_STEPS.has(input.growth_gp_step ?? '');
  const teamSelected = !!input.assigned_ads_manager;
  const addedToGroups = input.growth_team_added_to_groups;
  const allComplete = call1Complete && teamSelected && addedToGroups;

  return { call1Complete, teamSelected, addedToGroups, allComplete };
}
