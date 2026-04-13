import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CYCLE_DAYS = 30;
const CUTOFF_DATE = '2026-04-12';

export interface MktplaceRelatorioCycleStatus {
  daysSince: number;
  daysLeft: number;
  status: 'pending' | 'normal' | 'alert' | 'overdue';
  isLoading: boolean;
}

function getDaysSinceDate(dateStr: string): number {
  const ref = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysRemaining(daysSince: number): number {
  return Math.max(0, CYCLE_DAYS - daysSince);
}

function useLatestMktplaceRelatorio(clientId: string) {
  return useQuery({
    queryKey: ['latest-mktplace-relatorio', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mktplace_relatorios' as any)
        .select('id, created_at')
        .eq('client_id', clientId)
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

export function useMktplaceRelatorioStatus(clientId: string): MktplaceRelatorioCycleStatus {
  const { data: latestRel, isLoading: relLoading } = useLatestMktplaceRelatorio(clientId);
  const { data: clientData, isLoading: clientLoading } = useClientMktplaceInfo(clientId);

  const isLoading = relLoading || clientLoading;

  // Se já existe relatório MKT Place, ciclo recomeça a partir do último
  if (latestRel) {
    const createdDate = latestRel.created_at.split('T')[0];
    const daysSince = getDaysSinceDate(createdDate);
    const daysLeft = getDaysRemaining(daysSince);

    let status: MktplaceRelatorioCycleStatus['status'] = 'normal';
    if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
    else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

    return { daysSince, daysLeft, status, isLoading };
  }

  // Sem relatório — verificar se tem consultor mktplace
  if (!clientData?.assigned_mktplace) {
    return { daysSince: 0, daysLeft: 0, status: 'pending', isLoading };
  }

  // Tem consultor, sem relatório — usar data de referência
  const clientCreated = clientData.created_at?.split('T')[0] || CUTOFF_DATE;
  const referenceDate = clientCreated < CUTOFF_DATE ? CUTOFF_DATE : clientCreated;

  const daysSince = getDaysSinceDate(referenceDate);
  const daysLeft = getDaysRemaining(daysSince);

  let status: MktplaceRelatorioCycleStatus['status'] = 'normal';
  if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
  else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

  return { daysSince, daysLeft, status, isLoading };
}
