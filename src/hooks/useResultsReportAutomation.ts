import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CYCLE_DAYS } from '@/hooks/useClientResultsReports';

const TASK_PREFIX_GERAR = 'Gerar PDF de Resultados';
const TASK_PREFIX_MARCAR = 'Marcar apresentação de resultado';

/**
 * Auto-creates tasks near the end of the report cycle.
 * Triggers at (cycleDays - 3) days since last report/reset.
 *
 * Per client:
 * 1. "Gerar PDF de Resultados [Client]" — due at cycleDays - 1
 * 2. "Marcar apresentação de resultado [Client]" — due at cycleDays
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

  const { data: tracking } = await supabase
    .from('client_daily_tracking')
    .select('client_id, ads_manager_id')
    .eq('ads_manager_id', userId);

  if (!tracking || tracking.length === 0) return;

  const clientIds = tracking.map(t => t.client_id);

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, created_at, report_cycle_days, report_cycle_reset_at')
    .in('id', clientIds);

  if (!clients || clients.length === 0) return;

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
    const cycleDays = (client as any).report_cycle_days ?? CYCLE_DAYS;
    const resetAt = (client as any).report_cycle_reset_at as string | null;

    const lastReportDate = latestReportByClient.get(client.id) || resetAt || client.created_at;
    const ref = new Date(lastReportDate);
    const diffDays = Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

    const triggerDay = cycleDays - 3;
    if (diffDays < triggerDay) continue;

    const gerarTitle = `${TASK_PREFIX_GERAR} ${client.name}`;
    await createTaskIfNotExists(userId, client.id, gerarTitle, addDaysToDate(ref, cycleDays - 1), ref);

    const marcarTitle = `${TASK_PREFIX_MARCAR} ${client.name}`;
    await createTaskIfNotExists(userId, client.id, marcarTitle, addDaysToDate(ref, cycleDays), ref);
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
  cycleStart: Date,
) {
  // Check for any task with this title created after the current cycle started
  const { data: existing } = await supabase
    .from('ads_tasks')
    .select('id')
    .eq('ads_manager_id', userId)
    .ilike('title', title)
    .gte('created_at', cycleStart.toISOString())
    .limit(1);

  if (existing && existing.length > 0) return;

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
