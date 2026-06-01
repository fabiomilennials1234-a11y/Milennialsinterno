import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseMetaActions, buildDateRange, transformInsightRow, parseLeadFieldData, transformAdLevelInsightRow, computeSalesMetrics, getDatePresets, extractConversion, CONVERSION_EVENTS } from './meta-ads-utils';

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

  it('counts only hard purchase action types as conversions', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '5' },
      { action_type: 'purchase', value: '7' },
      { action_type: 'omni_purchase', value: '3' },
      { action_type: 'link_click', value: '100' },
    ];
    const result = parseMetaActions(actions);
    expect(result.conversions).toBe(15);
  });

  // Regression: the old soma-cega `startsWith('offsite_conversion.')` blended
  // custom pixel events (agendamento) and pixel leads into `conversions`,
  // inflating the number in production. Those must NOT count here anymore.
  it('does NOT blend custom pixel conversions or pixel leads into conversions', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '9' },
      { action_type: CONVERSION_EVENTS.agendamento.actionType, value: '4' },
      { action_type: 'purchase', value: '2' },
    ];
    const result = parseMetaActions(actions);
    expect(result.conversions).toBe(2);
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

describe('extractConversion', () => {
  const AGENDAMENTO = CONVERSION_EVENTS.agendamento.actionType;

  it('returns 0 for non-array input', () => {
    expect(extractConversion(null, AGENDAMENTO)).toBe(0);
    expect(extractConversion(undefined, AGENDAMENTO)).toBe(0);
    expect(extractConversion('offsite', AGENDAMENTO)).toBe(0);
    expect(extractConversion({}, AGENDAMENTO)).toBe(0);
  });

  it('returns 0 when the action_type is absent', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '5' },
      { action_type: 'video_view', value: '120' },
    ];
    expect(extractConversion(actions, AGENDAMENTO)).toBe(0);
  });

  it('matches the real Meta agendamento action_type exactly', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled', value: '2' },
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '1' },
    ];
    expect(extractConversion(actions, AGENDAMENTO)).toBe(2);
  });

  it('does NOT match the un-suffixed aggregate bucket (no over-count)', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '99' },
    ];
    expect(extractConversion(actions, AGENDAMENTO)).toBe(0);
  });

  it('sums duplicate entries of the same action_type', () => {
    const actions = [
      { action_type: AGENDAMENTO, value: '1' },
      { action_type: AGENDAMENTO, value: '2' },
    ];
    expect(extractConversion(actions, AGENDAMENTO)).toBe(3);
  });

  it('treats missing value as zero', () => {
    const actions = [{ action_type: AGENDAMENTO }];
    expect(extractConversion(actions, AGENDAMENTO)).toBe(0);
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

  it('returns 90-day range for backfill mode', () => {
    const range = buildDateRange('backfill');
    expect(range).toEqual({ since: '2026-02-27', until: '2026-05-28' });
  });

  it('returns 7-day range for full mode', () => {
    const range = buildDateRange('full');
    expect(range).toEqual({ since: '2026-05-21', until: '2026-05-28' });
  });

  it('returns 48h range for leads mode', () => {
    const range = buildDateRange('leads');
    expect(range).toEqual({ since: '2026-05-26', until: '2026-05-28' });
  });

  it('returns 48h range for insights mode', () => {
    const range = buildDateRange('insights');
    expect(range).toEqual({ since: '2026-05-26', until: '2026-05-28' });
  });
});

describe('getDatePresets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 7 presets with correct date ranges', () => {
    const presets = getDatePresets();

    expect(presets).toHaveLength(7);
    expect(presets.map(p => p.label)).toEqual([
      'Hoje',
      'Ontem',
      'Últimos 7 dias',
      'Últimos 30 dias',
      'Últimos 90 dias',
      'Mês atual',
      'Mês anterior',
    ]);

    expect(presets[0].value).toEqual({ since: '2026-05-28', until: '2026-05-28' });
    expect(presets[1].value).toEqual({ since: '2026-05-27', until: '2026-05-27' });
    expect(presets[2].value).toEqual({ since: '2026-05-21', until: '2026-05-28' });
    expect(presets[3].value).toEqual({ since: '2026-04-28', until: '2026-05-28' });
    expect(presets[4].value).toEqual({ since: '2026-02-27', until: '2026-05-28' });
    expect(presets[5].value).toEqual({ since: '2026-05-01', until: '2026-05-28' });
    expect(presets[6].value).toEqual({ since: '2026-04-01', until: '2026-04-30' });
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

describe('parseLeadFieldData', () => {
  it('extracts name from common field variations', () => {
    const fields = [
      { name: 'full_name', values: ['João Silva'] },
      { name: 'email', values: ['joao@test.com'] },
    ];
    expect(parseLeadFieldData(fields).name).toBe('João Silva');

    const fields2 = [{ name: 'nome', values: ['Maria'] }];
    expect(parseLeadFieldData(fields2).name).toBe('Maria');

    const fields3 = [{ name: 'name', values: ['Pedro'] }];
    expect(parseLeadFieldData(fields3).name).toBe('Pedro');
  });

  it('extracts email from common field variations', () => {
    const fields = [{ name: 'email', values: ['joao@test.com'] }];
    expect(parseLeadFieldData(fields).email).toBe('joao@test.com');

    const fields2 = [{ name: 'e-mail', values: ['maria@test.com'] }];
    expect(parseLeadFieldData(fields2).email).toBe('maria@test.com');
  });

  it('extracts phone from common field variations', () => {
    const fields = [{ name: 'phone_number', values: ['+5511999999999'] }];
    expect(parseLeadFieldData(fields).phone).toBe('+5511999999999');

    const fields2 = [{ name: 'telefone', values: ['11988887777'] }];
    expect(parseLeadFieldData(fields2).phone).toBe('11988887777');

    const fields3 = [{ name: 'whatsapp', values: ['5511977776666'] }];
    expect(parseLeadFieldData(fields3).phone).toBe('5511977776666');
  });

  it('returns empty strings for missing fields', () => {
    const fields = [{ name: 'city', values: ['São Paulo'] }];
    const result = parseLeadFieldData(fields);
    expect(result).toEqual({ name: '', email: '', phone: '' });
  });

  it('returns empty strings for empty array', () => {
    const result = parseLeadFieldData([]);
    expect(result).toEqual({ name: '', email: '', phone: '' });
  });
});

describe('transformAdLevelInsightRow', () => {
  it('maps ad-level response with ad fields and thumbnail', () => {
    const raw = {
      campaign_id: '111',
      campaign_name: 'Camp A',
      adset_id: '222',
      adset_name: 'Adset B',
      ad_id: '333',
      ad_name: 'Criativo C',
      date_start: '2026-05-20',
      date_stop: '2026-05-20',
      spend: '100.00',
      impressions: '3000',
      clicks: '80',
      reach: '2500',
      frequency: '1.2000',
      cpc: '1.2500',
      cpm: '33.3333',
      ctr: '2.6667',
      actions: [{ action_type: 'lead', value: '5' }],
    };

    const result = transformAdLevelInsightRow(raw, 'act_123', 'https://thumb.meta.com/abc.jpg');

    expect(result.ad_id).toBe('333');
    expect(result.ad_name).toBe('Criativo C');
    expect(result.adset_id).toBe('222');
    expect(result.adset_name).toBe('Adset B');
    expect(result.creative_thumbnail_url).toBe('https://thumb.meta.com/abc.jpg');
    expect(result.leads).toBe(5);
    expect(result.spend).toBe(100);
    expect(result.campaign_id).toBe('111');
  });

  it('defaults ad-level fields to null when absent', () => {
    const raw = {
      campaign_id: '111',
      campaign_name: 'Camp A',
      date_start: '2026-05-20',
      date_stop: '2026-05-20',
    };

    const result = transformAdLevelInsightRow(raw, 'act_123');

    expect(result.ad_id).toBeNull();
    expect(result.ad_name).toBeNull();
    expect(result.adset_id).toBeNull();
    expect(result.adset_name).toBeNull();
    expect(result.creative_thumbnail_url).toBeNull();
  });
});

describe('computeSalesMetrics', () => {
  it('calculates cost per purchase and ROI', () => {
    const result = computeSalesMetrics(5000, 10, 15000);

    expect(result.numSales).toBe(10);
    expect(result.costPerPurchase).toBe(500);
    expect(result.salesValue).toBe(15000);
    expect(result.spend).toBe(5000);
    expect(result.roi).toBe(3);
  });

  it('returns zero cost per purchase when no sales (no division by zero)', () => {
    const result = computeSalesMetrics(5000, 0, 0);

    expect(result.costPerPurchase).toBe(0);
    expect(result.numSales).toBe(0);
    expect(result.roi).toBe(0);
    expect(Number.isFinite(result.costPerPurchase)).toBe(true);
    expect(Number.isFinite(result.roi)).toBe(true);
  });

  it('returns zero ROI when no spend', () => {
    const result = computeSalesMetrics(0, 5, 10000);

    expect(result.costPerPurchase).toBe(0);
    expect(result.roi).toBe(0);
  });
});
