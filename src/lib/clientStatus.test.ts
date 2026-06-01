import { describe, it, expect } from 'vitest';
import { deriveRestoredStatus, isCampaignPublished } from './clientStatus';

describe('deriveRestoredStatus', () => {
  // Regression: Ágape Zeladoria (2026-06-01). Restoring a client that already
  // had a published campaign must return `active`, NOT the legacy
  // 'campaign_published' status, otherwise it vanishes from the ads board.
  it('restores a client with a published campaign as active', () => {
    expect(
      deriveRestoredStatus({
        campaign_published_at: '2026-03-25T00:00:00+00:00',
        onboarding_started_at: '2026-03-01T00:00:00+00:00',
      }),
    ).toBe('active');
  });

  it('never returns the deprecated campaign_published status', () => {
    const result = deriveRestoredStatus({
      campaign_published_at: '2026-03-25T00:00:00+00:00',
    });
    expect(result).not.toBe('campaign_published');
  });

  it('restores a client that only started onboarding as onboarding', () => {
    expect(
      deriveRestoredStatus({
        campaign_published_at: null,
        onboarding_started_at: '2026-03-01T00:00:00+00:00',
      }),
    ).toBe('onboarding');
  });

  it('restores a fresh client as new_client', () => {
    expect(deriveRestoredStatus({})).toBe('new_client');
    expect(
      deriveRestoredStatus({ campaign_published_at: null, onboarding_started_at: null }),
    ).toBe('new_client');
  });

  it('prioritizes campaign over onboarding when both are present', () => {
    expect(
      deriveRestoredStatus({
        campaign_published_at: '2026-03-25T00:00:00+00:00',
        onboarding_started_at: '2026-03-01T00:00:00+00:00',
      }),
    ).toBe('active');
  });
});

describe('isCampaignPublished', () => {
  // Invariant: active + campaign_published_at + not archived is the canonical
  // "campaign published / in tracking" state and is exactly what the ads
  // manager board renders.
  it('is true for an active, non-archived client with a published campaign', () => {
    expect(
      isCampaignPublished({
        status: 'active',
        archived: false,
        campaign_published_at: '2026-03-25T00:00:00+00:00',
      }),
    ).toBe(true);
  });

  it('is false for the legacy campaign_published status (limbo state)', () => {
    expect(
      isCampaignPublished({
        status: 'campaign_published',
        archived: false,
        campaign_published_at: '2026-03-25T00:00:00+00:00',
      }),
    ).toBe(false);
  });

  it('is false when archived even if active with published campaign', () => {
    expect(
      isCampaignPublished({
        status: 'active',
        archived: true,
        campaign_published_at: '2026-03-25T00:00:00+00:00',
      }),
    ).toBe(false);
  });

  it('is false for an active client without a published campaign', () => {
    expect(
      isCampaignPublished({ status: 'active', archived: false, campaign_published_at: null }),
    ).toBe(false);
  });

  it('is false for onboarding/new clients', () => {
    expect(isCampaignPublished({ status: 'onboarding', campaign_published_at: null })).toBe(false);
    expect(isCampaignPublished({ status: 'new_client', campaign_published_at: null })).toBe(false);
  });
});
