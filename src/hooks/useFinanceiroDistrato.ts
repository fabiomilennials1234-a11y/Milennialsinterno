import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DistratoClient {
  id: string;
  name: string;
  razao_social: string | null;
  distrato_step: string | null;
  distrato_entered_at: string | null;
  created_at: string;
  archived: boolean;
}

// Steps for the distrato workflow
// === FLUXO COM CONTRATO ===
export const DISTRATO_STEPS = {
  CHURN_SOLICITADO: 'churn_solicitado',
  COBRANCA_RETIRADA: 'cobranca_retirada',
  DISTRATO_ENVIADO: 'distrato_enviado',
  DISTRATO_ASSINADO: 'distrato_assinado',
  // === FLUXO SEM CONTRATO ===
  SEM_CONTRATO_SOLICITADO: 'sem_contrato_solicitado',
  SEM_CONTRATO_EFETIVADO: 'sem_contrato_efetivado',
} as const;

export type DistratoStep = typeof DISTRATO_STEPS[keyof typeof DISTRATO_STEPS];

export function useFinanceiroDistrato() {
  const queryClient = useQueryClient();

  // Fetch clients in distrato workflow
  const { data: distratoClients = [], isLoading } = useQuery({
    queryKey: ['financeiro-distrato-clients'],
    queryFn: async (): Promise<DistratoClient[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, distrato_step, distrato_entered_at, created_at, archived')
        .not('distrato_step', 'is', null)
        .eq('archived', false) // Only show non-archived clients in distrato workflow
        .order('distrato_entered_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DistratoClient[];
    },
  });

  // Move client to distrato (called when churn is triggered)
  const moveToDistrato = useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          distrato_step: DISTRATO_STEPS.CHURN_SOLICITADO,
          distrato_entered_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      toast.success('Cliente movido para distrato');
    },
    onError: (error) => {
      console.error('Error moving to distrato:', error);
      toast.error('Erro ao mover cliente para distrato');
    },
  });

  // Advance client to next step
  const advanceStep = useMutation({
    mutationFn: async ({ clientId, currentStep }: { clientId: string; currentStep: DistratoStep }) => {
      let nextStep: DistratoStep | null = null;

      switch (currentStep) {
        // === FLUXO COM CONTRATO ===
        case DISTRATO_STEPS.CHURN_SOLICITADO:
          nextStep = DISTRATO_STEPS.COBRANCA_RETIRADA;
          break;
        case DISTRATO_STEPS.COBRANCA_RETIRADA:
          nextStep = DISTRATO_STEPS.DISTRATO_ENVIADO;
          break;
        case DISTRATO_STEPS.DISTRATO_ENVIADO:
          nextStep = DISTRATO_STEPS.DISTRATO_ASSINADO;
          break;
        case DISTRATO_STEPS.DISTRATO_ASSINADO:
          // Fim do fluxo COM contrato - não avança, só arquiva
          return null;

        // === FLUXO SEM CONTRATO ===
        case DISTRATO_STEPS.SEM_CONTRATO_SOLICITADO:
          nextStep = DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO;
          break;
        case DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO:
          // Fim do fluxo SEM contrato - não avança, só arquiva
          return null;

        default:
          throw new Error('Invalid step');
      }

      const { error } = await supabase
        .from('clients')
        .update({ distrato_step: nextStep })
        .eq('id', clientId);

      if (error) throw error;
      return nextStep;
    },
    onSuccess: (nextStep) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      if (!nextStep) return; // Etapa final, não mostra toast de avanço
      
      const stepLabels: Record<string, string> = {
        // Com contrato
        [DISTRATO_STEPS.COBRANCA_RETIRADA]: 'Cobrança retirada',
        [DISTRATO_STEPS.DISTRATO_ENVIADO]: 'Distrato enviado',
        [DISTRATO_STEPS.DISTRATO_ASSINADO]: 'Distrato assinado',
        // Sem contrato
        [DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO]: 'Churn efetivado',
      };
      toast.success(`Cliente movido para: ${stepLabels[nextStep] || nextStep}`);
    },
    onError: (error) => {
      console.error('Error advancing step:', error);
      toast.error('Erro ao avançar etapa');
    },
  });

  // Finalize churn (archive client completely)
  const finalizeChurn = useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      // Remove from active clients if exists
      await supabase
        .from('financeiro_active_clients')
        .delete()
        .eq('client_id', clientId);

      // Archive client
      const { error } = await supabase
        .from('clients')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          status: 'churned',
        })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente arquivado com sucesso');
    },
    onError: (error) => {
      console.error('Error finalizing churn:', error);
      toast.error('Erro ao finalizar churn');
    },
  });

  // Get clients by step
  const getClientsByStep = (step: DistratoStep) => {
    return distratoClients.filter(c => c.distrato_step === step);
  };

  // Get days since distrato started
  const getDaysSinceDistrato = (distratoEnteredAt: string | null) => {
    if (!distratoEnteredAt) return 0;
    const entered = new Date(distratoEnteredAt);
    const now = new Date();
    return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
  };

  return {
    distratoClients,
    isLoading,
    moveToDistrato,
    advanceStep,
    finalizeChurn,
    getClientsByStep,
    getDaysSinceDistrato,
  };
}
