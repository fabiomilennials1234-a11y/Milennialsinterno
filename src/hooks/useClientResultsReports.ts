import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ResultsReport {
  id: string;
  client_id: string;
  created_by: string;
  actions_last_30_days: string | null;
  achievements: string | null;
  traffic_results: string | null;
  key_metrics: string | null;
  top_campaign: string | null;
  improvement_points: string | null;
  next_30_days: string | null;
  next_steps: string | null;
  client_logo_url: string | null;
  custom_content: Record<string, any> | null;
  section_images: Record<string, string[]> | null;
  public_token: string | null;
  is_published: boolean;
  pdf_url: string | null;
  cycle_start_date: string;
  cycle_end_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReportInput {
  clientId: string;
  actionsLast30Days: string;
  achievements: string;
  trafficResults: string;
  keyMetrics: string;
  topCampaign: string;
  improvementPoints: string;
  next30Days: string;
  nextSteps: string;
  clientLogoUrl: string;
  sectionImages: Record<string, string[]>;
}

const CYCLE_DAYS = 30;

/**
 * Data de corte para separar clientes antigos vs novos.
 * Clientes com contrato assinado ANTES desta data: prazo começa em 2026-04-02 (30 dias completos).
 * Clientes com contrato assinado A PARTIR desta data: prazo começa na data de assinatura.
 */
const CUTOFF_DATE = '2026-04-02';

/** Fetch all results reports for a client */
export function useClientResultsReports(clientId: string) {
  return useQuery({
    queryKey: ['client-results-reports', clientId],
    queryFn: async (): Promise<ResultsReport[]> => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_results_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ResultsReport[];
    },
    enabled: !!clientId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always' as const,
  });
}

/** Get the latest report to calculate cycle info */
export function useLatestReport(clientId: string) {
  return useQuery({
    queryKey: ['client-latest-report', clientId],
    queryFn: async (): Promise<ResultsReport | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('client_results_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      const report = data as unknown as ResultsReport | null;
      // Safety check: ensure report belongs to this client
      if (report && report.client_id !== clientId) return null;
      return report;
    },
    enabled: !!clientId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always' as const,
  });
}

/** Calculate days since a reference date */
export function getDaysSinceDate(referenceDate: string): number {
  const ref = new Date(referenceDate);
  const now = new Date();
  const diffMs = now.getTime() - ref.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** Calculate days since last report (or since client entry) */
export function getDaysSinceLastReport(latestReport: ResultsReport | null, clientCreatedAt?: string): number {
  const referenceDate = latestReport?.created_at || clientCreatedAt || new Date().toISOString();
  return getDaysSinceDate(referenceDate);
}

/** Get days remaining in the 30-day cycle */
export function getDaysRemaining(daysSince: number): number {
  return Math.max(0, CYCLE_DAYS - daysSince);
}

export interface ReportCycleStatus {
  daysSince: number;
  daysLeft: number;
  status: 'normal' | 'alert' | 'overdue' | 'pending';
  isLoading: boolean;
}

/**
 * Busca a data de assinatura do contrato do cliente.
 * Usa step_contrato_assinado_at de financeiro_client_onboarding (primário)
 * ou activated_at de financeiro_active_clients (fallback).
 */
function useContractSigningDate(clientId: string) {
  // Buscar de financeiro_client_onboarding
  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: ['report-contract-signing', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('financeiro_client_onboarding')
        .select('current_step, step_contrato_assinado_at, updated_at')
        .eq('client_id', clientId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 60000,
  });

  // Fallback: buscar de financeiro_active_clients
  const { data: activeClient, isLoading: activeLoading } = useQuery({
    queryKey: ['report-active-client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .select('activated_at, created_at')
        .eq('client_id', clientId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 60000,
  });

  const isLoading = onboardingLoading || activeLoading;

  // Verificar se contrato foi assinado
  const isContractSigned =
    onboarding?.current_step === 'contrato_assinado' || !!activeClient;

  // Data de assinatura: prioridade step_contrato_assinado_at > activated_at > created_at
  const signingDate =
    (onboarding?.step_contrato_assinado_at as string | null) ||
    activeClient?.activated_at ||
    activeClient?.created_at ||
    null;

  return { isContractSigned, signingDate, isLoading };
}

/**
 * Single source of truth for report cycle status.
 *
 * Regra de prazo:
 * - Se já existe relatório: ciclo de 30 dias a partir do último relatório (comportamento padrão)
 * - Se não existe relatório:
 *   - Sem contrato assinado → status 'pending' (sem prazo)
 *   - Contrato assinado ANTES da data de corte → prazo começa na data de corte (2026-04-02)
 *   - Contrato assinado A PARTIR da data de corte → prazo começa na data de assinatura
 */
export function useResultsReportStatus(clientId: string): ReportCycleStatus {
  const { data: latestReport, isLoading: reportLoading } = useLatestReport(clientId);
  const { isContractSigned, signingDate, isLoading: contractLoading } = useContractSigningDate(clientId);

  const isLoading = reportLoading || contractLoading;

  // Se já existe relatório, o ciclo recomeça a partir do último relatório
  if (latestReport) {
    const daysSince = getDaysSinceLastReport(latestReport, undefined);
    const daysLeft = getDaysRemaining(daysSince);

    let status: ReportCycleStatus['status'] = 'normal';
    if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
    else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

    return { daysSince, daysLeft, status, isLoading };
  }

  // Sem relatório — verificar contrato
  if (!isContractSigned) {
    return { daysSince: 0, daysLeft: 0, status: 'pending', isLoading };
  }

  // Contrato assinado, sem relatório ainda — determinar data de referência
  let referenceDate: string;

  if (!signingDate) {
    // Sem data de assinatura registrada → tratar como cliente antigo (usa data de corte)
    referenceDate = CUTOFF_DATE;
  } else {
    const signingDateStr = signingDate.split('T')[0]; // Normalizar para YYYY-MM-DD
    if (signingDateStr < CUTOFF_DATE) {
      // Cliente antigo (assinado antes da data de corte) → prazo começa na data de corte
      referenceDate = CUTOFF_DATE;
    } else {
      // Cliente novo (assinado a partir da data de corte) → prazo começa na data de assinatura
      referenceDate = signingDate;
    }
  }

  const daysSince = getDaysSinceDate(referenceDate);
  const daysLeft = getDaysRemaining(daysSince);

  let status: ReportCycleStatus['status'] = 'normal';
  if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
  else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

  return { daysSince, daysLeft, status, isLoading };
}

/** Transform report content via AI Edge Function */
async function transformReportWithAI(input: CreateReportInput, clientName: string): Promise<{
  actionsLast30Days: string;
  achievements: string;
  trafficResults: string;
  keyMetrics: string;
  topCampaign: string;
  improvementPoints: string;
  next30Days: string;
  nextSteps: string;
  resumoExecutivo?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('transform-results-report', {
      body: {
        clientName,
        actionsLast30Days: input.actionsLast30Days,
        achievements: input.achievements,
        trafficResults: input.trafficResults,
        keyMetrics: input.keyMetrics,
        topCampaign: input.topCampaign,
        improvementPoints: input.improvementPoints,
        next30Days: input.next30Days,
        nextSteps: input.nextSteps,
      },
    });

    if (error) throw error;

    const t = data?.transformed;
    if (!t) throw new Error('No transformed data');

    return {
      actionsLast30Days: t.acoesRealizadas || input.actionsLast30Days,
      achievements: t.conquistas || input.achievements,
      trafficResults: t.resultadosTrafego || input.trafficResults,
      keyMetrics: t.metricas || input.keyMetrics,
      topCampaign: t.campanhaDestaque || input.topCampaign,
      improvementPoints: t.pontosDeelhoria || input.improvementPoints,
      next30Days: t.proximos30Dias || input.next30Days,
      nextSteps: t.proximosPassos || input.nextSteps,
      resumoExecutivo: t.resumoExecutivo,
    };
  } catch (err) {
    console.error('[ResultsReport] AI transform failed, using raw content:', err);
    // Fallback: use raw content if AI fails
    return {
      actionsLast30Days: input.actionsLast30Days,
      achievements: input.achievements,
      trafficResults: input.trafficResults,
      keyMetrics: input.keyMetrics,
      topCampaign: input.topCampaign,
      improvementPoints: input.improvementPoints,
      next30Days: input.next30Days,
      nextSteps: input.nextSteps,
    };
  }
}

/** Create a new results report */
export function useCreateResultsReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateReportInput & { clientName?: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Get client name for AI context
      let clientName = input.clientName || 'Cliente';
      if (!input.clientName) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('name')
          .eq('id', input.clientId)
          .single();
        clientName = clientData?.name || 'Cliente';
      }

      // Transform content with AI
      const transformed = await transformReportWithAI(input, clientName);

      const now = new Date();
      const cycleEnd = new Date(now);
      cycleEnd.setDate(cycleEnd.getDate() + CYCLE_DAYS);

      const { data, error } = await supabase
        .from('client_results_reports')
        .insert({
          client_id: input.clientId,
          created_by: user.id,
          actions_last_30_days: transformed.actionsLast30Days,
          achievements: transformed.achievements,
          traffic_results: transformed.trafficResults,
          key_metrics: transformed.keyMetrics,
          top_campaign: transformed.topCampaign,
          improvement_points: transformed.improvementPoints,
          next_30_days: transformed.next30Days,
          next_steps: transformed.nextSteps,
          client_logo_url: input.clientLogoUrl,
          is_published: true,
          cycle_start_date: now.toISOString().split('T')[0],
          cycle_end_date: cycleEnd.toISOString().split('T')[0],
          custom_content: {
            ...(transformed.resumoExecutivo ? { resumoExecutivo: transformed.resumoExecutivo } : {}),
            sectionImages: input.sectionImages,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // ── Proteção contra trigger duplicador ──
      // Um trigger no banco está copiando o relatório para TODOS os clientes.
      // Aqui deletamos imediatamente todos os clones, mantendo apenas o original.
      const { data: allDuplicates } = await supabase
        .from('client_results_reports')
        .select('id, client_id')
        .eq('created_by', user.id)
        .eq('cycle_start_date', now.toISOString().split('T')[0])
        .neq('client_id', input.clientId);

      if (allDuplicates && allDuplicates.length > 0) {
        const idsToDelete = allDuplicates.map(r => r.id);
        console.log(`[ResultsReport] Trigger duplicou ${idsToDelete.length} relatórios. Deletando clones...`);
        // Deletar em lotes de 50
        for (let i = 0; i < idsToDelete.length; i += 50) {
          const batch = idsToDelete.slice(i, i + 50);
          await supabase
            .from('client_results_reports')
            .delete()
            .in('id', batch);
        }
        console.log(`[ResultsReport] Clones removidos com sucesso.`);
      }

      // Create auto-task: "Apresentar PDF Resultados [Client]"
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 3);

      await supabase.from('ads_tasks').insert({
        ads_manager_id: user.id,
        title: `Apresentar "PDF Resultados" ${input.clientId}`,
        description: JSON.stringify({
          type: 'present_results_report',
          reportId: data.id,
          clientId: input.clientId,
        }),
        task_type: 'daily',
        status: 'todo',
        priority: 'high',
        due_date: dueDate.toISOString(),
      });

      return data as unknown as ResultsReport;
    },
    onSuccess: (_, input) => {
      // Invalida TODOS os caches de relatórios (limpeza pode ter removido de outros clientes)
      queryClient.invalidateQueries({ queryKey: ['client-results-reports'] });
      queryClient.invalidateQueries({ queryKey: ['client-latest-report'] });
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
      toast.success('Relatório de resultados criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar relatório', { description: error.message });
    },
  });
}

/** Delete a results report */
export function useDeleteResultsReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('client_results_reports')
        .delete()
        .eq('id', id)
        .eq('client_id', clientId);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client-results-reports', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-latest-report', clientId] });
      toast.success('Relatório removido');
    },
  });
}
