import type { SupabaseClient } from '@supabase/supabase-js';

const TAG_ESPERAR_BRIEFING = 'Esperar Briefing';

/**
 * Check if a client has an active (non-dismissed) "Esperar Briefing" tag.
 * Used server-side (in mutation functions) to block task completion
 * across Comercial, CRM, and MKTPlace boards.
 */
export async function isClientBlockedByBriefing(
  supabase: SupabaseClient,
  clientId: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('client_tags')
    .select('id')
    .eq('client_id', clientId)
    .eq('name', TAG_ESPERAR_BRIEFING)
    .is('dismissed_at', null)
    .limit(1);

  return !!(data && data.length > 0);
}
