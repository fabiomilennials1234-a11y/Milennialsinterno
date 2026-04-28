import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActionJustification } from '@/contexts/JustificationContext';

// Auto-trigger do modal bloqueante de justificativa coletiva.
// Para cada pending devolvido pela RPC, dispara `requireJustification` em sequência
// (queue interno do JustificationContext garante 1-modal-por-vez).
//
// triggeredRef impede re-disparo da mesma pending na mesma sessão (ex: refetch
// retorna a mesma row antes do trigger DB linkar `justified_at`).

const PRODUTO_LABEL: Record<string, string> = {
  v8: 'V8',
  automation: 'Automation',
  copilot: 'Copilot',
};

interface PendingRow {
  pending_id: string;
  config_id: string;
  client_id: string;
  client_name: string;
  produto: string;
  user_role: string;
  notification_id: string | null;
  task_table: string;
  task_title: string | null;
  task_due_date: string | null;
  detected_at: string;
}

function calcDelayedDays(taskDueDate: string | null, detectedAt: string): number {
  // Prefere due_date (deadline real). Fallback: detected_at (cron rodou).
  const ref = taskDueDate ?? detectedAt;
  const refMs = new Date(ref).getTime();
  if (!Number.isFinite(refMs)) return 0;
  const days = Math.floor((Date.now() - refMs) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export function useCrmDelayJustifications() {
  const { user } = useAuth();
  const { requireJustification } = useActionJustification();
  const triggeredRef = useRef<Set<string>>(new Set());

  const { data: pending = [] } = useQuery({
    queryKey: ['crm-delay-pending', user?.id],
    queryFn: async (): Promise<PendingRow[]> => {
      // RPC ainda não exposta nos types regen — cast defensivo.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pending_crm_justifications_for_user');
      if (error) throw error;
      return (data || []) as PendingRow[];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!pending.length) return;
    let cancelled = false;

    (async () => {
      for (const p of pending) {
        if (cancelled) break;
        if (triggeredRef.current.has(p.pending_id)) continue;
        triggeredRef.current.add(p.pending_id);

        const produtoLabel = PRODUTO_LABEL[p.produto] ?? p.produto;
        const delayedDays = calcDelayedDays(p.task_due_date, p.detected_at);

        try {
          await requireJustification({
            title: 'Tarefa CRM atrasada',
            subtitle: `${produtoLabel} · ${p.client_name}`,
            message: `Esta configuração está atrasada há ${delayedDays} dia(s). Sua perspectiva é necessária para alinhar com os outros responsáveis pelo cliente.`,
            taskId: p.config_id,
            taskTable: p.task_table,
            taskTitle: p.task_title || `${produtoLabel} - ${p.client_name}`,
            priority: delayedDays >= 8 ? 'urgent' : 'high',
          });
        } catch {
          // Modal fechado/erro — libera para tentar de novo no próximo refetch.
          triggeredRef.current.delete(p.pending_id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pending, requireJustification]);
}
