import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const TASK_PREFIX_GERAR = 'Gerar PDF de Resultados';
const TASK_PREFIX_MARCAR = 'Marcar apresentação de resultado';

/**
 * Auto-creates tasks at the 26-day mark of the report cycle.
 * Runs on page load for gestor_ads and gestor_projetos.
 *
 * At 26 days since last report:
 * 1. "Gerar PDF de Resultados [Client]" — due at day 29
 * 2. "Marcar apresentação de resultado [Client]" — due at day 30
 */
export function useResultsReportAutomation() {
  const { user } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || processedRef.current) return;
    if (!user.role || !['gestor_ads', 'gestor_projetos', 'ceo'].includes(user.role)) return;

    processedRef.current = true;
    checkAndCreateTasks(user.id).catch(err => {
      console.error('[ResultsReportAutomation] Error:', err);
    });
  }, [user?.id, user?.role]);
}

async function checkAndCreateTasks(userId: string) {
  const now = new Date();

  // Get all clients tracked by this ads manager
  const { data: tracking } = await supabase
    .from('client_daily_tracking')
    .select('client_id, ads_manager_id')
    .eq('ads_manager_id', userId);

  if (!tracking || tracking.length === 0) return;

  const clientIds = tracking.map(t => t.client_id);

  // Get client names
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, created_at')
    .in('id', clientIds);

  if (!clients || clients.length === 0) return;

  // Get latest report per client
  const { data: reports } = await supabase
    .from('client_results_reports')
    .select('client_id, created_at')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false });

  const latestReportByClient = new Map<string, string>();
  (reports || []).forEach((r: any) => {
    if (!latestReportByClient.has(r.client_id)) {
      latestReportByClient.set(r.client_id, r.created_at);
    }
  });

  for (const client of clients) {
    const lastReportDate = latestReportByClient.get(client.id) || client.created_at;
    const ref = new Date(lastReportDate);
    const diffDays = Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

    // Only create tasks at 26+ days
    if (diffDays < 26) continue;

    // Task 1: "Gerar PDF de Resultados [Client]" — due day 29
    const gerarTitle = `${TASK_PREFIX_GERAR} ${client.name}`;
    await createTaskIfNotExists(userId, client.id, gerarTitle, addDaysToDate(ref, 29));

    // Task 2: "Marcar apresentação de resultado [Client]" — due day 30
    const marcarTitle = `${TASK_PREFIX_MARCAR} ${client.name}`;
    await createTaskIfNotExists(userId, client.id, marcarTitle, addDaysToDate(ref, 30));
  }
}

function addDaysToDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function createTaskIfNotExists(
  userId: string,
  clientId: string,
  title: string,
  dueDate: string,
) {
  // Idempotency check
  const { data: existing } = await supabase
    .from('ads_tasks')
    .select('id')
    .eq('ads_manager_id', userId)
    .ilike('title', title)
    .neq('status', 'completed')
    .eq('archived', false)
    .maybeSingle();

  if (existing) return;

  await supabase.from('ads_tasks').insert({
    ads_manager_id: userId,
    title,
    description: JSON.stringify({
      type: 'results_report_cycle',
      clientId,
    }),
    task_type: 'daily',
    status: 'todo',
    priority: 'high',
    due_date: dueDate,
  });
}
