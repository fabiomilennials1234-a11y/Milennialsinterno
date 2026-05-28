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

export type SyncMode = 'leads' | 'insights' | 'full' | 'backfill';

const SYNC_DAYS: Record<SyncMode, number> = {
  leads: 2,
  insights: 2,
  full: 7,
  backfill: 90,
};

export function buildDateRange(mode: SyncMode): { since: string; until: string } {
  const now = new Date();
  const until = formatDate(now);
  const since = new Date(now);
  since.setDate(since.getDate() - SYNC_DAYS[mode]);
  return { since: formatDate(since), until };
}

export interface DatePreset {
  label: string;
  value: { since: string; until: string };
}

export function getDatePresets(): DatePreset[] {
  const now = new Date();
  const today = formatDate(now);

  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return formatDate(d);
  };

  const monthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));

  const prevMonthStart = formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthEnd = formatDate(new Date(now.getFullYear(), now.getMonth(), 0));

  return [
    { label: 'Hoje', value: { since: today, until: today } },
    { label: 'Últimos 7 dias', value: { since: daysAgo(7), until: today } },
    { label: 'Últimos 30 dias', value: { since: daysAgo(30), until: today } },
    { label: 'Mês atual', value: { since: monthStart, until: today } },
    { label: 'Mês anterior', value: { since: prevMonthStart, until: prevMonthEnd } },
  ];
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

export interface LeadFieldEntry {
  name: string;
  values: string[];
}

const NAME_KEYS = ['full_name', 'nome', 'name', 'nome_completo', 'first_name'];
const EMAIL_KEYS = ['email', 'e-mail', 'e_mail'];
const PHONE_KEYS = ['phone_number', 'telefone', 'phone', 'celular', 'whatsapp'];

function findFieldValue(fields: LeadFieldEntry[], keys: string[]): string {
  const field = fields.find(f => keys.includes(f.name.toLowerCase()));
  return field?.values?.[0] ?? '';
}

export function parseLeadFieldData(fields: LeadFieldEntry[]): { name: string; email: string; phone: string } {
  return {
    name: findFieldValue(fields, NAME_KEYS),
    email: findFieldValue(fields, EMAIL_KEYS),
    phone: findFieldValue(fields, PHONE_KEYS),
  };
}

export interface RawAdLevelInsight extends RawMetaInsight {
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
}

export interface AdLevelInsightRow extends MetaAdsInsightRow {
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  creative_thumbnail_url: string | null;
}

export function transformAdLevelInsightRow(
  raw: RawAdLevelInsight,
  accountId: string,
  thumbnailUrl?: string,
): AdLevelInsightRow {
  const base = transformInsightRow(raw, accountId);
  return {
    ...base,
    adset_id: raw.adset_id ?? null,
    adset_name: raw.adset_name ?? null,
    ad_id: raw.ad_id ?? null,
    ad_name: raw.ad_name ?? null,
    creative_thumbnail_url: thumbnailUrl ?? null,
  };
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

export interface SalesMetrics {
  numSales: number;
  costPerPurchase: number;
  salesValue: number;
  spend: number;
  roi: number;
}

export function computeSalesMetrics(totalSpend: number, totalSales: number, totalSalesValue: number): SalesMetrics {
  return {
    numSales: totalSales,
    costPerPurchase: totalSales > 0 ? totalSpend / totalSales : 0,
    salesValue: totalSalesValue,
    spend: totalSpend,
    roi: totalSpend > 0 ? totalSalesValue / totalSpend : 0,
  };
}
