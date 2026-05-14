import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  PADDOCK_STEPS,
  PADDOCK_STEP_LABELS,
  type PaddockStep,
} from './useComercialAutomation';
import {
  CRM_STEPS_BY_PRODUTO,
  CRM_STEP_LABEL,
  CRM_PHASES_BY_PRODUTO,
  CRM_PRODUTO_LABEL,
  type CrmProduto,
  type CrmPhase,
} from './useCrmKanban';
import {
  MKTPLACE_CONSULTORIA_STEPS,
  MKTPLACE_GESTAO_STEPS,
} from './useMktplaceKanban';

// ===================== TYPES =====================

export interface JourneyStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming' | 'skipped';
}

export interface JourneyPipeline {
  id: string;
  label: string;
  icon: string;
  color: string;
  steps: JourneyStep[];
  currentStepIndex: number;
  isCompleted: boolean;
  isActive: boolean;
  phases?: { label: string; stepCount: number; completedCount: number }[];
  currentPhaseIndex?: number;
}

/** Minimal shape the hook needs from clientInfo. Fields already loaded in the modal. */
export interface JourneyClientInfo {
  id: string;
  contracted_products?: string[] | null;
  torque_crm_products?: string[] | null;
  comercial_status?: string | null;
  paddock_onboarding_step?: string | null;
  mktplace_status?: string | null;
}

// ===================== ONBOARDING GROWTH MILESTONES =====================

const ONBOARDING_MILESTONES = [
  { id: 'milestone_1', label: 'Call #1' },
  { id: 'milestone_2', label: 'Estratégia PRO+' },
  { id: 'milestone_3', label: 'Criativos PRO+' },
  { id: 'milestone_4', label: 'Otimizações PRO+' },
  { id: 'milestone_5', label: 'Início (Publicação)' },
] as const;

// ===================== MKTPLACE STEP LABELS =====================

const CONSULTORIA_STEP_LABELS: Record<string, string> = {
  consultoria_marcada: 'Consultoria Marcada',
  material_preparado: 'Material Preparado',
  aula_ministrada: 'Aula Ministrada',
  material_enviado: 'Material Enviado',
};

const GESTAO_STEP_LABELS: Record<string, string> = {
  onboarding_marcado: 'Onboarding Marcado',
  material_preparado_gestao: 'Material Preparado',
  onboarding_realizado: 'Onboarding Realizado',
  acessos_pegados: 'Acessos MKT Place Pegados',
  operacao_auditada: 'Operação Auditada',
  iniciar_plano: 'Iniciar Plano de Ações',
};

// ===================== PURE BUILDERS =====================
// Exported for unit testing — no side effects, no hooks.

export function buildOnboardingPipeline(
  currentMilestone: number | null,
  completedAt: string | null,
): JourneyPipeline {
  const isCompleted = !!completedAt;
  const milestone = currentMilestone ?? 1;
  // currentStepIndex: 0-based. milestone 1 = index 0.
  // If completed, index = total steps (beyond last).
  const currentStepIndex = isCompleted ? ONBOARDING_MILESTONES.length : milestone - 1;

  const steps: JourneyStep[] = ONBOARDING_MILESTONES.map((m, i) => ({
    id: m.id,
    label: m.label,
    status: isCompleted || i < currentStepIndex
      ? 'completed'
      : i === currentStepIndex
        ? 'current'
        : 'upcoming',
  }));

  return {
    id: 'onboarding',
    label: 'Onboarding Growth',
    icon: 'Rocket',
    color: 'amber',
    steps,
    currentStepIndex,
    isCompleted,
    isActive: true,
  };
}

export function buildComercialPipeline(
  comercialStatus: string | null,
  paddockStep: string | null,
): JourneyPipeline | null {
  if (!comercialStatus) return null;

  // Pre-paddock status: novo → consultoria_marcada
  // Paddock: onboarding_paddock with paddock_onboarding_step
  // Post-paddock: em_acompanhamento
  const isAcompanhamento = comercialStatus === 'em_acompanhamento';
  const isPaddock = comercialStatus === 'onboarding_paddock';

  const steps: JourneyStep[] = PADDOCK_STEPS.map((stepId) => {
    const label = PADDOCK_STEP_LABELS[stepId];
    return { id: stepId, label, status: 'upcoming' as JourneyStep['status'] };
  });

  let currentStepIndex = -1;

  if (isAcompanhamento) {
    // All steps completed
    steps.forEach(s => { s.status = 'completed'; });
    currentStepIndex = steps.length;
  } else if (isPaddock && paddockStep) {
    const idx = PADDOCK_STEPS.indexOf(paddockStep as PaddockStep);
    if (idx >= 0) {
      currentStepIndex = idx;
      steps.forEach((s, i) => {
        if (i < idx) s.status = 'completed';
        else if (i === idx) s.status = 'current';
        // else stays 'upcoming'
      });
    }
  } else if (comercialStatus === 'novo') {
    // Not started paddock yet
    currentStepIndex = -1;
  } else if (comercialStatus === 'consultoria_marcada') {
    // Legacy pre-paddock — treat as step 0 current
    currentStepIndex = 0;
    steps[0].status = 'current';
  }

  return {
    id: 'comercial',
    label: 'Comercial / Paddock',
    icon: 'Handshake',
    color: 'rose',
    steps,
    currentStepIndex,
    isCompleted: isAcompanhamento,
    isActive: true,
  };
}

export function buildMktplacePipeline(
  mktplaceStatus: string | null,
  isGestao: boolean,
): JourneyPipeline | null {
  if (!mktplaceStatus) return null;

  const stepIds = isGestao
    ? [...MKTPLACE_GESTAO_STEPS]
    : [...MKTPLACE_CONSULTORIA_STEPS];
  const labels = isGestao ? GESTAO_STEP_LABELS : CONSULTORIA_STEP_LABELS;

  const isAcompanhamento =
    mktplaceStatus === 'acompanhamento_gestao' ||
    mktplaceStatus === 'acompanhamento_consultoria';

  const steps: JourneyStep[] = stepIds.map((stepId) => ({
    id: stepId,
    label: labels[stepId] || stepId,
    status: 'upcoming' as JourneyStep['status'],
  }));

  let currentStepIndex = -1;

  if (isAcompanhamento) {
    steps.forEach(s => { s.status = 'completed'; });
    currentStepIndex = steps.length;
  } else if (mktplaceStatus === 'novo') {
    currentStepIndex = -1;
  } else {
    const idx = stepIds.indexOf(mktplaceStatus as typeof stepIds[number]);
    if (idx >= 0) {
      currentStepIndex = idx;
      steps.forEach((s, i) => {
        if (i < idx) s.status = 'completed';
        else if (i === idx) s.status = 'current';
      });
    }
  }

  const pipelineId = isGestao ? 'mktplace-gestao' : 'mktplace-consultoria';
  const pipelineLabel = isGestao
    ? 'MKT Place — Gestão'
    : 'MKT Place — Consultoria';

  return {
    id: pipelineId,
    label: pipelineLabel,
    icon: 'Store',
    color: isGestao ? 'purple' : 'sky',
    steps,
    currentStepIndex,
    isCompleted: isAcompanhamento,
    isActive: true,
  };
}

export function buildCrmPipeline(
  produto: CrmProduto,
  currentStep: string | null,
  isFinalizado: boolean,
): JourneyPipeline {
  const stepIds = CRM_STEPS_BY_PRODUTO[produto];
  const phases = CRM_PHASES_BY_PRODUTO[produto];

  const stepIndex = currentStep
    ? stepIds.indexOf(currentStep)
    : 0;
  const effectiveIndex = isFinalizado ? stepIds.length : (stepIndex >= 0 ? stepIndex : 0);

  const steps: JourneyStep[] = stepIds.map((stepId, i) => ({
    id: stepId,
    label: CRM_STEP_LABEL[stepId] || stepId,
    status: isFinalizado || i < effectiveIndex
      ? 'completed'
      : i === effectiveIndex
        ? 'current'
        : 'upcoming',
  }));

  // Phase aggregation
  const phaseData = buildCrmPhases(phases, effectiveIndex, stepIds, isFinalizado);

  return {
    id: `crm-${produto}`,
    label: `Gestor CRM — ${CRM_PRODUTO_LABEL[produto]}`,
    icon: 'Settings',
    color: produto === 'v8' ? 'sky' : produto === 'automation' ? 'violet' : 'amber',
    steps,
    currentStepIndex: effectiveIndex,
    isCompleted: isFinalizado,
    isActive: true,
    phases: phaseData.phases,
    currentPhaseIndex: phaseData.currentPhaseIndex,
  };
}

export function buildCrmPhases(
  phaseDefs: CrmPhase[],
  currentStepGlobalIndex: number,
  allSteps: readonly string[],
  isFinalizado: boolean,
): { phases: { label: string; stepCount: number; completedCount: number }[]; currentPhaseIndex: number } {
  let currentPhaseIndex = -1;
  let cumulativeIdx = 0;

  const phases = phaseDefs.map((phase, pi) => {
    const stepCount = phase.steps.length;
    const completedCount = isFinalizado
      ? stepCount
      : phase.steps.filter((_, si) => cumulativeIdx + si < currentStepGlobalIndex).length;

    // Current phase = the phase containing the current step
    if (!isFinalizado && currentPhaseIndex === -1) {
      const phaseEnd = cumulativeIdx + stepCount;
      if (currentStepGlobalIndex < phaseEnd) {
        currentPhaseIndex = pi;
      }
    }

    cumulativeIdx += stepCount;
    return { label: phase.label, stepCount, completedCount };
  });

  if (isFinalizado) {
    currentPhaseIndex = phaseDefs.length; // beyond last
  }

  return { phases, currentPhaseIndex };
}

// ===================== MKTPLACE STATUS HELPERS =====================

const GESTAO_STATUSES = new Set<string>([
  ...MKTPLACE_GESTAO_STEPS,
  'acompanhamento_gestao',
]);

const CONSULTORIA_STATUSES = new Set<string>([
  ...MKTPLACE_CONSULTORIA_STEPS,
  'acompanhamento_consultoria',
]);

function determineMktplaceFlowType(
  mktplaceStatus: string,
): 'gestao' | 'consultoria' | null {
  if (GESTAO_STATUSES.has(mktplaceStatus)) return 'gestao';
  if (CONSULTORIA_STATUSES.has(mktplaceStatus)) return 'consultoria';
  // 'novo' — ambiguous, check contracted_products in caller
  return null;
}

// ===================== MAIN HOOK =====================

export function useClientJourneyMap(clientId: string, clientInfo: JourneyClientInfo | null) {
  // Query 1: client_onboarding (only if client has growth product)
  const hasGrowthProduct = clientInfo?.contracted_products?.some(
    p => p === 'millennials-growth' || p === 'millennials-paddock',
  ) ?? false;

  const onboardingQuery = useQuery({
    queryKey: ['client-journey-onboarding', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_onboarding')
        .select('current_milestone, completed_at')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && hasGrowthProduct,
  });

  // Query 2: crm_configuracoes (only if client has torque-crm)
  const hasTorqueCrm = clientInfo?.contracted_products?.includes('torque-crm') ?? false;

  const crmConfigQuery = useQuery({
    queryKey: ['client-journey-crm-configs', clientId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('crm_configuracoes')
        .select('id, produto, current_step, is_finalizado')
        .eq('client_id', clientId);
      if (error) throw error;
      return (data || []) as { id: string; produto: CrmProduto; current_step: string | null; is_finalizado: boolean }[];
    },
    enabled: !!clientId && hasTorqueCrm,
  });

  // Build pipelines from available data
  const pipelines: JourneyPipeline[] = [];

  // 1. Onboarding Growth
  if (hasGrowthProduct && onboardingQuery.data) {
    pipelines.push(
      buildOnboardingPipeline(
        onboardingQuery.data.current_milestone,
        onboardingQuery.data.completed_at,
      ),
    );
  }

  // 2. Comercial / Paddock
  const comercialStatus = clientInfo?.comercial_status ?? null;
  if (comercialStatus) {
    const paddockStep = clientInfo?.paddock_onboarding_step ?? null;
    const pipeline = buildComercialPipeline(comercialStatus, paddockStep);
    if (pipeline) pipelines.push(pipeline);
  }

  // 3. MKT Place
  const mktplaceStatus = clientInfo?.mktplace_status ?? null;
  if (mktplaceStatus) {
    const flowType = determineMktplaceFlowType(mktplaceStatus);
    const hasGestaoProduct = clientInfo?.contracted_products?.includes('gestor-mktplace') ?? false;

    if (flowType === 'gestao' || flowType === 'consultoria') {
      const pipeline = buildMktplacePipeline(mktplaceStatus, flowType === 'gestao');
      if (pipeline) pipelines.push(pipeline);
    } else if (mktplaceStatus === 'novo') {
      // Ambiguous 'novo' — determine from product
      const isGestao = hasGestaoProduct;
      const pipeline = buildMktplacePipeline(mktplaceStatus, isGestao);
      if (pipeline) pipelines.push(pipeline);
    }
  }

  // 4. CRM (one pipeline per product config)
  if (hasTorqueCrm && crmConfigQuery.data) {
    for (const config of crmConfigQuery.data) {
      pipelines.push(
        buildCrmPipeline(config.produto, config.current_step, config.is_finalizado),
      );
    }
  }

  const isLoading = onboardingQuery.isLoading || crmConfigQuery.isLoading;

  return {
    pipelines,
    isLoading,
  };
}
