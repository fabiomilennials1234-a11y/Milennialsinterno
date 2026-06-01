import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { computeAggregates, useMetaAdsInsights, type MetaAdsInsight } from '../useMetaAdsInsights';

// ── Supabase client mock ──
// Chainable builder that records which filters were applied so the regression
// test can assert the campaign-level filter (.is('ad_id', null)) is present.

const calls: Record<string, unknown[][]> = {};
let resolveData: MetaAdsInsight[] = [];

function makeBuilder() {
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return builder;
  };
  const builder: Record<string, unknown> = {
    select: record('select'),
    is: record('is'),
    gte: record('gte'),
    lte: record('lte'),
    eq: record('eq'),
    order: record('order'),
    then: (resolve: (v: { data: MetaAdsInsight[]; error: null }) => void) =>
      resolve({ data: resolveData, error: null }),
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      (calls.from ??= []).push(args);
      return makeBuilder();
    },
  },
}));

// ── Fixtures ──

function row(over: Partial<MetaAdsInsight>): MetaAdsInsight {
  return {
    id: crypto.randomUUID(),
    ad_account_id: 'act_1',
    campaign_id: 'c1',
    campaign_name: 'Campaign 1',
    date_start: '2026-05-31',
    date_stop: '2026-05-31',
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    frequency: 0,
    cpc: 0,
    cpm: 0,
    ctr: 0,
    leads: 0,
    conversions: 0,
    actions_raw: null,
    fetched_at: '2026-05-31T00:00:00Z',
    created_at: '2026-05-31T00:00:00Z',
    updated_at: '2026-05-31T00:00:00Z',
    ...over,
  };
}

describe('computeAggregates — double-granularity guard', () => {
  // meta_ads_insights stores 1 campaign-level row + N ad-level rows that sum to
  // the SAME totals. The fixed query feeds only campaign-level rows. These tests
  // pin the contract: campaign-level-only input must NOT double-count, and the
  // raw all-rows input demonstrates the 2x bug the filter prevents.

  const campaignLevel = row({ spend: 100, leads: 5 });
  const adLevel = [
    row({ spend: 30, leads: 2 }),
    row({ spend: 40, leads: 2 }),
    row({ spend: 30, leads: 1 }),
  ];

  it('campaign-level only → singular totals (what the fixed query feeds)', () => {
    const agg = computeAggregates([campaignLevel]);
    expect(agg.totalSpend).toBe(100);
    expect(agg.totalLeads).toBe(5);
  });

  it('all granularities blended → 2x (the bug the filter prevents)', () => {
    const agg = computeAggregates([campaignLevel, ...adLevel]);
    expect(agg.totalSpend).toBe(200);
    expect(agg.totalLeads).toBe(10);
  });

  it('agendamentos from campaign-level actions_raw survive', () => {
    const withAgend = row({
      spend: 100,
      leads: 5,
      actions_raw: [
        { action_type: 'lead', value: '5' },
        { action_type: 'video_view', value: '120' },
        { action_type: 'offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled', value: '3' },
      ],
    });
    const agg = computeAggregates([withAgend]);
    expect(agg.totalAgendamentos).toBe(3);
    expect(agg.totalVideoViews).toBe(120);
  });
});

describe('useMetaAdsInsights — query restricts to campaign-level rows', () => {
  beforeEach(() => {
    for (const k of Object.keys(calls)) delete calls[k];
    resolveData = [row({ spend: 516.79, leads: 11 })];
  });

  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(QueryClientProvider, { client }, children);
  }

  it("applies .is('ad_id', null) so ad-level rows are excluded", async () => {
    const { result } = renderHook(
      () => useMetaAdsInsights({ dateFrom: '2026-05-31', dateTo: '2026-05-31' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const isCalls = calls.is ?? [];
    expect(isCalls).toContainEqual(['ad_id', null]);
    expect(result.current.aggregates.totalSpend).toBe(516.79);
    expect(result.current.aggregates.totalLeads).toBe(11);
  });
});
