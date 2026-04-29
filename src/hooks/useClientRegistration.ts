import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Criação de cliente roda exclusivamente via RPC `create_client_with_automations`.
 * RPC é tudo-ou-nada: rollback atômico, sem `automationErrors[]` parcial.
 *
 * Caminho legacy (insert + automações sequenciais não-transacionais) foi
 * removido em 2026-04-29 após rollout estável.
 */

export interface OrganizationGroup {
  id: string;
  name: string;
  slug: string;
}

export interface Squad {
  id: string;
  name: string;
  slug: string;
  group_id: string;
  group_name?: string;
}

export interface AdsManager {
  user_id: string;
  name: string;
  email: string;
}

export interface ComercialConsultant {
  user_id: string;
  name: string;
  email: string;
}

export interface ProductValueInput {
  product_slug: string;
  product_name: string;
  monthly_value: number;
}

export interface CrmManager {
  user_id: string;
  name: string;
  email: string;
}

export interface RhUser {
  user_id: string;
  name: string;
  email: string;
}

export interface OutboundManager {
  user_id: string;
  name: string;
  email: string;
}

export interface NewClientData {
  name: string;
  cnpj?: string;
  cpf?: string;
  phone?: string;
  razao_social?: string;
  niche?: string;
  general_info?: string;
  expected_investment?: number;
  monthly_value?: number;
  sales_percentage?: number;
  group_id?: string;
  squad_id?: string;
  assigned_ads_manager?: string;
  assigned_comercial?: string;
  assigned_crm?: string;
  assigned_rh?: string;
  assigned_outbound_manager?: string;
  assigned_mktplace?: string;
  assigned_sucesso_cliente?: string;
  entry_date?: string;
  contract_duration_months?: number;
  payment_due_day?: number;
  contracted_products?: string[];
  torque_crm_products?: ('v8' | 'automation' | 'copilot')[];
  product_values?: ProductValueInput[];
}

// Fetch groups for dropdown
export function useGroups() {
  return useQuery({
    queryKey: ['registration-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_groups')
        .select('id, name, slug')
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as OrganizationGroup[];
    },
  });
}

// Fetch squads for dropdown (filtered by group)
export function useSquads(groupId?: string) {
  return useQuery({
    queryKey: ['registration-squads', groupId],
    queryFn: async () => {
      let query = supabase
        .from('squads')
        .select('id, name, slug, group_id')
        .order('position', { ascending: true });
      
      if (groupId) {
        query = query.eq('group_id', groupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Squad[];
    },
    enabled: !!groupId,
  });
}

// Fetch ads managers for dropdown (filtrado por squad quando informado)
export function useAdsManagers(squadId?: string) {
  return useQuery({
    queryKey: ['ads-managers', squadId || 'all'],
    queryFn: async () => {
      // Get all users with gestor_ads role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_ads');

      if (roleError) throw roleError;

      const userIds = roleData?.map(r => r.user_id) || [];

      if (userIds.length === 0) return [];

      // Get profile info for these users
      let query = supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (squadId) {
        query = query.eq('squad_id', squadId);
      }

      const { data: profiles, error: profileError } = await query;

      if (profileError) throw profileError;

      return profiles as AdsManager[];
    },
  });
}

// Fetch comercial consultants for dropdown (filtrado por squad quando informado)
export function useComercialConsultants(squadId?: string) {
  return useQuery({
    queryKey: ['comercial-consultants', squadId || 'all'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_comercial');

      if (roleError) throw roleError;

      const userIds = roleData?.map(r => r.user_id) || [];

      if (userIds.length === 0) return [];

      let query = supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (squadId) {
        query = query.eq('squad_id', squadId);
      }

      const { data: profiles, error: profileError } = await query;

      if (profileError) throw profileError;

      return profiles as ComercialConsultant[];
    },
  });
}

// Fetch MKT Place consultants for dropdown
export function useMktplaceConsultants() {
  return useQuery({
    queryKey: ['mktplace-consultants'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_mktplace');

      if (roleError) throw roleError;
      const userIds = roleData?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profileError) throw profileError;
      return profiles as { user_id: string; name: string; email: string }[];
    },
  });
}

// Fetch CRM managers for dropdown (Torque CRM)
export function useCrmManagers() {
  return useQuery({
    queryKey: ['crm-managers'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_crm');

      if (roleError) throw roleError;
      const userIds = roleData?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profileError) throw profileError;
      return profiles as CrmManager[];
    },
  });
}

// Fetch RH users for dropdown (Millennials Hunting)
export function useRhUsers() {
  return useQuery({
    queryKey: ['rh-users'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'rh');

      if (roleError) throw roleError;
      const userIds = roleData?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profileError) throw profileError;
      return profiles as RhUser[];
    },
  });
}

// Fetch outbound managers for dropdown (Millennials Outbound)
export function useOutboundManagers() {
  return useQuery({
    queryKey: ['outbound-managers'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'outbound');

      if (roleError) throw roleError;
      const userIds = roleData?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profileError) throw profileError;
      return profiles as OutboundManager[];
    },
  });
}

// Um ponto de falha silenciosa durante o fluxo de criação.
// Agregado pelo mutationFn e reportado no onSuccess (toast + log estruturado).
export interface AutomationError {
  step: string;
  error: string;
  table?: string;
}

/**
 * Monta payload jsonb esperado pela RPC `create_client_with_automations`.
 * Trima strings, normaliza '' → null, preserva arrays.
 * Mantém `entry_date` como string ISO (date-only `yyyy-mm-dd`) se fornecida.
 */
function buildRpcPayload(clientData: NewClientData): Record<string, unknown> {
  const nullIfBlank = (v?: string) => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    name: clientData.name?.trim() ?? '',
    cnpj: nullIfBlank(clientData.cnpj),
    cpf: nullIfBlank(clientData.cpf),
    phone: nullIfBlank(clientData.phone),
    razao_social: nullIfBlank(clientData.razao_social),
    niche: nullIfBlank(clientData.niche),
    general_info: nullIfBlank(clientData.general_info),
    expected_investment: clientData.expected_investment ?? null,
    monthly_value: clientData.monthly_value ?? null,
    sales_percentage: clientData.sales_percentage ?? null,
    group_id: clientData.group_id ?? null,
    squad_id: clientData.squad_id ?? null,
    assigned_ads_manager: clientData.assigned_ads_manager || null,
    assigned_comercial: clientData.assigned_comercial || null,
    assigned_crm: clientData.assigned_crm || null,
    assigned_rh: clientData.assigned_rh || null,
    assigned_outbound_manager: clientData.assigned_outbound_manager || null,
    assigned_mktplace: clientData.assigned_mktplace || null,
    assigned_sucesso_cliente: clientData.assigned_sucesso_cliente || null,
    entry_date: clientData.entry_date ?? null,
    contract_duration_months: clientData.contract_duration_months ?? null,
    payment_due_day: clientData.payment_due_day ?? null,
    contracted_products: clientData.contracted_products ?? [],
    torque_crm_products: clientData.torque_crm_products ?? [],
    product_values: clientData.product_values ?? [],
  };
}

interface RpcResult {
  client_id: string;
  automations_executed?: string[];
  warnings?: string[];
  idempotent_hit?: boolean;
  schema_version?: string;
}

/**
 * Caminho RPC: chama `create_client_with_automations`, rehidrata cliente completo
 * pra manter contrato antigo (`{ client, automationErrors, rpcResult }`).
 * Erros da RPC vêm como `P0001..P0006` — re-throw com `code` anexado pro `onError` mapear.
 */
async function createClientViaRpc(clientData: NewClientData) {
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : null;
  const payload = buildRpcPayload(clientData);

  // RPC ainda não presente nos types gerados.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('create_client_with_automations', {
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  const rpcResult = data as RpcResult;
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', rpcResult.client_id)
    .single();

  if (fetchError) throw fetchError;

  // Path RPC: tudo-ou-nada. Sem automationErrors parciais.
  return { client, automationErrors: [] as AutomationError[], rpcResult };
}


// Create new client
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: NewClientData) => {
      return await createClientViaRpc(clientData);
    },
    onSuccess: ({ client, automationErrors, rpcResult }) => {
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['board-cards'] });
      queryClient.invalidateQueries({ queryKey: ['recent-clients'] });
      queryClient.invalidateQueries({ queryKey: ['total-clients-count'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      // Invalidar queries do Consultor Comercial
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      // Invalidar queries do Gestor de Ads (kanban)
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['ads-new-client-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      // Invalidar queries do Financeiro
      queryClient.invalidateQueries({ queryKey: ['financeiro-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['pm-welcome-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contract-onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['contract-active-clients'] });
      // Invalidar contadores da sidebar (gestor, treinador, mktplace, crm, outbound)
      queryClient.invalidateQueries({ queryKey: ['all-gestor-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-treinador-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-mktplace-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-crm-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-outbound-client-counts'] });
      // Invalidar queries do Consultor de MKT Place (kanban)
      queryClient.invalidateQueries({ queryKey: ['mktplace-new-clients'] });

      // Telemetria do path RPC: log resultado bruto pra rastrear rollout.
      // Usa warn (única categoria permitida pela lint além de error) como canal estruturado.
      if (rpcResult) {
        console.warn('[useCreateClient] rpc success', rpcResult);
      }

      if (automationErrors.length === 0) {
        toast.success('Cliente cadastrado com sucesso!', {
          description: 'Contrato assinado automaticamente. Tarefas do Financeiro criadas por produto.',
        });
        return;
      }

      // Parcial: cliente criado mas N automações falharam — NÃO mentir pro usuário.
      // (Só ocorre no caminho legacy; path RPC é tudo-ou-nada.)
      console.warn('[useCreateClient] partial_success', {
        client_id: client.id,
        client_name: client.name,
        errors: automationErrors,
      });

      const description = automationErrors
        .slice(0, 5)
        .map(e => `• ${e.step}${e.table ? ` (${e.table})` : ''}: ${e.error}`)
        .join('\n');
      const extra = automationErrors.length > 5
        ? `\n… +${automationErrors.length - 5} outras falhas`
        : '';

      toast.warning(
        `Cliente criado, mas ${automationErrors.length} automação${automationErrors.length > 1 ? 'ões' : ''} falhou${automationErrors.length > 1 ? 'aram' : ''}`,
        {
          description: description + extra,
          duration: 15000,
        },
      );
    },
    onError: (error: Error & { code?: string }) => {
      console.error('[useCreateClient] fatal', { error, code: error.code });
      const errorMessage = error.message;
      const code = error.code;

      if (code === 'P0004' || errorMessage?.includes('idx_clients_cnpj_unique')) {
        toast.error('CNPJ já cadastrado', {
          description: 'Já existe um cliente com esse CNPJ no sistema.',
        });
      } else if (code === 'P0003') {
        toast.error('Sem permissão', {
          description: 'Seu papel não permite criar clientes.',
        });
      } else if (code === 'P0002') {
        toast.error('Dados inválidos', { description: errorMessage });
      } else if (code === 'P0005' || code === 'P0006') {
        toast.error('Conflito ao cadastrar', { description: errorMessage });
      } else {
        toast.error('Erro ao cadastrar cliente', { description: errorMessage });
      }
    },
  });
}
