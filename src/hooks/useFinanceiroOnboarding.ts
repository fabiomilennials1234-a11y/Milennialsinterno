import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper function to activate client-product when contract is signed
async function activateClientIfNeeded(
  clientId: string,
  productSlug: string,
  productName: string,
  monthlyValue: number,
  contractExpiresAt?: string
) {
  // Check if already active for this product
  const { data: existing } = await supabase
    .from('financeiro_active_clients')
    .select('id')
    .eq('client_id', clientId)
    .eq('product_slug', productSlug)
    .maybeSingle();

  if (existing) {
    // Update contract expiration if already exists
    if (contractExpiresAt) {
      await supabase
        .from('financeiro_active_clients')
        .update({ contract_expires_at: contractExpiresAt })
        .eq('client_id', clientId)
        .eq('product_slug', productSlug);
    }
    return;
  }

  // Add to active clients
  await supabase
    .from('financeiro_active_clients')
    .insert({
      client_id: clientId,
      product_slug: productSlug,
      product_name: productName,
      monthly_value: monthlyValue || 0,
      invoice_status: 'em_dia',
      contract_expires_at: contractExpiresAt || null,
    });
}

export interface FinanceiroOnboarding {
  id: string;
  client_id: string;
  current_step: string;
  product_slug: string;
  product_name: string;
  step_cadastro_asaas_at: string | null;
  step_contrato_juridico_at: string | null;
  step_contrato_enviado_at: string | null;
  step_esperando_assinatura_at: string | null;
  step_contrato_assinado_at: string | null;
  contract_expiration_date: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    razao_social: string | null;
    expected_investment: number | null;
    monthly_value: number | null;
    created_at: string;
    contracted_products: string[] | null;
  };
}

// Define Marcos structure as per the Trello reference
export const MARCOS = [
  {
    id: 'marco1',
    title: '[Marco 1]',
    maxDays: 3,
    steps: [
      { id: 'cadastro_asaas', label: '[1] Cadastro no Asaas + 1ª cobrança enviada' },
      { id: 'contrato_enviado', label: '[2] Contrato enviado' },
    ],
  },
  {
    id: 'marco2',
    title: '[Marco 2] Otimizações PRO+',
    maxDays: 10,
    steps: [
      { id: 'esperando_assinatura', label: '[1] Esperando assinatura' },
      { id: 'contrato_assinado', label: '[2] Contrato assinado' },
    ],
  },
] as const;

// All steps in order
export const ALL_STEPS = [
  'novo_cliente',
  'cadastro_asaas',
  'contrato_enviado',
  'esperando_assinatura',
  'contrato_assinado',
] as const;

export type ContractStep = typeof ALL_STEPS[number];

// Get Marco that contains a step
export function getMarcoForStep(stepId: string) {
  for (const marco of MARCOS) {
    if (marco.steps.some(s => s.id === stepId)) {
      return marco;
    }
  }
  return null;
}

// Get step label
export function getStepLabel(stepId: string): string {
  for (const marco of MARCOS) {
    const step = marco.steps.find(s => s.id === stepId);
    if (step) return step.label;
  }
  if (stepId === 'novo_cliente') return 'Novo Cliente';
  return stepId;
}

export function useFinanceiroOnboarding() {
  const queryClient = useQueryClient();

  // Fetch all onboarding records with client data
  const { data: onboardingRecords = [], isLoading } = useQuery({
    queryKey: ['financeiro-onboarding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_client_onboarding')
        .select(`
          *,
          client:clients(id, name, razao_social, expected_investment, monthly_value, created_at, archived, contracted_products)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out archived clients
      return (data || []).filter((record: any) => record.client && !record.client.archived) as FinanceiroOnboarding[];
    },
  });

  // Move client-product to a specific step
  const moveToStep = useMutation({
    mutationFn: async ({ clientId, productSlug, targetStep, expectedInvestment, contractExpiresAt }: {
      clientId: string;
      productSlug: string;
      targetStep: ContractStep;
      expectedInvestment?: number | null;
      contractExpiresAt?: string;
    }) => {
      const now = new Date().toISOString();
      const updateData: Record<string, any> = {
        current_step: targetStep,
        updated_at: now,
      };

      // Registrar timestamp de assinatura do contrato
      if (targetStep === 'contrato_assinado') {
        updateData.step_contrato_assinado_at = now;
      }

      const { error } = await supabase
        .from('financeiro_client_onboarding')
        .update(updateData)
        .eq('client_id', clientId)
        .eq('product_slug', productSlug);

      if (error) throw error;

      // If moving to contrato_assinado, activate client-product
      if (targetStep === 'contrato_assinado') {
        // Get product name from onboarding record
        const record = onboardingRecords.find(r => r.client_id === clientId && r.product_slug === productSlug);
        const productName = record?.product_name || productSlug;
        await activateClientIfNeeded(clientId, productSlug, productName, expectedInvestment || 0, contractExpiresAt);
      }

      return targetStep;
    },
    onSuccess: (targetStep) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      toast.success(`Cliente movido para: ${getStepLabel(targetStep)}`);
    },
    onError: (error) => {
      toast.error('Erro ao mover cliente: ' + (error as Error).message);
    },
  });

  // Move to next step
  const moveToNextStep = useMutation({
    mutationFn: async ({ clientId, productSlug, currentStep, expectedInvestment, contractExpiresAt }: {
      clientId: string;
      productSlug: string;
      currentStep: string;
      expectedInvestment?: number | null;
      contractExpiresAt?: string;
    }) => {
      const currentIndex = ALL_STEPS.indexOf(currentStep as ContractStep);
      if (currentIndex === -1 || currentIndex >= ALL_STEPS.length - 1) {
        throw new Error('Já está na última etapa');
      }

      const nextStep = ALL_STEPS[currentIndex + 1];

      const now = new Date().toISOString();
      const updateData: Record<string, any> = {
        current_step: nextStep,
        updated_at: now,
      };

      // Registrar timestamp de assinatura do contrato
      if (nextStep === 'contrato_assinado') {
        updateData.step_contrato_assinado_at = now;
      }

      const { error } = await supabase
        .from('financeiro_client_onboarding')
        .update(updateData)
        .eq('client_id', clientId)
        .eq('product_slug', productSlug);

      if (error) throw error;

      // If moving to contrato_assinado, activate client-product with contract expiration
      if (nextStep === 'contrato_assinado') {
        const record = onboardingRecords.find(r => r.client_id === clientId && r.product_slug === productSlug);
        const productName = record?.product_name || productSlug;
        await activateClientIfNeeded(clientId, productSlug, productName, expectedInvestment || 0, contractExpiresAt);
      }

      return nextStep;
    },
    onSuccess: (nextStep) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      toast.success(`Cliente avançou para: ${getStepLabel(nextStep)}`);
    },
    onError: (error) => {
      toast.error('Erro ao avançar cliente: ' + (error as Error).message);
    },
  });

  // Get records by step (returns per-product records)
  const getClientsByStep = (step: ContractStep) => {
    return onboardingRecords.filter(record => record.current_step === step);
  };

  // Get clients for a Marco (all steps within that marco)
  const getClientsByMarco = (marcoId: string) => {
    const marco = MARCOS.find(m => m.id === marcoId);
    if (!marco) return [];
    const stepIds = marco.steps.map(s => s.id);
    return onboardingRecords.filter(record => stepIds.includes(record.current_step as any));
  };

  // Calculate days since created
  const getDaysSinceCreated = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return {
    onboardingRecords,
    isLoading,
    moveToStep,
    moveToNextStep,
    getClientsByStep,
    getClientsByMarco,
    getDaysSinceCreated,
  };
}
