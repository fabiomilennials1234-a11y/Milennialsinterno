import { supabase } from '@/integrations/supabase/client';

/**
 * Growth cross-kanban RPC helpers.
 *
 * These are called from onboarding/CRM completion flows when the client
 * belongs to the Growth product (contracted_products includes 'millennials-growth').
 *
 * Each function is fire-and-forget with error logging — the primary flow
 * (onboarding task completion, CRM step advance) must NOT fail because of
 * Growth-specific side-effects.
 */

export function isGrowthClient(client: { contracted_products?: string[] | null }): boolean {
  return Array.isArray(client.contracted_products)
    && client.contracted_products.includes('millennials-growth');
}

/**
 * Called when ADS completes `publicar_campanha` for a Growth client.
 * - Dismisses TORQUE BLOQUEADO tag
 * - Sets growth_torque_unblocked_at
 * - Creates "Esperar TORQUE [Name]" label in ADS
 * - Creates 2 GP auto-tasks (Brifar CRM)
 */
export async function callGrowthOnAdsPublicarCampanha(clientId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('growth_on_ads_publicar_campanha', {
      p_client_id: clientId,
    });
    if (error) {
      console.error('[growth_on_ads_publicar_campanha] RPC error:', error.message);
    }
  } catch (err) {
    console.error('[growth_on_ads_publicar_campanha] unexpected error:', err);
  }
}

/**
 * Called when ADS client enters daily tracking (publicar_campanha done).
 * Sets growth_counter_ended_at to stop the 21-day GP counter.
 */
export async function callGrowthOnAdsDailyTracking(clientId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('growth_on_ads_daily_tracking', {
      p_client_id: clientId,
    });
    if (error) {
      console.error('[growth_on_ads_daily_tracking] RPC error:', error.message);
    }
  } catch (err) {
    console.error('[growth_on_ads_daily_tracking] unexpected error:', err);
  }
}

/**
 * Called when CRM configuration is finalized for a Growth client.
 * Dismisses all "Esperar TORQUE%" tags from growth_ads_publicar source.
 */
export async function callGrowthOnCrmFinalizado(clientId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('growth_on_crm_finalizado', {
      p_client_id: clientId,
    });
    if (error) {
      console.error('[growth_on_crm_finalizado] RPC error:', error.message);
    }
  } catch (err) {
    console.error('[growth_on_crm_finalizado] unexpected error:', err);
  }
}
