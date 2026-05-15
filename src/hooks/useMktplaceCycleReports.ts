import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type CycleReportRow = Database['public']['Tables']['mktplace_cycle_reports']['Row'];
type ReportType = 'consultoria' | 'gestao';

// ─── Marketplace data shape (JSONB) ───

export interface MarketplaceEntry {
  marketplace: string;
  faturamento: number;
  pedidos: number;
  reputacao: string;
  ticket_medio?: number;
}

export interface Top5SkuEntry {
  posicao: number;
  sku: string;
  faturamento: number;
  quantidade: number;
}

// ─── Cycle status (reuses pattern from useMktplaceRelatorioStatus) ───

export type CycleStatusSeverity = 'green' | 'yellow' | 'orange' | 'red';

export interface CycleReportStatus {
  daysRemaining: number;
  severity: CycleStatusSeverity;
  lastReportDate: string | null;
  reportNumber: number;
  isLoading: boolean;
}

// ─── Create input ───

export interface CreateCycleReportInput {
  client_id: string;
  report_type: ReportType;
  cycle_start_date: string;
  cycle_end_date: string;
  reuniao_realizada?: boolean;
  reuniao_data?: string;
  reuniao_horario?: string;
  marketplace_data?: MarketplaceEntry[];
  cumprimento_plano?: 'tudo' | 'parcial' | 'nao';
  cumprimento_detalhamento?: string;
  dificuldades?: string;
  top5_skus?: Top5SkuEntry[];
  plano_proximo_ciclo?: string;
  proxima_reuniao_data?: string;
  proxima_reuniao_horario?: string;
  skus_cadastrados_otimizados?: string;
  skus_problematicos?: string;
  acoes_executadas?: string;
  // gestao-only
  verba_ads?: number;
  acos_medio?: number;
  tacos_medio?: number;
  rms_abertas?: number;
  rms_resolvidas?: number;
  rms_em_aberto?: number;
  plano_proximos_dias?: string;
  variacao_faturamento_pct?: number;
  variacao_pedidos_pct?: number;
}

// ─── Helpers ───

const CUTOFF_DATE = '2026-04-12';

function getCycleDays(reportType: ReportType): number {
  return reportType === 'gestao' ? 15 : 30;
}

function getDaysSince(dateStr: string): number {
  const ref = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveSeverity(daysRemaining: number, cycleDays: number): CycleStatusSeverity {
  if (daysRemaining <= 0) return 'red';
  const pctLeft = daysRemaining / cycleDays;
  if (pctLeft > 0.50) return 'green';
  if (pctLeft > 0.25) return 'yellow';
  if (pctLeft > 0.10) return 'orange';
  return 'red';
}

// ─── useCycleReports: list all cycle reports for a client ───

export function useCycleReports(clientId: string, reportType?: ReportType) {
  return useQuery({
    queryKey: ['mktplace-cycle-reports', clientId, reportType],
    queryFn: async (): Promise<CycleReportRow[]> => {
      if (!clientId) return [];

      let query = supabase
        .from('mktplace_cycle_reports')
        .select('id, client_id, consultor_id, report_type, report_number, cycle_start_date, cycle_end_date, reuniao_realizada, reuniao_data, reuniao_horario, marketplace_data, cumprimento_plano, cumprimento_detalhamento, dificuldades, top5_skus, plano_proximo_ciclo, proxima_reuniao_data, proxima_reuniao_horario, skus_cadastrados_otimizados, skus_problematicos, acoes_executadas, verba_ads, acos_medio, tacos_medio, rms_abertas, rms_resolvidas, rms_em_aberto, plano_proximos_dias, variacao_faturamento_pct, variacao_pedidos_pct, public_token, is_published, created_at, updated_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CycleReportRow[];
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useCycleReportStatus: countdown timer status ───

export function useCycleReportStatus(
  clientId: string,
  reportType: ReportType,
): CycleReportStatus {
  const cycleDays = getCycleDays(reportType);

  // Latest cycle report for this client+type
  const { data: latestReport, isLoading: reportLoading } = useQuery({
    queryKey: ['latest-mktplace-cycle-report', clientId, reportType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mktplace_cycle_reports')
        .select('id, report_number, created_at')
        .eq('client_id', clientId)
        .eq('report_type', reportType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  // Fallback: client creation date if no reports exist yet
  const { data: clientData, isLoading: clientLoading } = useQuery({
    queryKey: ['client-mktplace-info-relatorio', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('assigned_mktplace, created_at')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !latestReport,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = reportLoading || clientLoading;

  // Has a previous report — count from its created_at
  if (latestReport) {
    const createdDate = latestReport.created_at.split('T')[0];
    const daysSince = getDaysSince(createdDate);
    const daysRemaining = Math.max(0, cycleDays - daysSince);

    return {
      daysRemaining,
      severity: deriveSeverity(daysRemaining, cycleDays),
      lastReportDate: createdDate,
      reportNumber: latestReport.report_number + 1,
      isLoading,
    };
  }

  // No report yet — fallback to client assignment date
  if (!clientData?.assigned_mktplace) {
    return { daysRemaining: 0, severity: 'green', lastReportDate: null, reportNumber: 1, isLoading };
  }

  const clientCreated = clientData.created_at?.split('T')[0] || CUTOFF_DATE;
  const referenceDate = clientCreated < CUTOFF_DATE ? CUTOFF_DATE : clientCreated;
  const daysSince = getDaysSince(referenceDate);
  const daysRemaining = Math.max(0, cycleDays - daysSince);

  return {
    daysRemaining,
    severity: deriveSeverity(daysRemaining, cycleDays),
    lastReportDate: null,
    reportNumber: 1,
    isLoading,
  };
}

// ─── useCreateCycleReport: mutation via RPC ───

export function useCreateCycleReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCycleReportInput) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const { data, error } = await supabase.rpc('create_mktplace_cycle_report', {
        p_payload: input as unknown as Database['public']['Functions']['create_mktplace_cycle_report']['Args']['p_payload'],
      });

      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-cycle-reports', input.client_id] });
      queryClient.invalidateQueries({ queryKey: ['latest-mktplace-cycle-report', input.client_id] });
      toast.success('Relatorio de ciclo criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar relatorio de ciclo', { description: error.message });
    },
  });
}
