import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CrmProduto } from './useCrmKanban';

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
        .select('id, produto, current_step, checklist_state, field_values, step_entered_at, blocked_until, activation_at, training_at, reset_count, is_finalizado')
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

    // Blocked until
    if (configState.blocked_until && new Date(configState.blocked_until) > new Date()) {
      const dt = new Date(configState.blocked_until);
      blockers.push(
        `Bloqueado ate ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      );
    }
  }

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

      if (result?.finalized) {
        toast.success('CRM finalizado!');
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

  return {
    currentValidation,
    configState,
    configLoading,
    validations,
    blockers,
    canAdvance,
    toggleChecklist,
    saveField,
    advanceStep,
  };
}
