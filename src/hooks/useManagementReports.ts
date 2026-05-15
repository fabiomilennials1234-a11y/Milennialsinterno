import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ManagementReportRow = Database['public']['Tables']['client_management_reports']['Row'];
type ManagementReportInsert = Database['public']['Tables']['client_management_reports']['Insert'];

// ─── Status types ───

export type ManagementReportSeverity = 'green' | 'yellow' | 'orange' | 'red';

export interface ManagementReportStatus {
  daysRemaining: number;
  daysSince: number;
  severity: ManagementReportSeverity;
  lastReportDate: string | null;
  isLoading: boolean;
}

// ─── Responsaveis shape (JSONB) ───

export interface ResponsavelAcao {
  acao: string;
  responsavel: 'Cliente' | 'Milennials';
}

// ─── Helpers ───

const CYCLE_DAYS = 30;
const CUTOFF_DATE = '2026-04-12';

function getDaysSince(dateStr: string): number {
  const ref = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveSeverity(daysRemaining: number): ManagementReportSeverity {
  if (daysRemaining <= 0) return 'red';
  if (daysRemaining > 15) return 'green';
  if (daysRemaining > 7) return 'yellow';
  if (daysRemaining > 3) return 'orange';
  return 'red';
}

// ─── useManagementReports: list all management reports for a client ───

export function useManagementReports(clientId: string) {
  return useQuery({
    queryKey: ['management-reports', clientId],
    queryFn: async (): Promise<ManagementReportRow[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_management_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ManagementReportRow[];
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useManagementReportStatus: 30-day countdown ───

export function useManagementReportStatus(clientId: string): ManagementReportStatus {
  const { data: latestReport, isLoading: reportLoading } = useQuery({
    queryKey: ['latest-management-report', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_management_reports')
        .select('id, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clientData, isLoading: clientLoading } = useQuery({
    queryKey: ['client-info-mgmt-report', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('created_at')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !latestReport,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = reportLoading || clientLoading;

  if (latestReport?.created_at) {
    const createdDate = latestReport.created_at.split('T')[0];
    const daysSince = getDaysSince(createdDate);
    const daysRemaining = Math.max(0, CYCLE_DAYS - daysSince);

    return {
      daysRemaining,
      daysSince,
      severity: deriveSeverity(daysRemaining),
      lastReportDate: createdDate,
      isLoading,
    };
  }

  // No report yet — fallback to client creation date
  const clientCreated = clientData?.created_at?.split('T')[0] || CUTOFF_DATE;
  const referenceDate = clientCreated < CUTOFF_DATE ? CUTOFF_DATE : clientCreated;
  const daysSince = getDaysSince(referenceDate);
  const daysRemaining = Math.max(0, CYCLE_DAYS - daysSince);

  return {
    daysRemaining,
    daysSince,
    severity: deriveSeverity(daysRemaining),
    lastReportDate: null,
    isLoading,
  };
}

// ─── useCreateManagementReport: mutation INSERT ───

export function useCreateManagementReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Omit<ManagementReportInsert, 'created_by'>) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const { data, error } = await supabase
        .from('client_management_reports')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['management-reports', input.client_id] });
      queryClient.invalidateQueries({ queryKey: ['latest-management-report', input.client_id] });
      toast.success('Relatorio de gestao criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar relatorio de gestao', { description: error.message });
    },
  });
}

// ─── useDeleteManagementReport: mutation DELETE ───

export function useDeleteManagementReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('client_management_reports')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['management-reports', result.clientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-management-report', result.clientId] });
      toast.success('Relatorio excluido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir relatorio', { description: error.message });
    },
  });
}
