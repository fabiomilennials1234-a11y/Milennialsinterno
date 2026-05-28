import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseMetaActions, buildDateRange, transformInsightRow } from './meta-ads-utils';

describe('parseMetaActions', () => {
  it('returns zeros for empty array', () => {
    const result = parseMetaActions([]);
    expect(result).toEqual({ leads: 0, conversions: 0 });
  });

  it('extracts leads from lead action type', () => {
    const actions = [
      { action_type: 'lead', value: '12' },
      { action_type: 'link_click', value: '50' },
    ];
    const result = parseMetaActions(actions);
    expect(result.leads).toBe(12);
  });

  it('extracts conversions from offsite_conversion and purchase', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '5' },
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '3' },
      { action_type: 'purchase', value: '7' },
      { action_type: 'link_click', value: '100' },
    ];
    const result = parseMetaActions(actions);
    expect(result.conversions).toBe(15);
  });

  it('handles mixed action types correctly', () => {
    const actions = [
      { action_type: 'lead', value: '8' },
      { action_type: 'purchase', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' },
      { action_type: 'post_engagement', value: '500' },
      { action_type: 'page_engagement', value: '300' },
      { action_type: 'landing_page_view', value: '45' },
    ];
    const result = parseMetaActions(actions);
    expect(result).toEqual({ leads: 8, conversions: 5 });
  });
});

describe('buildDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 90-day range for backfill', () => {
    const range = buildDateRange(true);
    expect(range).toEqual({ since: '2026-02-27', until: '2026-05-28' });
  });

  it('returns 7-day range for regular sync', () => {
    const range = buildDateRange(false);
    expect(range).toEqual({ since: '2026-05-21', until: '2026-05-28' });
  });
});

describe('transformInsightRow', () => {
  it('maps Meta API response to DB row format', () => {
    const raw = {
      campaign_id: '123456',
      campaign_name: 'Campanha Teste',
      date_start: '2026-05-20',
      date_stop: '2026-05-20',
      spend: '150.50',
      impressions: '5000',
      clicks: '120',
      reach: '4500',
      frequency: '1.1111',
      cpc: '1.2542',
      cpm: '30.1000',
      ctr: '2.4000',
      actions: [
        { action_type: 'lead', value: '10' },
        { action_type: 'purchase', value: '2' },
      ],
    };

    const result = transformInsightRow(raw, 'act_738610258782410');

    expect(result).toEqual({
      ad_account_id: 'act_738610258782410',
      campaign_id: '123456',
      campaign_name: 'Campanha Teste',
      date_start: '2026-05-20',
      date_stop: '2026-05-20',
      spend: 150.50,
      impressions: 5000,
      clicks: 120,
      reach: 4500,
      frequency: 1.1111,
      cpc: 1.2542,
      cpm: 30.1,
      ctr: 2.4,
      leads: 10,
      conversions: 2,
      actions_raw: raw.actions,
    });
  });

  it('defaults missing fields to zero and null actions', () => {
    const raw = {
      campaign_id: '999',
      campaign_name: 'Minimal',
      date_start: '2026-05-20',
      date_stop: '2026-05-20',
    };

    const result = transformInsightRow(raw, 'act_123');

    expect(result.spend).toBe(0);
    expect(result.impressions).toBe(0);
    expect(result.clicks).toBe(0);
    expect(result.reach).toBe(0);
    expect(result.frequency).toBe(0);
    expect(result.cpc).toBe(0);
    expect(result.cpm).toBe(0);
    expect(result.ctr).toBe(0);
    expect(result.leads).toBe(0);
    expect(result.conversions).toBe(0);
    expect(result.actions_raw).toBeNull();
  });
});
