import { describe, it, expect } from 'vitest';
import {
  clientRendersInOnboarding,
  getOnboardingClientIds,
  RENDERED_MILESTONE_STEPS,
  type OnboardingRecord,
} from './onboardingMembership';

// Minimal client shape the predicate cares about.
type C = { id: string; status: string };

const mkOnb = (
  client_id: string,
  current_milestone: number,
  current_step: string,
): OnboardingRecord => ({ client_id, current_milestone, current_step });

describe('RENDERED_MILESTONE_STEPS — derived from MILESTONE_CARDS', () => {
  it('includes only milestones that have cards (2,3,4,5)', () => {
    const milestones = new Set(RENDERED_MILESTONE_STEPS.map(p => p.milestone));
    expect([...milestones].sort()).toEqual([2, 3, 4, 5]);
  });

  it('includes m2-1 dar_boas_vindas (the card that caused the duplicate bug)', () => {
    expect(
      RENDERED_MILESTONE_STEPS.some(p => p.milestone === 2 && p.stepKey === 'dar_boas_vindas'),
    ).toBe(true);
  });

  it('includes m3-2 criativos_brifados — instruction card WITH a stepKey still renders clients', () => {
    expect(
      RENDERED_MILESTONE_STEPS.some(p => p.milestone === 3 && p.stepKey === 'criativos_brifados'),
    ).toBe(true);
  });

  it('excludes m2-5 — instruction card WITHOUT a stepKey renders no clients', () => {
    // m2-5 "Estratégia Apresentada" has no stepKey; no (milestone,step) pair should map to it.
    // Its absence is proven by no pair existing for a step that only m2-5 would own.
    const m2Steps = RENDERED_MILESTONE_STEPS.filter(p => p.milestone === 2).map(p => p.stepKey);
    expect(m2Steps).toEqual(
      expect.arrayContaining([
        'dar_boas_vindas',
        'criar_estrategia',
        'marcar_apresentacao_estrategia',
        'realizar_apresentacao_estrategia',
      ]),
    );
    expect(m2Steps).toHaveLength(4); // exactly the 4 stepKey cards, m2-5 excluded
  });
});

describe('clientRendersInOnboarding', () => {
  const onboarding = [
    mkOnb('a', 2, 'dar_boas_vindas'),
    mkOnb('b', 3, 'criativos_brifados'),
    mkOnb('c', 2, 'nonexistent_step'),
    mkOnb('d', 99, 'dar_boas_vindas'),
  ];

  it('true for new_client at milestone 2 / dar_boas_vindas (m2-1)', () => {
    expect(clientRendersInOnboarding({ id: 'a', status: 'new_client' }, onboarding)).toBe(true);
  });

  it('true for onboarding status at a rendered step', () => {
    expect(clientRendersInOnboarding({ id: 'a', status: 'onboarding' }, onboarding)).toBe(true);
  });

  it('false when status is neither new_client nor onboarding', () => {
    expect(clientRendersInOnboarding({ id: 'a', status: 'active' }, onboarding)).toBe(false);
  });

  it('false when client has NO onboarding record', () => {
    expect(clientRendersInOnboarding({ id: 'zzz', status: 'new_client' }, onboarding)).toBe(false);
  });

  it('false when step is not a rendered card step', () => {
    expect(clientRendersInOnboarding({ id: 'c', status: 'new_client' }, onboarding)).toBe(false);
  });

  it('false when milestone is not rendered (e.g. 99)', () => {
    expect(clientRendersInOnboarding({ id: 'd', status: 'new_client' }, onboarding)).toBe(false);
  });

  // Edge: valid step but WRONG milestone. brifar_criativos is a milestone-3
  // step; a record claiming milestone 2 must NOT render (matches the old
  // getClientsForStep, which required milestone AND step to match a card).
  // Such a client stays in Novo Cliente rather than being silently hidden.
  it('false when step is valid but paired with the wrong milestone', () => {
    const mismatched = [mkOnb('m', 2, 'brifar_criativos')];
    expect(clientRendersInOnboarding({ id: 'm', status: 'new_client' }, mismatched)).toBe(false);
  });

  it('false defensively when onboarding data is empty (still loading)', () => {
    expect(clientRendersInOnboarding({ id: 'a', status: 'new_client' }, [])).toBe(false);
  });
});

describe('getOnboardingClientIds', () => {
  it('returns the set of client ids that render in onboarding', () => {
    const clients: C[] = [
      { id: 'a', status: 'new_client' }, // m2-1 -> rendered
      { id: 'b', status: 'onboarding' }, // m3-2 -> rendered
      { id: 'c', status: 'new_client' }, // bad step -> not rendered
      { id: 'e', status: 'new_client' }, // no onboarding record -> not rendered
    ];
    const onboarding = [
      mkOnb('a', 2, 'dar_boas_vindas'),
      mkOnb('b', 3, 'criativos_brifados'),
      mkOnb('c', 2, 'nonexistent_step'),
    ];
    const ids = getOnboardingClientIds(clients, onboarding);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
    expect(ids.has('c')).toBe(false);
    expect(ids.has('e')).toBe(false);
    expect(ids.size).toBe(2);
  });

  it('returns empty set when onboarding data is empty (loading guard responsibility is the caller)', () => {
    const clients: C[] = [{ id: 'a', status: 'new_client' }];
    expect(getOnboardingClientIds(clients, []).size).toBe(0);
  });
});

// THE INVARIANT: mutual exclusion between "Novo Cliente" and "Onboarding".
// Novo Cliente = new_client MINUS onboarding-rendered set.
describe('mutual exclusion invariant — no client appears in both columns', () => {
  it('a new_client that renders in onboarding is subtracted from Novo Cliente', () => {
    const clients: C[] = [
      { id: 'a', status: 'new_client' }, // renders in onboarding (m2-1)
      { id: 'x', status: 'new_client' }, // no onboarding record -> stays in Novo Cliente
    ];
    const onboarding = [mkOnb('a', 2, 'dar_boas_vindas')];

    const onboardingIds = getOnboardingClientIds(clients, onboarding);
    const novoCliente = clients.filter(c => c.status === 'new_client' && !onboardingIds.has(c.id));
    const novoClienteIds = new Set(novoCliente.map(c => c.id));

    // No id is in both sets.
    for (const id of onboardingIds) {
      expect(novoClienteIds.has(id)).toBe(false);
    }
    // 'a' moved out of Novo Cliente, 'x' stayed.
    expect(novoClienteIds.has('a')).toBe(false);
    expect(novoClienteIds.has('x')).toBe(true);
    expect(onboardingIds.has('a')).toBe(true);
  });
});
