import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CrmProduto } from './useCrmKanban';
import { isGrowthClient, callGrowthOnCrmFinalizado } from './useGrowthCrossKanban';

// =============================================================
// Hook: useCrmStepValidation
//
// Loads step validation definitions + config state.
// Exposes: canAdvance, blockers, toggleChecklist, saveField, advanceStep
// =============================================================

export interface StepValidation {
  id: string;
  produto: string;
  step_key: string;
  step_index: number;
  step_label: string;
  checklist_items: string[] | null;
  required_fields: RequiredField[] | null;
  deadline_days: number | null;
  trigger_delay_days: number | null;
  trigger_event: string | null;
  has_reset_loop: boolean;
  marks_timestamp: string | null;
  task_title_template: string;
}

export interface RequiredField {
  key: string;
  type: 'datetime' | 'text' | 'boolean' | 'url';
  label: string;
}

export interface CrmConfigState {
  id: string;
  client_id: string;
  produto: CrmProduto;
  current_step: string;
  checklist_state: Record<string, boolean>;
  field_values: Record<string, string>;
  step_entered_at: string | null;
  blocked_until: string | null;
  activation_at: string | null;
  training_at: string | null;
  reset_count: number;
  is_finalizado: boolean;
  delay_justification: string | null;
  delay_justified_at: string | null;
  delay_justification_category: string | null;
}

/**
 * Load all step validation definitions for a product.
 * Cached aggressively — definitions rarely change.
 */
export function useStepValidations(produto: CrmProduto | undefined) {
  return useQuery({
    queryKey: ['crm-step-validations', produto],
    queryFn: async () => {
      if (!produto) return [];
      const { data, error } = await (supabase as any)
        .from('crm_step_validations')
        .select('*')
        .eq('produto', produto)
        .order('step_index', { ascending: true });
      if (error) throw error;
      return (data || []) as StepValidation[];
    },
    enabled: !!produto,
    staleTime: 10 * 60 * 1000, // 10min — definitions are quasi-static
  });
}

/**
 * Load a single config's validation state (checklist, fields, blocked_until).
 */
export function useCrmConfigState(configId: string | undefined) {
  return useQuery({
    queryKey: ['crm-config-state', configId],
    queryFn: async () => {
      if (!configId) return null;
      const { data, error } = await (supabase as any)
        .from('crm_configuracoes')
        .select('id, client_id, produto, current_step, checklist_state, field_values, step_entered_at, blocked_until, activation_at, training_at, reset_count, is_finalizado, delay_justification, delay_justified_at, delay_justification_category')
        .eq('id', configId)
        .single();
      if (error) throw error;
      return data as CrmConfigState;
    },
    enabled: !!configId,
  });
}

/**
 * Core validation hook for a single CRM config.
 * Computes canAdvance + blockers client-side for instant UI feedback.
 * Advance still goes through server RPC for safety.
 */
export function useCrmStepValidation(configId: string | undefined, produto: CrmProduto | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: validations = [] } = useStepValidations(produto);
  const { data: configState, isLoading: configLoading } = useCrmConfigState(configId);

  // Find current step's validation
  const currentValidation = validations.find(
    v => v.step_key === configState?.current_step
  ) || null;

  // Compute blockers client-side
  const blockers: string[] = [];

  if (currentValidation && configState) {
    // Checklist
    if (currentValidation.checklist_items?.length) {
      for (const item of currentValidation.checklist_items) {
        if (!configState.checklist_state[item]) {
          blockers.push(`Checklist pendente: ${item}`);
        }
      }
    }

    // Required fields
    if (currentValidation.required_fields?.length) {
      for (const field of currentValidation.required_fields) {
        const val = configState.field_values[field.key];
        if (!val || val.trim() === '') {
          blockers.push(`Campo obrigatorio: ${field.label}`);
        }
      }
    }

    // Blocked until (D+N temporal gate)
    if (configState.blocked_until && new Date(configState.blocked_until) > new Date()) {
      const dt = new Date(configState.blocked_until);
      blockers.push(
        `Bloqueado ate ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      );
    }

    // Deadline overdue: step_entered_at + deadline_days < now → require justification
    if (
      currentValidation.deadline_days &&
      configState.step_entered_at
    ) {
      const entered = new Date(configState.step_entered_at).getTime();
      const deadlineMs = entered + currentValidation.deadline_days * 24 * 60 * 60 * 1000;
      if (Date.now() > deadlineMs) {
        if (!configState.delay_justification || configState.delay_justification.trim() === '') {
          blockers.push('Etapa estourada: justifique o atraso antes de avancar');
        }
      }
    }
  }

  // Compute step deadline status for UI badge
  const stepDeadlineStatus = (() => {
    if (!currentValidation?.deadline_days || !configState?.step_entered_at) {
      return { status: 'none' as const, remainingMs: 0, totalMs: 0 };
    }
    const entered = new Date(configState.step_entered_at).getTime();
    const totalMs = currentValidation.deadline_days * 24 * 60 * 60 * 1000;
    const deadlineMs = entered + totalMs;
    const remainingMs = deadlineMs - Date.now();
    const ratio = remainingMs / totalMs;

    if (remainingMs <= 0) return { status: 'overdue' as const, remainingMs, totalMs };
    if (ratio <= 0.25) return { status: 'critical' as const, remainingMs, totalMs };
    if (ratio <= 0.50) return { status: 'warning' as const, remainingMs, totalMs };
    return { status: 'ok' as const, remainingMs, totalMs };
  })();

  const isOverdue = stepDeadlineStatus.status === 'overdue';

  const canAdvance = blockers.length === 0 && !!configState && !configState.is_finalizado;

  // --- Mutations ---

  const toggleChecklist = useMutation({
    mutationFn: async ({ item, checked }: { item: string; checked: boolean }) => {
      if (!configId || !configState) throw new Error('Config not loaded');
      const newState = { ...configState.checklist_state, [item]: checked };

      const { error } = await (supabase as any)
        .from('crm_configuracoes')
        .update({ checklist_state: newState, updated_at: new Date().toISOString() })
        .eq('id', configId);
      if (error) throw error;

      // Log
      await (supabase as any).from('crm_validation_log').insert({
        config_id: configId,
        step_key: configState.current_step,
        action: 'checklist_toggle',
        details: { item, checked },
        performed_by: user?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-config-state', configId] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar checklist', { description: err.message });
    },
  });

  const saveField = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!configId || !configState) throw new Error('Config not loaded');
      const newFields = { ...configState.field_values, [key]: value };

      const { error } = await (supabase as any)
        .from('crm_configuracoes')
        .update({ field_values: newFields, updated_at: new Date().toISOString() })
        .eq('id', configId);
      if (error) throw error;

      // Log
      await (supabase as any).from('crm_validation_log').insert({
        config_id: configId,
        step_key: configState.current_step,
        action: 'field_save',
        details: { key, value },
        performed_by: user?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-config-state', configId] });
    },
  });

  const advanceStep = useMutation({
    mutationFn: async () => {
      if (!configId) throw new Error('Config not loaded');

      const { data, error } = await (supabase as any).rpc('advance_crm_step', {
        _config_id: configId,
        _performed_by: user?.id || null,
      });
      if (error) throw error;
      return data as { allowed: boolean; finalized?: boolean; next_step?: string; blockers?: string[] };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-config-state', configId] });
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['crm-configs-for-client'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });

      if (result?.finalized) {
        toast.success('CRM finalizado!');

        // Growth cross-kanban: dismiss "Esperar TORQUE%" tags when CRM finalizes
        if (configState?.client_id) {
          (async () => {
            const { data: client } = await supabase
              .from('clients')
              .select('contracted_products')
              .eq('id', configState.client_id)
              .single();
            if (client && isGrowthClient(client as { contracted_products?: string[] | null })) {
              await callGrowthOnCrmFinalizado(configState.client_id);
              queryClient.invalidateQueries({ queryKey: ['client-tags'] });
              queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });
            }
          })();
        }
      } else if (result?.allowed) {
        toast.success('Etapa concluida!');
      } else if (result?.blockers) {
        toast.error('Nao foi possivel avancar', {
          description: (result.blockers as string[]).join(', '),
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Erro ao avancar etapa', { description: err.message });
    },
  });

  const saveDelayJustification = useMutation({
    mutationFn: async ({ justification, category }: { justification: string; category?: string }) => {
      if (!configId || !configState) throw new Error('Config not loaded');
      if (!justification.trim()) throw new Error('Justificativa obrigatoria');

      const { error } = await (supabase as any)
        .from('crm_configuracoes')
        .update({
          delay_justification: justification,
          delay_justified_at: new Date().toISOString(),
          delay_justification_category: category || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId);
      if (error) throw error;

      // Log
      await (supabase as any).from('crm_validation_log').insert({
        config_id: configId,
        step_key: configState.current_step,
        action: 'delay_justification',
        details: { justification, category: category || null },
        performed_by: user?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-config-state', configId] });
      toast.success('Justificativa salva');
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar justificativa', { description: err.message });
    },
  });

  const resetStep = useMutation({
    mutationFn: async ({ reason, newDate, failedItems }: { reason: string; newDate?: string; failedItems?: string[] }) => {
      if (!configId) throw new Error('Config not loaded');

      const { data, error } = await (supabase as any).rpc('reset_crm_step', {
        _config_id: configId,
        _reason: reason,
        _new_date: newDate || null,
        _performed_by: user?.id || null,
        _failed_items: failedItems && failedItems.length > 0 ? JSON.stringify(failedItems) : null,
      });
      if (error) throw error;
      return data as { success: boolean; reset_count?: number; error?: string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-config-state', configId] });
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });

      if (result?.success) {
        toast.success(`Etapa resetada (reset #${result.reset_count})`);
      } else {
        toast.error(result?.error || 'Erro ao resetar etapa');
      }
    },
    onError: (err: Error) => {
      toast.error('Erro ao resetar etapa', { description: err.message });
    },
  });

  return {
    currentValidation,
    configState,
    configLoading,
    validations,
    blockers,
    canAdvance,
    stepDeadlineStatus,
    isOverdue,
    toggleChecklist,
    saveField,
    advanceStep,
    saveDelayJustification,
    resetStep,
  };
}
