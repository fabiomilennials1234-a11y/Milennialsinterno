import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';

// Maps client label to CS classification
function getLabelClassification(label: ClientLabel): 'normal' | 'alerta' | 'critico' | null {
  if (label === 'medio') return 'alerta';
  if (label === 'ruim') return 'critico';
  return null; // No automatic change for 'otimo' or 'bom'
}

// Check if label should reset classification (when leaving médio/ruim)
function shouldResetClassification(newLabel: ClientLabel): boolean {
  return newLabel === 'otimo' || newLabel === 'bom';
}

export function useUpdateClientLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      label,
      previousLabel,
    }: {
      clientId: string;
      label: ClientLabel;
      previousLabel?: ClientLabel;
    }) => {
      const classification = getLabelClassification(label);
      
      // Build update object
      const updateData: { 
        client_label: ClientLabel; 
        cs_classification?: string; 
        cs_classification_reason?: string | null;
      } = { 
        client_label: label 
      };
      
      // If label triggers classification change (médio -> alerta, ruim -> critico)
      if (classification) {
        updateData.cs_classification = classification;
        updateData.cs_classification_reason = `Classificação automática: etiqueta alterada para "${label === 'medio' ? 'Médio' : 'Ruim'}"`;
      }
      // If setting to ótimo/bom, ALWAYS reset to normal (regardless of previous label)
      else if (shouldResetClassification(label)) {
        updateData.cs_classification = 'normal';
        updateData.cs_classification_reason = null;
      }

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);

      if (error) throw error;

      // Check if an action plan is required (label is medio/ruim and no active plan exists)
      let requiresActionPlan = false;
      if (label === 'medio' || label === 'ruim') {
        const { data: activePlans } = await supabase
          .from('cs_action_plans')
          .select('id')
          .eq('client_id', clientId)
          .eq('status', 'active')
          .limit(1);
        requiresActionPlan = !activePlans || activePlans.length === 0;
      }

      // Auto-complete all active plans when label improves to ótimo/bom
      let autoCompletedPlans = 0;
      if (shouldResetClassification(label)) {
        const { data: plansToComplete } = await supabase
          .from('cs_action_plans')
          .select('id')
          .eq('client_id', clientId)
          .eq('status', 'active');
        if (plansToComplete && plansToComplete.length > 0) {
          const { error: completeError } = await supabase
            .from('cs_action_plans')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .in('id', plansToComplete.map(p => p.id));
          if (!completeError) {
            autoCompletedPlans = plansToComplete.length;
            console.log(`[useUpdateClientLabel] Auto-completados ${autoCompletedPlans} plano(s) — Classificação melhorada para ${label === 'otimo' ? 'Ótimo' : 'Bom'}`);
          } else {
            console.error('[useUpdateClientLabel] Erro ao auto-completar planos:', completeError);
          }
        }
      }

      const wasReset = shouldResetClassification(label);
      return { classification, wasReset, requiresActionPlan, autoCompletedPlans };
    },
    onSuccess: (result) => {
      // Invalidate all queries that might contain client data
      queryClient.invalidateQueries({ queryKey: ['cs-clients-by-manager'] });
      queryClient.invalidateQueries({ queryKey: ['sucesso-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients-status'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-onboarding-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-acompanhamento-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-churn-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-clients'] });
      queryClient.invalidateQueries({ queryKey: ['gestor-projetos-clients'] });

      // Queries that embed client data via JOINs (won't update unless explicitly invalidated)
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });

      // Invalidate action plan queries for auto-completion and modal triggers
      queryClient.invalidateQueries({ queryKey: ['cs-action-plans'] });
      queryClient.invalidateQueries({ queryKey: ['cs-active-action-plans-by-clients'] });

      if (result.autoCompletedPlans > 0) {
        toast.info(`${result.autoCompletedPlans} plano(s) de ação concluído(s) automaticamente`, {
          description: 'Cliente melhorou de classificação',
        });
      }

      if (result.classification) {
        toast.success('Etiqueta atualizada', {
          description: `Cliente movido para ${result.classification === 'alerta' ? 'Clientes em Alerta' : 'Clientes Críticos'}`
        });
      } else if (result.wasReset) {
        toast.success('Etiqueta atualizada', {
          description: 'Cliente removido de Alerta/Crítico'
        });
      } else {
        toast.success('Etiqueta atualizada');
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar etiqueta', { description: error.message });
    },
  });
}
