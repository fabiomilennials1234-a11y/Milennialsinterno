// Canonical client lifecycle helpers.
//
// "Campaign published / in tracking" is NOT a status of its own in the modern
// model — it is `status='active'` + `campaign_published_at NOT NULL`. The legacy
// status 'campaign_published' is deprecated and must never be (re)assigned to a
// live client, or it falls into a limbo invisible to the ads manager board
// (see AdsAcompanhamentoSection: only `active` + campaign_published_at renders).

export interface RestorableClientFields {
  campaign_published_at?: string | null;
  onboarding_started_at?: string | null;
}

export type RestoredClientStatus = 'active' | 'onboarding' | 'new_client';

/**
 * Status a client should return to when restored from churn/archive.
 * A client that already had a published campaign comes back as `active`
 * (preserving campaign_published_at), so it reappears on the ads manager board.
 */
export function deriveRestoredStatus(client: RestorableClientFields): RestoredClientStatus {
  if (client.campaign_published_at) return 'active';
  if (client.onboarding_started_at) return 'onboarding';
  return 'new_client';
}

/**
 * Whether a client is in the "published campaign / in tracking" state under the
 * canonical modern model. Use this instead of comparing to the legacy
 * 'campaign_published' status string.
 */
export function isCampaignPublished(client: {
  status: string;
  archived?: boolean | null;
  campaign_published_at?: string | null;
}): boolean {
  return !client.archived && client.status === 'active' && !!client.campaign_published_at;
}
