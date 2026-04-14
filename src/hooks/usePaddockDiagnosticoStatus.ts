import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CYCLE_DAYS = 30;
const CUTOFF_DATE = '2026-04-13'; // Data de implantação do diagnóstico Paddock

export interface PaddockDiagnosticoCycleStatus {
  daysSince: number;
  daysLeft: number;
  status: 'pending' | 'normal' | 'alert' | 'overdue';
  link: string | null;
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

// Buscar último diagnóstico paddock do cliente na tabela paddock_diagnosticos
function useLatestPaddockDiagnostico(clientId: string) {
  return useQuery({
    queryKey: ['latest-paddock-diagnostico', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paddock_diagnosticos' as any)
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

function useClientPaddockDiagnostico(clientId: string) {
  return useQuery({
    queryKey: ['paddock-diagnostico', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('paddock_diagnostico_link, paddock_diagnostico_submitted_at, assigned_comercial, created_at')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePaddockDiagnosticoStatus(clientId: string): PaddockDiagnosticoCycleStatus {
  const { data: latestDiag, isLoading: diagLoading } = useLatestPaddockDiagnostico(clientId);
  const { data: clientData, isLoading: clientLoading } = useClientPaddockDiagnostico(clientId);

  const isLoading = diagLoading || clientLoading;

  if (isLoading || !clientData) {
    return { daysSince: 0, daysLeft: CYCLE_DAYS, status: 'pending', link: null, isLoading: true };
  }

  // Priority 1: If a paddock_diagnostico record exists, use its created_at for the cycle
  if (latestDiag) {
    const createdDate = latestDiag.created_at.split('T')[0];
    const daysSince = getDaysSinceDate(createdDate);
    const daysLeft = getDaysRemaining(daysSince);

    let status: PaddockDiagnosticoCycleStatus['status'] = 'normal';
    if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
    else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

    return { daysSince, daysLeft, status, link: clientData.paddock_diagnostico_link, isLoading: false };
  }

  // Priority 2: If there's a submitted diagnostic date on clients table, use that
  if (clientData.paddock_diagnostico_submitted_at) {
    const submittedDate = clientData.paddock_diagnostico_submitted_at.split('T')[0];
    const daysSince = getDaysSinceDate(submittedDate);
    const daysLeft = getDaysRemaining(daysSince);

    let status: PaddockDiagnosticoCycleStatus['status'] = 'normal';
    if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
    else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

    return { daysSince, daysLeft, status, link: clientData.paddock_diagnostico_link, isLoading: false };
  }

  // No diagnostic submitted — check if client has comercial assigned
  if (!clientData.assigned_comercial) {
    return { daysSince: 0, daysLeft: 0, status: 'pending', link: null, isLoading: false };
  }

  // Has comercial, no diagnostic — use reference date
  const clientCreated = clientData.created_at?.split('T')[0] || CUTOFF_DATE;
  const referenceDate = clientCreated < CUTOFF_DATE ? CUTOFF_DATE : clientCreated;

  const daysSince = getDaysSinceDate(referenceDate);
  const daysLeft = getDaysRemaining(daysSince);

  let status: PaddockDiagnosticoCycleStatus['status'] = 'normal';
  if (daysLeft === 0 && daysSince >= CYCLE_DAYS) status = 'overdue';
  else if (daysLeft > 0 && daysLeft <= 4) status = 'alert';

  return { daysSince, daysLeft, status, link: null, isLoading: false };
}

// Mutation to attach/update diagnostic link and reset the 30-day cycle
export function useUpdatePaddockDiagnosticoLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, link }: { clientId: string; link: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          paddock_diagnostico_link: link,
          paddock_diagnostico_submitted_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['latest-paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
    },
  });
}
