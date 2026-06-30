import { describe, it, expect } from 'vitest';
import { applySecondaryOnboardingOverride } from './useAdsManager';
import type { Client } from './useAdsManager';

// Regressão do vazamento "ZapLub": um cliente churned/active com row secundária
// stale (phase='onboarding') era forçado a status='new_client' e aparecia
// indevidamente na coluna "Novo Cliente" do board do gestor secundário.
// applySecondaryOnboardingOverride só pode promover quem ainda está no ciclo
// de onboarding real ('new_client' | 'onboarding').

function makeClient(id: string, status: string): Client {
  return {
    id,
    name: `cliente-${id}`,
    cnpj: null,
    cpf: null,
    razao_social: null,
    general_info: null,
    expected_investment: null,
    group_id: null,
    squad_id: null,
    assigned_ads_manager: null,
    status,
    onboarding_started_at: null,
    campaign_published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    archived: false,
    archived_at: null,
    sales_percentage: 0,
    entry_date: null,
  };
}

// Todas as fixtures têm row secundária em fase 'onboarding' — o gatilho do bug.
const phaseMap = new Map<string, string | null | undefined>([
  ['c-new', 'onboarding'],
  ['c-onb', 'onboarding'],
  ['c-active', 'onboarding'],
  ['c-churning', 'onboarding'],
  ['c-churned', 'onboarding'],
]);

describe('applySecondaryOnboardingOverride', () => {
  it('promove a new_client quando o status real ainda está no ciclo de onboarding', () => {
    const out = applySecondaryOnboardingOverride(
      [makeClient('c-new', 'new_client'), makeClient('c-onb', 'onboarding')],
      phaseMap,
    );
    expect(out.find(c => c.id === 'c-new')!.status).toBe('new_client');
    expect(out.find(c => c.id === 'c-onb')!.status).toBe('new_client');
  });

  it('NÃO sobrescreve clientes fora do ciclo de onboarding (active/churning/churned)', () => {
    const out = applySecondaryOnboardingOverride(
      [
        makeClient('c-active', 'active'),
        makeClient('c-churning', 'churning'),
        makeClient('c-churned', 'churned'),
      ],
      phaseMap,
    );
    expect(out.find(c => c.id === 'c-active')!.status).toBe('active');
    expect(out.find(c => c.id === 'c-churning')!.status).toBe('churning');
    expect(out.find(c => c.id === 'c-churned')!.status).toBe('churned');
  });

  it('cenário ZapLub: churned com row secundária stale NÃO vira novo cliente', () => {
    const out = applySecondaryOnboardingOverride([makeClient('c-churned', 'churned')], phaseMap);
    const newClients = out.filter(c => c.status === 'new_client');
    expect(newClients).toHaveLength(0);
  });

  it('status legacy campaign_published (deprecated, fora do ciclo) NÃO é promovido', () => {
    const out = applySecondaryOnboardingOverride(
      [makeClient('c-legacy', 'campaign_published')],
      new Map([['c-legacy', 'onboarding']]),
    );
    expect(out[0].status).toBe('campaign_published');
  });

  it('cliente sem entrada no phaseMap mantém o status real', () => {
    const out = applySecondaryOnboardingOverride([makeClient('c-onb', 'onboarding')], new Map());
    expect(out[0].status).toBe('onboarding');
  });

  it('sem fase onboarding na row secundária mantém o status real intocado', () => {
    const out = applySecondaryOnboardingOverride(
      [makeClient('c-new', 'new_client')],
      new Map([['c-new', 'active']]),
    );
    expect(out[0].status).toBe('new_client');
  });
});
