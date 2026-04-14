import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ===================== STATUS / STEPS =====================

export const MKTPLACE_CONSULTORIA_STEPS = [
  'consultoria_marcada',
  'enviar_diagnostico',
  'diagnostico_enviado',
] as const;

export const MKTPLACE_GESTAO_STEPS = [
  'onboarding_marcado',
  'apresentar_estrategia',
  'estrategia_apresentada',
  'acessos_pegados',
  'iniciar_plano',
] as const;

export type ConsultoriaStep = typeof MKTPLACE_CONSULTORIA_STEPS[number];
export type GestaoStep = typeof MKTPLACE_GESTAO_STEPS[number];

// Task names generated per step
export const CONSULTORIA_TASK_MAP: Record<string, (name: string) => string> = {
  novo: (n) => `Marcar Consultoria de MKT Place ${n}`,
  consultoria_marcada: (n) => `Realizar Consultoria de MKT Place ${n}`,
  enviar_diagnostico: (n) => `Enviar diagnóstico de mudanças ${n}`,
  diagnostico_enviado: (n) => `Confirmar Visualização do Diagnóstico ${n}`,
};

export const GESTAO_TASK_MAP: Record<string, (name: string) => string> = {
  novo: (n) => `Marcar de Onboarding - Gestão de MKT Place ${n}`,
  onboarding_marcado: (n) => `Realizar Onboarding - Gestão de MKT Place ${n}`,
  apresentar_estrategia: (n) => `Criar e enviar estratégia ao cliente ${n}`,
  estrategia_apresentada: (n) => `Pegar acessos e acessar MKT Place ${n}`,
  acessos_pegados: (n) => `Iniciar campanhas MKT Place ${n}`,
};

// Next step mapping
const CONSULTORIA_NEXT: Record<string, string | 'acompanhamento'> = {
  novo: 'consultoria_marcada',
  consultoria_marcada: 'enviar_diagnostico',
  enviar_diagnostico: 'diagnostico_enviado',
  diagnostico_enviado: 'acompanhamento',
};

const GESTAO_NEXT: Record<string, string | 'acompanhamento'> = {
  novo: 'onboarding_marcado',
  onboarding_marcado: 'apresentar_estrategia',
  apresentar_estrategia: 'estrategia_apresentada',
  estrategia_apresentada: 'acessos_pegados',
  acessos_pegados: 'iniciar_plano',
  iniciar_plano: 'acompanhamento',
};

// ===================== DAY HELPERS =====================

const DAY_MAP: Record<number, string> = {
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
};

export function getCurrentWeekday(): string {
  const day = new Date().getDay();
  return DAY_MAP[day] || 'segunda';
}

export const DAYS = [
  { id: 'segunda', label: 'SEG' },
  { id: 'terca', label: 'TER' },
  { id: 'quarta', label: 'QUA' },
  { id: 'quinta', label: 'QUI' },
  { id: 'sexta', label: 'SEX' },
];

// ===================== HOOKS =====================

// Fetch clients assigned to the current consultor MKT Place
export function useMktplaceClients() {
  const { user, isCEO, isAdminUser } = useAuth();

  return useQuery({
    queryKey: ['mktplace-all-clients', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, monthly_value, mktplace_status, mktplace_entered_at, assigned_mktplace, assigned_ads_manager, assigned_crm, assigned_rh')
        .eq('archived', false)
        .not('assigned_mktplace', 'is', null)
        .not('mktplace_status', 'is', null)
        .order('mktplace_entered_at', { ascending: true });

      if (user?.role === 'consultor_mktplace') {
        query = query.eq('assigned_mktplace', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

// Fetch daily tracking for acompanhamento
export function useMktplaceTracking() {
  const { user, isCEO, isAdminUser } = useAuth();

  return useQuery({
    queryKey: ['mktplace-tracking', user?.id],
    queryFn: async () => {
      let query = (supabase as any)
        .from('mktplace_daily_tracking')
        .select('*, clients:client_id(id, name, razao_social, contracted_products, monthly_value, client_label)')
        .order('last_moved_at', { ascending: true });

      if (user?.role === 'consultor_mktplace') {
        query = query.eq('consultor_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

// Fetch daily documentation
export function useMktplaceDocumentation() {
  const { user, isCEO, isAdminUser } = useAuth();

  return useQuery({
    queryKey: ['mktplace-documentation', user?.id],
    queryFn: async () => {
      let query = (supabase as any)
        .from('mktplace_daily_documentation')
        .select('*, clients:client_id(id, name, razao_social)')
        .order('documentation_date', { ascending: false });

      if (user?.role === 'consultor_mktplace') {
        query = query.eq('consultor_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

// Get profiles for responsible names
export function useMktplaceProfiles() {
  return useQuery({
    queryKey: ['mktplace-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name');
      if (error) throw error;
      return data || [];
    },
  });
}

// ===================== MUTATIONS =====================

// Advance client to next onboarding step + create next task
export function useAdvanceMktplaceStep() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, clientName, currentStatus, isGestao }: {
      clientId: string;
      clientName: string;
      currentStatus: string;
      isGestao: boolean;
    }) => {
      const nextMap = isGestao ? GESTAO_NEXT : CONSULTORIA_NEXT;
      const taskMap = isGestao ? GESTAO_TASK_MAP : CONSULTORIA_TASK_MAP;
      const nextStatus = nextMap[currentStatus];

      if (!nextStatus) throw new Error('Status inválido para avanço');

      if (nextStatus === 'acompanhamento') {
        // Move to acompanhamento — update status and create tracking entry
        const trackingType = isGestao ? 'gestao' : 'consultoria';
        const acompStatus = isGestao ? 'acompanhamento_gestao' : 'acompanhamento_consultoria';
        const weekday = getCurrentWeekday();

        await supabase
          .from('clients')
          .update({ mktplace_status: acompStatus })
          .eq('id', clientId);

        // Get assigned_mktplace
        const { data: clientData } = await supabase
          .from('clients')
          .select('assigned_mktplace')
          .eq('id', clientId)
          .single();

        await (supabase as any).from('mktplace_daily_tracking').upsert({
          client_id: clientId,
          consultor_id: clientData?.assigned_mktplace || user?.id,
          current_day: weekday,
          last_moved_at: new Date().toISOString(),
          tracking_type: trackingType,
        }, { onConflict: 'client_id' });
      } else {
        // Move to next onboarding step
        await supabase
          .from('clients')
          .update({ mktplace_status: nextStatus })
          .eq('id', clientId);

        // Create next task
        const taskNameFn = taskMap[nextStatus];
        if (taskNameFn && user?.id) {
          await supabase.from('department_tasks').insert({
            user_id: user.id,
            title: taskNameFn(clientName),
            task_type: 'daily',
            status: 'todo',
            priority: 'high',
            department: 'consultor_mktplace',
            related_client_id: clientId,
          } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-all-clients'] });
      queryClient.invalidateQueries({ queryKey: ['mktplace-new-clients'] });
      queryClient.invalidateQueries({ queryKey: ['mktplace-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Cliente avançado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error('Erro ao avançar cliente', { description: err.message });
    },
  });
}

// Create initial task when client arrives as "novo"
export function useCreateMktplaceInitialTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, clientName, isGestao }: {
      clientId: string;
      clientName: string;
      isGestao: boolean;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const taskMap = isGestao ? GESTAO_TASK_MAP : CONSULTORIA_TASK_MAP;
      const taskNameFn = taskMap['novo'];
      if (!taskNameFn) return;

      // Check if task already exists
      const { data: existing } = await supabase
        .from('department_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('department', 'consultor_mktplace')
        .eq('archived', false)
        .limit(1);

      if (existing && existing.length > 0) return;

      await supabase.from('department_tasks').insert({
        user_id: user.id,
        title: taskNameFn(clientName),
        task_type: 'daily',
        status: 'todo',
        priority: 'high',
        department: 'consultor_mktplace',
        related_client_id: clientId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
    },
  });
}

// Move client to a new day in acompanhamento
export function useMoveClientMktplace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, newDay }: { clientId: string; newDay: string }) => {
      const { error } = await (supabase as any)
        .from('mktplace_daily_tracking')
        .update({
          current_day: newDay,
          last_moved_at: new Date().toISOString(),
          is_delayed: false,
        })
        .eq('client_id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-tracking'] });
    },
  });
}

// Save daily documentation
export function useSaveMktplaceDoc() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (doc: {
      clientId: string;
      trackingType: string;
      falou_com_cliente?: string;
      falou_justificativa?: string;
      fez_algo_novo: string;
      fez_algo_justificativa?: string;
      fez_algo_descricao?: string;
      combinado: string;
      combinado_descricao?: string;
      combinado_prazo?: string;
      combinado_justificativa?: string;
    }) => {
      const today = format(new Date(), 'yyyy-MM-dd');

      await (supabase as any).from('mktplace_daily_documentation').upsert({
        client_id: doc.clientId,
        consultor_id: user?.id,
        documentation_date: today,
        tracking_type: doc.trackingType,
        falou_com_cliente: doc.falou_com_cliente || null,
        falou_justificativa: doc.falou_justificativa || null,
        fez_algo_novo: doc.fez_algo_novo,
        fez_algo_justificativa: doc.fez_algo_justificativa || null,
        fez_algo_descricao: doc.fez_algo_descricao || null,
        combinado: doc.combinado,
        combinado_descricao: doc.combinado_descricao || null,
        combinado_prazo: doc.combinado_prazo || null,
        combinado_justificativa: doc.combinado_justificativa || null,
      }, { onConflict: 'client_id,documentation_date' });

      // If combinado = sim and has prazo, create a task
      if (doc.combinado === 'sim' && doc.combinado_descricao && doc.combinado_prazo && user?.id) {
        await supabase.from('department_tasks').insert({
          user_id: user.id,
          title: doc.combinado_descricao,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          department: 'consultor_mktplace',
          related_client_id: doc.clientId,
          due_date: doc.combinado_prazo,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-documentation'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Documentação salva!');
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar documentação', { description: err.message });
    },
  });
}

// Helper: get client type from contracted_products
export function isGestaoMktplace(client: { contracted_products?: string[] | null }): boolean {
  const products = (client.contracted_products as string[]) || [];
  return products.includes('gestor-mktplace');
}
