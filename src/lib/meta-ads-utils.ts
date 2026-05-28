export interface MetaAction {
  action_type: string;
  value: string;
}

export function parseMetaActions(actions: MetaAction[]): { leads: number; conversions: number } {
  const leads = Number(actions.find(a => a.action_type === 'lead')?.value ?? 0);
  const conversions = actions
    .filter(a => a.action_type.startsWith('offsite_conversion.') || a.action_type === 'purchase')
    .reduce((sum, a) => sum + Number(a.value), 0);
  return { leads, conversions };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function buildDateRange(isBackfill: boolean): { since: string; until: string } {
  const now = new Date();
  const until = formatDate(now);
  const since = new Date(now);
  since.setDate(since.getDate() - (isBackfill ? 90 : 7));
  return { since: formatDate(since), until };
}

export interface RawMetaInsight {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaAction[];
}

export interface MetaAdsInsightRow {
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  cpc: number;
  cpm: number;
  ctr: number;
  leads: number;
  conversions: number;
  actions_raw: MetaAction[] | null;
}

export function transformInsightRow(raw: RawMetaInsight, accountId: string): MetaAdsInsightRow {
  const { leads, conversions } = parseMetaActions(raw.actions ?? []);
  return {
    ad_account_id: accountId,
    campaign_id: raw.campaign_id,
    campaign_name: raw.campaign_name,
    date_start: raw.date_start,
    date_stop: raw.date_stop,
    spend: Number(raw.spend ?? 0),
    impressions: Number(raw.impressions ?? 0),
    clicks: Number(raw.clicks ?? 0),
    reach: Number(raw.reach ?? 0),
    frequency: Number(raw.frequency ?? 0),
    cpc: Number(raw.cpc ?? 0),
    cpm: Number(raw.cpm ?? 0),
    ctr: Number(raw.ctr ?? 0),
    leads,
    conversions,
    actions_raw: raw.actions ?? null,
  };
}
