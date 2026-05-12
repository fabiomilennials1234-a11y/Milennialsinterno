import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CUTOFF_DATE = '2026-04-12';

function getCycleDays(trackingType: 'consultoria' | 'gestao'): number {
  return trackingType === 'gestao' ? 15 : 30;
}

export interface MktplaceRelatorioCycleStatus {
  daysSince: number;
  daysLeft: number;
  cycleDays: number;
  status: 'pending' | 'normal' | 'alert' | 'overdue';
  isLoading: boolean;
}

function getDaysSinceDate(dateStr: string): number {
  const ref = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysRemaining(daysSince: number, cycleDays: number): number {
  return Math.max(0, cycleDays - daysSince);
}

function useLatestMktplaceRelatorio(clientId: string, reportType: 'consultoria' | 'gestao') {
  return useQuery({
    queryKey: ['latest-mktplace-relatorio', clientId, reportType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('mktplace_relatorios')
        .select('id, created_at')
        .eq('client_id', clientId)
        .eq('report_type', reportType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; created_at: string } | null;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

function useClientMktplaceInfo(clientId: string) {
  return useQuery({
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
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMktplaceRelatorioStatus(
  clientId: string,
  trackingType: 'consultoria' | 'gestao' = 'consultoria',
): MktplaceRelatorioCycleStatus {
  const cycleDays = getCycleDays(trackingType);
  const { data: latestRel, isLoading: relLoading } = useLatestMktplaceRelatorio(clientId, trackingType);
  const { data: clientData, isLoading: clientLoading } = useClientMktplaceInfo(clientId);

  const isLoading = relLoading || clientLoading;

  if (latestRel) {
    const createdDate = latestRel.created_at.split('T')[0];
    const daysSince = getDaysSinceDate(createdDate);
    const daysLeft = getDaysRemaining(daysSince, cycleDays);

    let status: MktplaceRelatorioCycleStatus['status'] = 'normal';
    if (daysLeft === 0 && daysSince >= cycleDays) status = 'overdue';
    else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

    return { daysSince, daysLeft, cycleDays, status, isLoading };
  }

  if (!clientData?.assigned_mktplace) {
    return { daysSince: 0, daysLeft: 0, cycleDays, status: 'pending', isLoading };
  }

  const clientCreated = clientData.created_at?.split('T')[0] || CUTOFF_DATE;
  const referenceDate = clientCreated < CUTOFF_DATE ? CUTOFF_DATE : clientCreated;

  const daysSince = getDaysSinceDate(referenceDate);
  const daysLeft = getDaysRemaining(daysSince, cycleDays);

  let status: MktplaceRelatorioCycleStatus['status'] = 'normal';
  if (daysLeft === 0 && daysSince >= cycleDays) status = 'overdue';
  else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

  return { daysSince, daysLeft, cycleDays, status, isLoading };
}
