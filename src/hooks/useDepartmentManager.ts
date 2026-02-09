import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Shared interfaces
export interface DepartmentClient {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  razao_social: string | null;
  general_info: string | null;
  expected_investment: number | null;
  group_id: string | null;
  squad_id: string | null;
  assigned_ads_manager: string | null;
  status: string;
  onboarding_started_at: string | null;
  campaign_published_at: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
  sales_percentage: number;
  entry_date: string | null;
  client_label?: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
}

export interface DepartmentTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  task_type: 'daily' | 'weekly';
  status: 'todo' | 'doing' | 'done';
  priority: string | null;
  due_date: string | null;
  department: string;
  created_at: string;
  archived: boolean;
}

// =============================================
// SUCESSO DO CLIENTE HOOKS
// =============================================

// Fetch all clients for Sucesso do Cliente (they see all clients assigned to any ads manager)
export function useSucessoClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['sucesso-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// =============================================
// CONSULTOR COMERCIAL HOOKS
// =============================================

// Fetch ALL new clients for Consultor Comercial (regardless of assignment)
export function useComercialNewClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['comercial-new-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'new_client')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// Fetch all clients for Consultor Comercial
export function useComercialClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['comercial-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// Fetch churned clients for Consultor Comercial
export function useComercialChurnedClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['comercial-churned-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or('status.eq.churned,archived.eq.true')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// =============================================
// FINANCEIRO HOOKS
// =============================================

// Fetch all clients for Financeiro
export function useFinanceiroClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// Fetch churned clients for Financeiro (for distrato)
export function useFinanceiroChurnedClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro-churned-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or('status.eq.churned,archived.eq.true')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// =============================================
// GESTOR DE PROJETOS HOOKS
// =============================================

// Fetch all clients for overview
export function useGestorProjetosClients() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['gestor-projetos-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DepartmentClient[];
    },
    enabled: !!user,
  });
}

// =============================================
// SHARED MUTATIONS
// =============================================

// Archive a churned client (used by multiple departments)
export function useArchiveClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        } as any)
        .eq('id', clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      toast.success('Cliente arquivado com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao arquivar cliente', { description: error.message });
    },
  });
}

// Mark client as churned and create notification
// Routes to correct distrato workflow based on contract status
export function useMarkClientAsChurn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      // Check if client has a signed and valid contract
      const { data: activeClient } = await supabase
        .from('financeiro_active_clients')
        .select('contract_expires_at')
        .eq('client_id', clientId)
        .single();

      // Determine if contract is valid (signed and not expired)
      let hasValidContract = false;
      if (activeClient?.contract_expires_at) {
        const expiresAt = new Date(activeClient.contract_expires_at);
        hasValidContract = expiresAt > new Date();
      }

      // Determine which distrato step to use based on contract status:
      // - COM contrato válido -> churn_solicitado (fluxo de 4 etapas)
      // - SEM contrato ou expirado -> sem_contrato_solicitado (fluxo de 2 etapas)
      const distratoStep = hasValidContract ? 'churn_solicitado' : 'sem_contrato_solicitado';

      // Remove from active clients if exists
      await supabase
        .from('financeiro_active_clients')
        .delete()
        .eq('client_id', clientId);

      // Update client status with distrato_step
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          status: 'churned',
          distrato_step: distratoStep,
          distrato_entered_at: new Date().toISOString(),
        })
        .eq('id', clientId);
      
      if (updateError) throw updateError;

      // Create churn notification for all relevant users
      const { error: notifError } = await supabase
        .from('churn_notifications')
        .insert({
          client_id: clientId,
          client_name: clientName,
        } as any);
      
      // Don't fail if notification creation fails (might be permission issue)
      if (notifError) {
        console.warn('Failed to create churn notification:', notifError);
      }

      return { hasValidContract };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      queryClient.invalidateQueries({ queryKey: ['sucesso-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['churn-notifications'] });
      
      const workflowMessage = data?.hasValidContract 
        ? 'Cliente movido para Churn com Contrato'
        : 'Cliente movido para Churn sem Contrato';
      toast.success(workflowMessage);
    },
    onError: (error: any) => {
      toast.error('Erro ao marcar como churn', { description: error.message });
    },
  });
}
