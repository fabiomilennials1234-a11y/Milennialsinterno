import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addDays, addMonths, parseISO } from 'date-fns';
import { createNewClientNotificationAndTask } from '@/hooks/useAdsNewClientNotifications';

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

export interface NewClientData {
  name: string;
  cnpj?: string;
  cpf?: string;
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
  entry_date?: string;
  contract_duration_months?: number;
  contracted_products?: string[];
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

// Fetch ads managers for dropdown
export function useAdsManagers() {
  return useQuery({
    queryKey: ['ads-managers'],
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
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      return profiles as AdsManager[];
    },
  });
}

// Fetch comercial consultants for dropdown
export function useComercialConsultants() {
  return useQuery({
    queryKey: ['comercial-consultants'],
    queryFn: async () => {
      // Get all users with consultor_comercial role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_comercial');
      
      if (roleError) throw roleError;
      
      const userIds = roleData?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) return [];
      
      // Get profile info for these users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      return profiles as ComercialConsultant[];
    },
  });
}

// Create new client
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clientData: NewClientData) => {
      // Primeiro, cria o cliente
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: clientData.name,
          cnpj: clientData.cnpj,
          cpf: clientData.cpf,
          razao_social: clientData.razao_social,
          niche: clientData.niche,
          general_info: clientData.general_info,
          expected_investment: clientData.expected_investment,
          monthly_value: clientData.monthly_value,
          sales_percentage: clientData.sales_percentage,
          group_id: clientData.group_id,
          squad_id: clientData.squad_id,
          assigned_ads_manager: clientData.assigned_ads_manager,
          assigned_comercial: clientData.assigned_comercial,
          entry_date: clientData.entry_date,
          contract_duration_months: clientData.contract_duration_months || null,
          contracted_products: clientData.contracted_products,
          created_by: user?.id,
          status: 'new_client',
          // Campos para o Consultor Comercial
          comercial_status: 'novo',
          comercial_entered_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (clientError) throw clientError;

      // --- Automações disparadas pela criação do cliente ---
      if (client.assigned_ads_manager) {
        // 1. Notificação + tarefa diária para o gestor de ads
        if (user?.id) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', user.id)
              .single();

            const createdByName = (profile?.name as string) ?? 'Sistema';
            await createNewClientNotificationAndTask({
              clientId: client.id,
              clientName: client.name,
              adsManagerId: client.assigned_ads_manager,
              createdBy: user.id,
              createdByName,
            });
          } catch (err) {
            console.error('[useCreateClient] Falha na notificação/tarefa para gestor de ads:', err);
          }
        }

        // 2. Tarefa inicial de onboarding ("Marcar Call 1: [nome do cliente]")
        const dueDate = addDays(new Date(), 1);
        const { error: onboardingTaskError } = await supabase
          .from('onboarding_tasks')
          .insert({
            client_id: client.id,
            assigned_to: client.assigned_ads_manager,
            task_type: 'marcar_call_1',
            title: `Marcar Call 1: ${client.name}`,
            description: `Agendar a primeira call com o cliente para alinhamento inicial. Cliente: ${client.name}.`,
            status: 'pending',
            due_date: dueDate.toISOString(),
            milestone: 1,
          });

        if (onboardingTaskError) {
          console.error('[useCreateClient] Erro ao criar tarefa de onboarding:', onboardingTaskError);
        }

        // 3. Registro de onboarding do cliente (marco inicial)
        const { error: onboardingError } = await supabase
          .from('client_onboarding')
          .insert({
            client_id: client.id,
            current_milestone: 1,
            current_step: 'marcar_call_1',
            milestone_1_started_at: new Date().toISOString(),
          });

        if (onboardingError) {
          console.error('[useCreateClient] Erro ao criar registro de onboarding:', onboardingError);
        }
      }

      // N5: Notificar Consultor Comercial que um novo cliente foi atribuído
      if (client.assigned_comercial) {
        try {
          await supabase.from('system_notifications').insert({
            recipient_id: client.assigned_comercial,
            recipient_role: 'consultor_comercial',
            notification_type: 'new_client_assigned_comercial',
            title: '🆕 Novo Cliente Atribuído',
            message: `O cliente "${client.name}" foi cadastrado e atribuído a você. Faça o primeiro contato dentro de 24h.`,
            client_id: client.id,
            priority: 'high',
            metadata: { created_by: user?.id },
          } as any);
        } catch (err) {
          console.error('[useCreateClient] Falha na notificação N5 para comercial:', err);
        }
      }

      // Depois, salva os valores por produto
      if (clientData.product_values && clientData.product_values.length > 0) {
        const productValuesData = clientData.product_values.map(pv => ({
          client_id: client.id,
          product_slug: pv.product_slug,
          product_name: pv.product_name,
          monthly_value: pv.monthly_value,
        }));

        const { error: pvError } = await supabase
          .from('client_product_values')
          .insert(productValuesData);

        if (pvError) {
          console.error('Error saving product values:', pvError);
        }

        // --- FINANCEIRO: Criar financeiro_tasks (info em "Novo Cliente") ---
        const finTasksData = clientData.product_values.map(pv => ({
          client_id: client.id,
          product_slug: pv.product_slug,
          product_name: pv.product_name,
          title: `${clientData.name} — ${pv.product_name} → Cadastrar no Asaas + Enviar 1ª Cobrança`,
          status: 'pending',
          due_date: addDays(new Date(), 3).toISOString(),
        }));

        const { error: ftError } = await supabase
          .from('financeiro_tasks')
          .insert(finTasksData);

        if (ftError) {
          console.error('[useCreateClient] Erro financeiro_tasks:', ftError);
        }

        // --- FINANCEIRO: Criar department_tasks (ação em "Tarefas Diárias") ---
        const deptTasksData = clientData.product_values.map(pv => ({
          user_id: user?.id,
          title: `${clientData.name} — ${pv.product_name} → Cadastrar no Asaas + Enviar 1ª Cobrança`,
          description: pv.product_slug,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          department: 'financeiro',
          related_client_id: client.id,
          due_date: addDays(new Date(), 3).toISOString(),
        }));

        const { error: dtError } = await supabase
          .from('department_tasks')
          .insert(deptTasksData as any);

        if (dtError) {
          console.error('[useCreateClient] Erro department_tasks:', dtError);
        }
      }

      // --- FINANCEIRO PER-PRODUCT: Criar registros por produto ---
      const entryDate = clientData.entry_date
        ? parseISO(clientData.entry_date)
        : new Date();
      const durationMonths = clientData.contract_duration_months || 12;
      const contractExpirationDate = addMonths(entryDate, durationMonths)
        .toISOString()
        .split('T')[0]; // DATE only (yyyy-MM-dd)

      // Criar financeiro_client_onboarding PER-PRODUCT (trigger antigo foi desabilitado)
      if (clientData.product_values && clientData.product_values.length > 0) {
        const onboardingData = clientData.product_values.map(pv => ({
          client_id: client.id,
          product_slug: pv.product_slug,
          product_name: pv.product_name,
          current_step: 'novo_cliente',
          contract_expiration_date: contractExpirationDate,
        }));

        const { error: onboardingInsertError } = await supabase
          .from('financeiro_client_onboarding')
          .insert(onboardingData);

        if (onboardingInsertError) {
          console.error('[useCreateClient] Erro ao inserir financeiro_client_onboarding per-product:', onboardingInsertError);
        }

        // Inserir em financeiro_active_clients PER-PRODUCT (valor=0 até conclusão das tarefas diárias)
        const activeClientsData = clientData.product_values.map(pv => ({
          client_id: client.id,
          product_slug: pv.product_slug,
          product_name: pv.product_name,
          monthly_value: 0,
          invoice_status: 'em_dia',
          contract_expires_at: contractExpirationDate,
        }));

        const { error: activeClientError } = await supabase
          .from('financeiro_active_clients')
          .insert(activeClientsData);

        if (activeClientError) {
          console.error('[useCreateClient] Erro ao inserir financeiro_active_clients per-product:', activeClientError);
        }
      }

      return client;
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ['contract-onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['contract-active-clients'] });
      toast.success('Cliente cadastrado com sucesso!', {
        description: 'Contrato assinado automaticamente. Tarefas do Financeiro criadas por produto.',
      });
    },
    onError: (error: Error) => {
      console.error('Error creating client:', error);
      toast.error('Erro ao cadastrar cliente', {
        description: error.message,
      });
    },
  });
}
