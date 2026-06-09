// Single shared predicate: "does this client render inside the ADS Onboarding board?"
//
// This is the SEAM that fixes the duplicate-card bug. Previously two
// independent predicates ran over the same useAssignedClients() list:
//   - AdsNovoClienteSection: status === 'new_client'  (no onboarding check)
//   - AdsOnboardingSection.getClientsForStep: onboarding record + milestone + step
// A new_client backfilled to milestone 2 / dar_boas_vindas matched BOTH,
// so the same client showed up in "Novo Cliente" AND under the m2-1 card.
//
// Fix direction (founder decision — "Onboarding prevalece"):
//   Onboarding is the source of truth. Novo Cliente = new_client MINUS the
//   set of clients that render in Onboarding. This module IS that set's
//   membership test. AdsOnboardingSection uses it to render; AdsNovoClienteSection
//   uses it to subtract. One predicate, no drift.

import { MILESTONE_CARDS } from './milestones';

/** Only the fields the membership test depends on. */
export interface OnboardingRecord {
  client_id: string;
  current_milestone: number | null;
  current_step: string | null;
}

/** Only the fields the membership test depends on. */
interface ClientLike {
  id: string;
  status: string;
}

export interface MilestoneStep {
  milestone: number;
  stepKey: string;
}

// Derived from MILESTONE_CARDS: every (milestone, stepKey) pair that owns a
// card capable of rendering clients. Cards WITHOUT a stepKey (e.g. m2-5
// "Estratégia Apresentada") never render clients and are excluded here.
// Instruction cards WITH a stepKey (e.g. m3-2 criativos_brifados) DO render.
export const RENDERED_MILESTONE_STEPS: MilestoneStep[] = Object.entries(MILESTONE_CARDS).flatMap(
  ([milestoneStr, cards]) =>
    cards
      .filter(card => typeof card.stepKey === 'string' && card.stepKey.length > 0)
      .map(card => ({ milestone: Number(milestoneStr), stepKey: card.stepKey as string })),
);

// Fast lookup: "milestone:stepKey" -> renders.
const RENDERED_KEYS = new Set(RENDERED_MILESTONE_STEPS.map(p => `${p.milestone}:${p.stepKey}`));

/**
 * True iff this client renders under some onboarding milestone card.
 * Mirrors AdsOnboardingSection.getClientsForStep exactly, but evaluated
 * across ALL rendered (milestone, step) pairs instead of one.
 *
 * Defensive on empty onboarding data: returns false. The CALLER
 * (AdsNovoClienteSection) is responsible for gating render until onboarding
 * has loaded, to avoid a flash of duplicates before the subtraction applies.
 */
export function clientRendersInOnboarding(
  client: ClientLike,
  onboardingData: readonly OnboardingRecord[],
): boolean {
  // Same status gate as getClientsForStep.
  if (client.status !== 'onboarding' && client.status !== 'new_client') return false;

  const record = onboardingData.find(o => o.client_id === client.id);
  if (!record) return false;

  const milestone = record.current_milestone ?? 1;
  const step = record.current_step;
  if (!step) return false;

  return RENDERED_KEYS.has(`${milestone}:${step}`);
}

/**
 * Set of client ids that render in the Onboarding board.
 * AdsNovoClienteSection subtracts this set from its new_client list.
 */
export function getOnboardingClientIds(
  clients: readonly ClientLike[],
  onboardingData: readonly OnboardingRecord[],
): Set<string> {
  const ids = new Set<string>();
  for (const client of clients) {
    if (clientRendersInOnboarding(client, onboardingData)) ids.add(client.id);
  }
  return ids;
}
