import { supabase } from '@/integrations/supabase/client';

type AssignedField = 'assigned_comercial' | 'assigned_crm' | 'assigned_mktplace' | 'assigned_ads_manager';

/**
 * Resolve o user_id correto pra ser dono de uma task autogerada.
 * Busca o assignee do cliente no campo informado; cai pro fallback
 * (geralmente o usuário logado) se o cliente não tiver assignee.
 *
 * Boundary é a RLS — não fazemos error handling extra. `maybeSingle`
 * retorna null se cliente sumir, e o fallback resolve.
 */
export async function resolveTaskOwner(
  clientId: string,
  field: AssignedField,
  fallbackUserId: string,
): Promise<string> {
  const { data } = await supabase
    .from('clients')
    .select(field)
    .eq('id', clientId)
    .maybeSingle();
  const assignee = (data as any)?.[field] as string | null | undefined;
  return assignee || fallbackUserId;
}
