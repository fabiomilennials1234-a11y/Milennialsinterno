import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { addDays } from 'date-fns';

export type ProblemType = 'performance' | 'expectativas' | 'estrategia' | 'valor_percebido';
export type Severity = 'leve' | 'moderado' | 'critico';
export type TaskType = 'action' | 'quick_win' | 'deliverable';

export interface ActionPlan {
  id: string;
  client_id: string;
  problem_type: ProblemType;
  severity: Severity;
  status: 'active' | 'completed' | 'cancelled';
  indicators: string[];
  notes: string | null;
  created_by: string;
  created_at: string;
  due_date: string;
  completed_at: string | null;
  updated_at: string;
}

export interface ActionPlanTask {
  id: string;
  action_plan_id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
}

// Problem type definitions with indicators
export const PROBLEM_TYPES: Record<ProblemType, {
  label: string;
  question: string;
  icon: string;
  indicators: string[];
}> = {
  performance: {
    label: 'Problema de Performance',
    question: 'Os resultados estão abaixo do esperado?',
    icon: '🎯',
    indicators: [
      'CPA acima do esperado',
      'Volume de leads baixo',
      'Conversão ruim',
      'Criativos saturados',
    ],
  },
  expectativas: {
    label: 'Problema de Expectativas',
    question: 'O cliente entende o que é sucesso hoje?',
    icon: '👥',
    indicators: [
      'Cliente esperava mais em menos tempo',
      'KPI mal definido',
      'Promessa mal compreendida',
    ],
  },
  estrategia: {
    label: 'Problema de Estratégia',
    question: 'Ele sente que recebe valor contínuo?',
    icon: '📊',
    indicators: [
      'Funil mal estruturado',
      'Oferta fraca',
      'Público errado',
      'Mudança de posicionamento',
    ],
  },
  valor_percebido: {
    label: 'Problema de Valor Percebido',
    question: 'Questiona preço / ROI / contrato?',
    icon: '💰',
    indicators: [
      'Cliente não vê entregas',
      'Questiona esforço da agência',
      'Sente que "só roda anúncio"',
    ],
  },
};

// Severity configuration
export const SEVERITY_CONFIG: Record<Severity, {
  label: string;
  days: number;
  color: string;
  bgColor: string;
}> = {
  leve: { label: 'Leve - 30 dias', days: 30, color: 'text-success', bgColor: 'bg-success/10' },
  moderado: { label: 'Moderado - 60 dias', days: 60, color: 'text-warning', bgColor: 'bg-warning/10' },
  critico: { label: 'Crítico - 90 dias', days: 90, color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

// Predefined actions by problem type and severity
export const PREDEFINED_ACTIONS: Record<ProblemType, Record<Severity, {
  actions: string[];
  quickWins: string[];
  deliverables: string[];
}>> = {
  performance: {
    leve: {
      actions: [
        'Diagnóstico técnico rápido (campanhas, públicos, criativos, funil)',
        'Troca ou variação de criativos (inclui produtora)',
        'Ajuste de orçamento e lances',
        'Revisão de copy e CTA',
        'Testes estruturados (A/B de criativos e públicos)',
        'Criar 1 campanha de oportunidade (oferta âncora)',
        'Otimização contínua',
        'Comunicação e acompanhamento próximo no grupo ou através de ligação gerando ainda mais valor',
      ],
      quickWins: [
        'Novo criativo no ar em até 7 dias',
        'Pequena melhora em CTR ou CPL',
      ],
      deliverables: [
        'Relatório visual simples',
        'Lista de testes realizados',
        'Próximos testes priorizados',
      ],
    },
    moderado: {
      actions: [
        'Novo criativo + nova promessa',
        'Campanha de baixo risco (retargeting / fundo de funil)',
      ],
      quickWins: [],
      deliverables: [
        'Mapa de funil',
        'Relatório de aprendizados',
        'Roadmap de crescimento',
      ],
    },
    critico: {
      actions: [
        'Ação tática focada em conversão direta',
        'Criativo gravado (produto, bastidor, autoridade)',
      ],
      quickWins: [],
      deliverables: [
        'Plano de recuperação',
        'Relatório executivo',
        'Nova tese de crescimento',
      ],
    },
  },
  expectativas: {
    leve: {
      actions: [
        'Alinhamento rápido de KPIs',
        'Reexplicação da estratégia',
        'Ajuste de discurso',
        'Comunicação contínua com o cliente a fim de alinhar cada vez mais suas expectativas',
        'Análise de comportamento e adaptação dinâmica',
      ],
      quickWins: [
        'Clareza = redução imediata de atrito',
        'Reforço educativo',
        'Checkpoints mensais de expectativa',
      ],
      deliverables: [],
    },
    moderado: {
      actions: [
        'Novo KPI intermediário (vitória visível)',
        'Recontrato de metas',
        'Micro entregas visíveis',
      ],
      quickWins: [],
      deliverables: [],
    },
    critico: {
      actions: [
        'Transparência gera alívio imediato',
        'Novo plano estratégico',
        'Metas realistas e escaláveis',
        'Decisão conjunta de continuidade',
      ],
      quickWins: [],
      deliverables: [],
    },
  },
  estrategia: {
    leve: {
      actions: [],
      quickWins: [],
      deliverables: [
        'Registro de hipóteses',
        'Resultados dos testes',
        'Estratégia otimizada',
      ],
    },
    moderado: {
      actions: [],
      quickWins: [],
      deliverables: [
        'Novo funil',
        'Proposta de valor revisada',
        'Roadmap estratégico',
      ],
    },
    critico: {
      actions: [
        'Desconstrução da estratégia atual + Identificação de falhas estruturais',
        'Alinhamento com liderança do cliente',
        'Criação de nova tese estratégica',
      ],
      quickWins: [],
      deliverables: [],
    },
  },
  valor_percebido: {
    leve: {
      actions: [],
      quickWins: [],
      deliverables: [
        'Relatório visual',
        'Comunicação educativa',
      ],
    },
    moderado: {
      actions: [],
      quickWins: [],
      deliverables: [
        'Relatórios estratégicos',
        'Conteúdos de valor',
        'Registro de decisões estratégicas',
      ],
    },
    critico: {
      actions: [],
      quickWins: [],
      deliverables: [
        'Relatórios estratégicos',
        'Conteúdos de valor',
        'Registro de decisões estratégicas',
      ],
    },
  },
};

// Hook to fetch action plans for a client
export function useClientActionPlans(clientId: string) {
  return useQuery({
    queryKey: ['cs-action-plans', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('cs_action_plans')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActionPlan[];
    },
    enabled: !!clientId,
    // Ensure fresh data when clientId changes
    staleTime: 0,
  });
}

// Hook to fetch tasks for an action plan
export function useActionPlanTasks(actionPlanId: string) {
  return useQuery({
    queryKey: ['cs-action-plan-tasks', actionPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_action_plan_tasks')
        .select('*')
        .eq('action_plan_id', actionPlanId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as ActionPlanTask[];
    },
    enabled: !!actionPlanId,
  });
}

// Hook to create action plan with tasks
export function useCreateActionPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      problemType: ProblemType;
      severity: Severity;
      indicators: string[];
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const dueDate = addDays(new Date(), SEVERITY_CONFIG[params.severity].days);
      
      // Create action plan
      const { data: plan, error: planError } = await supabase
        .from('cs_action_plans')
        .insert({
          client_id: params.clientId,
          problem_type: params.problemType,
          severity: params.severity,
          indicators: params.indicators,
          notes: params.notes || null,
          created_by: user.id,
          due_date: dueDate.toISOString(),
        })
        .select()
        .single();

      if (planError) throw planError;

      // Get predefined tasks
      const predefined = PREDEFINED_ACTIONS[params.problemType][params.severity];
      const tasks: Omit<ActionPlanTask, 'id' | 'created_at'>[] = [];
      let position = 0;

      // Add actions
      for (const action of predefined.actions) {
        tasks.push({
          action_plan_id: plan.id,
          title: action,
          description: null,
          task_type: 'action',
          is_completed: false,
          completed_at: null,
          completed_by: null,
          due_date: null,
          position: position++,
        });
      }

      // Add quick wins
      for (const qw of predefined.quickWins) {
        tasks.push({
          action_plan_id: plan.id,
          title: qw,
          description: null,
          task_type: 'quick_win',
          is_completed: false,
          completed_at: null,
          completed_by: null,
          due_date: null,
          position: position++,
        });
      }

      // Add deliverables
      for (const del of predefined.deliverables) {
        tasks.push({
          action_plan_id: plan.id,
          title: del,
          description: null,
          task_type: 'deliverable',
          is_completed: false,
          completed_at: null,
          completed_by: null,
          due_date: null,
          position: position++,
        });
      }

      // Insert tasks
      if (tasks.length > 0) {
        const { error: tasksError } = await supabase
          .from('cs_action_plan_tasks')
          .insert(tasks);

        if (tasksError) throw tasksError;
      }

      return plan as ActionPlan;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-plans', variables.clientId] });
      toast.success('Plano de ação criado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar plano de ação', { description: error.message });
    },
  });
}

// Hook to toggle task completion
export function useToggleActionPlanTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { taskId: string; actionPlanId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from('cs_action_plan_tasks')
        .update({
          is_completed: params.isCompleted,
          completed_at: params.isCompleted ? new Date().toISOString() : null,
          completed_by: params.isCompleted ? user?.id : null,
        })
        .eq('id', params.taskId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-plan-tasks', variables.actionPlanId] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar tarefa', { description: error.message });
    },
  });
}

// Hook to complete/cancel action plan
export function useUpdateActionPlanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { planId: string; clientId: string; status: 'completed' | 'cancelled' }) => {
      const { error } = await supabase
        .from('cs_action_plans')
        .update({
          status: params.status,
          completed_at: params.status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', params.planId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-plans', variables.clientId] });
      toast.success(variables.status === 'completed' ? 'Plano concluído!' : 'Plano cancelado');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar plano', { description: error.message });
    },
  });
}

// Hook to delete action plan
export function useDeleteActionPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { planId: string; clientId: string }) => {
      const { error } = await supabase
        .from('cs_action_plans')
        .delete()
        .eq('id', params.planId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-plans', variables.clientId] });
      toast.success('Plano excluído');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir plano', { description: error.message });
    },
  });
}

// Hook to fetch active action plans for multiple clients (for column display)
export function useActiveActionPlansByClients(clientIds: string[]) {
  return useQuery({
    queryKey: ['cs-active-action-plans-by-clients', clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return new Map<string, ActionPlan>();
      
      const { data, error } = await supabase
        .from('cs_action_plans')
        .select('*')
        .in('client_id', clientIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Return a map of client_id -> first active plan (most recent)
      const planMap = new Map<string, ActionPlan>();
      for (const plan of (data as ActionPlan[])) {
        if (!planMap.has(plan.client_id)) {
          planMap.set(plan.client_id, plan);
        }
      }
      return planMap;
    },
    enabled: clientIds.length > 0,
  });
}
