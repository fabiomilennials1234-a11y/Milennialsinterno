import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProductChurn {
  id: string;
  client_id: string;
  product_slug: string;
  product_name: string;
  monthly_value: number | null;
  distrato_step: string;
  distrato_entered_at: string;
  had_valid_contract: boolean | null;
  initiated_by: string | null;
  initiated_by_name: string | null;
  exit_reason: string | null;
  exit_satisfaction_score: number | null;
  archived: boolean;
  archived_at: string | null;
  client?: {
    id: string;
    name: string;
    razao_social: string | null;
  };
}

// Steps for the distrato workflow
export const PRODUCT_DISTRATO_STEPS = {
  // === FLUXO COM CONTRATO (4 etapas) ===
  CHURN_SOLICITADO: 'churn_solicitado',
  COBRANCA_RETIRADA: 'cobranca_retirada',
  DISTRATO_ENVIADO: 'distrato_enviado',
  DISTRATO_ASSINADO: 'distrato_assinado',
  // === FLUXO SEM CONTRATO (2 etapas) ===
  SEM_CONTRATO_SOLICITADO: 'sem_contrato_solicitado',
  SEM_CONTRATO_EFETIVADO: 'sem_contrato_efetivado',
} as const;

export type ProductDistratoStep = typeof PRODUCT_DISTRATO_STEPS[keyof typeof PRODUCT_DISTRATO_STEPS];

/**
 * Hook to manage product-specific churn workflow
 * This allows a client to churn from ONE product while staying active in others
 */
export function useProductChurn(productSlug?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch churns for a specific product
  const { data: productChurns = [], isLoading } = useQuery({
    queryKey: ['product-churns', productSlug],
    queryFn: async (): Promise<ProductChurn[]> => {
      let query = supabase
        .from('client_product_churns')
        .select(`
          *,
          client:clients(id, name, razao_social)
        `)
        .eq('archived', false)
        .order('distrato_entered_at', { ascending: false });

      if (productSlug) {
        query = query.eq('product_slug', productSlug);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductChurn[];
    },
    enabled: true,
  });

  // Initiate churn for a specific product (creates record in client_product_churns)
  // ALSO updates the client's status to 'churned' and distrato_step to maintain kanban compatibility
  const initiateProductChurn = useMutation({
    mutationFn: async ({
      clientId,
      productSlug,
      productName,
      monthlyValue,
      hasValidContract,
    }: {
      clientId: string;
      productSlug: string;
      productName: string;
      monthlyValue: number;
      hasValidContract: boolean;
    }) => {
      const distratoStep = hasValidContract
        ? PRODUCT_DISTRATO_STEPS.CHURN_SOLICITADO
        : PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_SOLICITADO;

      // Create churn record for this product
      const { data: churnRecord, error: churnError } = await supabase
        .from('client_product_churns')
        .insert({
          client_id: clientId,
          product_slug: productSlug,
          product_name: productName,
          monthly_value: monthlyValue,
          distrato_step: distratoStep,
          had_valid_contract: hasValidContract,
          initiated_by: user?.id,
          initiated_by_name: user?.name || 'Sistema',
        })
        .select()
        .single();

      if (churnError) throw churnError;

      // Get client name for notification
      const { data: client } = await supabase
        .from('clients')
        .select('name, status, distrato_step')
        .eq('id', clientId)
        .single();

      // IMPORTANT: Also update the client's status and distrato_step in the clients table
      // This maintains compatibility with existing kanban automations that filter by status === 'churned'
      // Only update if client is not already in a churn state
      if (client && client.status !== 'churned') {
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            status: 'churned',
            distrato_step: distratoStep,
            distrato_entered_at: new Date().toISOString(),
          })
          .eq('id', clientId);

        if (updateError) {
          console.error('Error updating client status:', updateError);
        }
      }

      // Remove from active clients if exists (for financeiro kanban)
      await supabase
        .from('financeiro_active_clients')
        .delete()
        .eq('client_id', clientId);

      // Create churn notification with product info
      await supabase
        .from('churn_notifications')
        .insert({
          client_id: clientId,
          client_name: `${client?.name || 'Cliente'} - ${productName}`,
        } as any);

      return { churnRecord, hasValidContract, productName };
    },
    onSuccess: ({ hasValidContract, productName }) => {
      // Invalidate product churn queries
      queryClient.invalidateQueries({ queryKey: ['product-churns'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['churn-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      
      // Invalidate kanban queries to show client in churn sections
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-churn-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      queryClient.invalidateQueries({ queryKey: ['sucesso-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });

      const workflowMessage = hasValidContract
        ? 'Fluxo de 4 etapas (com contrato)'
        : 'Fluxo de 2 etapas (sem contrato)';

      toast.success(`Churn iniciado para ${productName}`, {
        description: workflowMessage,
      });
    },
    onError: (error: any) => {
      console.error('Error initiating product churn:', error);
      toast.error('Erro ao iniciar churn', {
        description: error.message,
      });
    },
  });

  // Advance to next step in the churn workflow
  const advanceStep = useMutation({
    mutationFn: async ({
      churnId,
      currentStep,
    }: {
      churnId: string;
      currentStep: ProductDistratoStep;
    }) => {
      let nextStep: ProductDistratoStep | null = null;

      switch (currentStep) {
        // === FLUXO COM CONTRATO ===
        case PRODUCT_DISTRATO_STEPS.CHURN_SOLICITADO:
          nextStep = PRODUCT_DISTRATO_STEPS.COBRANCA_RETIRADA;
          break;
        case PRODUCT_DISTRATO_STEPS.COBRANCA_RETIRADA:
          nextStep = PRODUCT_DISTRATO_STEPS.DISTRATO_ENVIADO;
          break;
        case PRODUCT_DISTRATO_STEPS.DISTRATO_ENVIADO:
          nextStep = PRODUCT_DISTRATO_STEPS.DISTRATO_ASSINADO;
          break;
        case PRODUCT_DISTRATO_STEPS.DISTRATO_ASSINADO:
          return null; // Final step, use finalizeChurn instead

        // === FLUXO SEM CONTRATO ===
        case PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_SOLICITADO:
          nextStep = PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO;
          break;
        case PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO:
          return null; // Final step, use finalizeChurn instead

        default:
          throw new Error('Invalid step');
      }

      const { error } = await supabase
        .from('client_product_churns')
        .update({ distrato_step: nextStep })
        .eq('id', churnId);

      if (error) throw error;
      return nextStep;
    },
    onSuccess: (nextStep) => {
      queryClient.invalidateQueries({ queryKey: ['product-churns'] });
      if (!nextStep) return;

      const stepLabels: Record<string, string> = {
        [PRODUCT_DISTRATO_STEPS.COBRANCA_RETIRADA]: 'Cobrança retirada',
        [PRODUCT_DISTRATO_STEPS.DISTRATO_ENVIADO]: 'Distrato enviado',
        [PRODUCT_DISTRATO_STEPS.DISTRATO_ASSINADO]: 'Distrato assinado',
        [PRODUCT_DISTRATO_STEPS.SEM_CONTRATO_EFETIVADO]: 'Churn efetivado',
      };
      toast.success(`Avançado para: ${stepLabels[nextStep] || nextStep}`);
    },
    onError: (error) => {
      console.error('Error advancing step:', error);
      toast.error('Erro ao avançar etapa');
    },
  });

  // Finalize churn - archives the churn record and removes product from client
  const finalizeChurn = useMutation({
    mutationFn: async ({ churnId }: { churnId: string }) => {
      // Get churn details
      const { data: churn, error: fetchError } = await supabase
        .from('client_product_churns')
        .select('client_id, product_slug')
        .eq('id', churnId)
        .single();

      if (fetchError) throw fetchError;

      // Archive the churn record
      const { error: archiveError } = await supabase
        .from('client_product_churns')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq('id', churnId);

      if (archiveError) throw archiveError;

      // Remove product from client's contracted_products
      const { data: client } = await supabase
        .from('clients')
        .select('contracted_products')
        .eq('id', churn.client_id)
        .single();

      const currentProducts = client?.contracted_products || [];
      const updatedProducts = currentProducts.filter(
        (p: string) => p !== churn.product_slug
      );

      // Update client's contracted_products
      const { error: updateError } = await supabase
        .from('clients')
        .update({ contracted_products: updatedProducts })
        .eq('id', churn.client_id);

      if (updateError) throw updateError;

      // Remove product value
      await supabase
        .from('client_product_values')
        .delete()
        .eq('client_id', churn.client_id)
        .eq('product_slug', churn.product_slug);

      // If no products left, archive the client entirely
      if (updatedProducts.length === 0) {
        await supabase
          .from('clients')
          .update({
            archived: true,
            archived_at: new Date().toISOString(),
            status: 'churned',
          })
          .eq('id', churn.client_id);

        // Also remove from active clients
        await supabase
          .from('financeiro_active_clients')
          .delete()
          .eq('client_id', churn.client_id);
      }

      return { remainingProducts: updatedProducts.length };
    },
    onSuccess: ({ remainingProducts }) => {
      queryClient.invalidateQueries({ queryKey: ['product-churns'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });

      if (remainingProducts === 0) {
        toast.success('Churn finalizado - Cliente arquivado', {
          description: 'Cliente não possui mais produtos ativos.',
        });
      } else {
        toast.success('Produto removido do cliente', {
          description: `Cliente permanece ativo com ${remainingProducts} produto(s).`,
        });
      }
    },
    onError: (error) => {
      console.error('Error finalizing churn:', error);
      toast.error('Erro ao finalizar churn');
    },
  });

  // Get churns by step
  const getChurnsByStep = (step: ProductDistratoStep) => {
    return productChurns.filter((c) => c.distrato_step === step);
  };

  // Get days since churn started
  const getDaysSinceChurn = (enteredAt: string | null) => {
    if (!enteredAt) return 0;
    const entered = new Date(enteredAt);
    const now = new Date();
    return Math.floor(
      (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  return {
    productChurns,
    isLoading,
    initiateProductChurn,
    advanceStep,
    finalizeChurn,
    getChurnsByStep,
    getDaysSinceChurn,
  };
}
