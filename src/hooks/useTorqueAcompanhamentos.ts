// src/hooks/useTorqueAcompanhamentos.ts
//
// Slice 5 (#95) — Board de Acompanhamentos (pós-implantação). ADR 0006 §2.
//
// Hook central da aba Acompanhamentos: lê os cards ATIVOS (closed_at IS NULL) com
// escopo gestor-crm (RLS + filtro de scope espelham useCrmConfiguracoes da #91) e
// expõe a mutation de drag livre (torque_acomp_mover). Mundos separados: este
// board é INDEPENDENTE de crm_configuracoes — nunca cruza queryKeys com ele.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDataScope } from '@/hooks/useDataScope';
import { toast } from 'sonner';
import { moverAcompanhamento, setChecklistAcompanhamento } from '@/lib/torqueCrm/acompanhamentoRpc';
import type { AcompColuna } from '@/lib/torqueCrm/acompanhamento';
import type { ChecklistItem } from '@/lib/torqueCrm/checklist';

/** Card de acompanhamento, hidratado com o cliente (para exibir o nome). */
export interface AcompRow {
  id: string;
  client_id: string;
  gestor_id: string | null;
  coluna: AcompColuna;
  checklist: ChecklistItem[] | null;
  closed_at: string | null;
  created_at: string;
  clients?: { id: string; name?: string; razao_social?: string; client_label?: string | null } | null;
}

const QUERY_KEY = 'torque-acompanhamentos';

/**
 * Lê os acompanhamentos ATIVOS visíveis ao usuário. RLS já escopa por
 * gestor-crm; o filtro de scope no client espelha useCrmConfiguracoes (gestor
 * não-admin vê só os seus).
 */
export function useTorqueAcompanhamentos() {
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: [QUERY_KEY, user?.id, user?.role, scopeKey],
    queryFn: async () => {
      const base = supabase
        .from('crm_acompanhamentos')
        .select('*, clients:client_id(id, name, razao_social, client_label)')
        .is('closed_at', null)
        .order('created_at', { ascending: true });

      // Gestor não-admin vê só os seus (RLS já garante; o filtro evita roundtrip).
      const scoped =
        !seesAll && user?.role === 'gestor_crm' && user?.id
          ? base.eq('gestor_id', user.id)
          : base;

      const { data, error } = await scoped;
      if (error) throw error;
      return (data ?? []) as unknown as AcompRow[];
    },
    enabled: isReady && !!user?.id,
  });
}

/**
 * Drag livre: persiste a coluna de um card via RPC torque_acomp_mover (ADR §2).
 * O cliente decide o destino; a RPC valida coluna + autorização no servidor.
 */
export function useMoverAcompanhamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ acompId, coluna }: { acompId: string; coluna: AcompColuna }) => {
      await moverAcompanhamento(acompId, coluna);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao mover o acompanhamento', { description: err.message });
    },
  });
}

/**
 * Slice #96 — persiste o checklist de "Tasks em aberto" de um acompanhamento via
 * RPC torque_acomp_checklist_set (ADR §2). O cliente computa o próximo array com
 * o módulo puro checklist.ts e manda o array INTEIRO; a RPC decide o auto-move
 * atômico (tasks_em_aberto -> fazer_follow_up no 100% completo). Invalida a query
 * para refletir tanto o checklist quanto o eventual auto-move de coluna.
 */
export function useSetChecklistAcompanhamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ acompId, checklist }: { acompId: string; checklist: ChecklistItem[] }) => {
      await setChecklistAcompanhamento(acompId, checklist);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar as tasks', { description: err.message });
    },
  });
}
