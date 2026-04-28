import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActionJustification } from '@/contexts/JustificationContext';

// Auto-trigger do modal bloqueante de justificativa para etiquetas (client_tags)
// vencidas onde o user logado é responsável (gestor_ads ou sucesso_cliente).
//
// Espelha estrutura de `useCrmDelayJustifications` — `triggeredRef` dedup
// para evitar re-disparo da mesma pending na mesma sessão antes do trigger DB
// linkar `justified_at`.

const ROLE_AS: Record<string, string> = {
  gestor_ads: 'gestor de ads',
  sucesso_cliente: 'sucesso do cliente',
};

interface PendingTagJustification {
  notification_id: string;
  tag_id: string;
  client_id: string;
  client_name: string;
  tag_name: string;
  user_role: string;
  task_table: string;
  task_title: string | null;
  expires_at: string;
  detected_at: string;
}

function calcExpiredDays(expiresAt: string): number {
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return 0;
  const days = Math.floor((Date.now() - expiresMs) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export function useClientTagDelayJustifications() {
  const { user } = useAuth();
  const { requireJustification } = useActionJustification();
  const triggeredRef = useRef<Set<string>>(new Set());

  const { data: pending = [] } = useQuery({
    queryKey: ['client-tag-delay-pending', user?.id],
    queryFn: async (): Promise<PendingTagJustification[]> => {
      // RPC ainda não exposta nos types regen — cast defensivo.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        'get_pending_client_tag_justifications_for_user',
      );
      if (error) throw error;
      return (data || []) as PendingTagJustification[];
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
        if (triggeredRef.current.has(p.notification_id)) continue;
        triggeredRef.current.add(p.notification_id);

        const days = calcExpiredDays(p.expires_at);
        const roleLabel = ROLE_AS[p.user_role] ?? p.user_role;

        try {
          await requireJustification({
            title: 'Etiqueta vencida',
            subtitle: `${p.tag_name} · ${p.client_name}`,
            message: `O prazo desta etiqueta venceu há ${days} dia(s). Como ${roleLabel} responsável, descreva o motivo do atraso.`,
            taskId: p.tag_id,
            taskTable: p.task_table,
            taskTitle: p.task_title || `${p.tag_name} - ${p.client_name}`,
            priority: days >= 3 ? 'urgent' : 'high',
          });
        } catch {
          // Modal fechado/erro — libera para tentar de novo no próximo refetch.
          triggeredRef.current.delete(p.notification_id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pending, requireJustification]);
}
