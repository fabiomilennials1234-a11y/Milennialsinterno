// src/lib/torqueCrm/acompanhamentoRpc.ts
//
// Slice 5 (#95) — Board de Acompanhamentos (ADR 0006 §2). Wrapper TIPADO da RPC
// de escrita do board de acompanhamentos.
//
// A ÚNICA forma de mover um card de acompanhamento é via esta função → RPC
// SECURITY DEFINER torque_acomp_mover (autorização re-checada no servidor). A
// regra de coluna válida / drag livre vive no reducer puro acompanhamento.ts
// (testado em vitest), espelhada pela RPC e provada de novo pela pgTAP.
//
// A criação do card NÃO tem wrapper: ela é um efeito automático do gancho dentro
// de torque_board_pronto (já chamado por marcarProntoCard em boardRpc.ts). Dois
// cards, mundos separados — o cliente nunca cria acompanhamento manualmente.
import { supabase } from "@/integrations/supabase/client";
import type { AcompColuna } from "./acompanhamento";
import type { ChecklistItem } from "./checklist";

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};
const rpcClient = supabase as unknown as RpcClient;

/**
 * Drag livre: move o card de acompanhamento para `coluna` (contrato
 * `torque_acomp_mover`). Sem gate sequencial — qualquer coluna válida. A RPC
 * rejeita coluna inválida e re-checa a autorização (escopo gestor-crm).
 */
export async function moverAcompanhamento(acompId: string, coluna: AcompColuna): Promise<void> {
  const { error } = await rpcClient.rpc<void>("torque_acomp_mover", {
    p_acomp_id: acompId,
    p_coluna: coluna,
  });
  if (error) throw new Error(error.message);
}

/**
 * Slice #96 — substitui o checklist INTEIRO de "Tasks em aberto" de um card
 * (contrato `torque_acomp_checklist_set`). toggle/add/remove/rename são todas
 * mutações do mesmo array, computadas no cliente pelo módulo puro checklist.ts;
 * aqui só persistimos o resultado. A RPC decide o AUTO-MOVE ATÔMICO
 * (tasks_em_aberto -> fazer_follow_up quando 100% completo, não-vazio) e devolve
 * a coluna resultante. Espelha setChecklistBoard (board de implantação, #93).
 *
 * @returns a coluna do card após a escrita ('tasks_em_aberto' | 'fazer_follow_up' | ...).
 */
export async function setChecklistAcompanhamento(
  acompId: string,
  checklist: ChecklistItem[],
): Promise<string> {
  const { data, error } = await rpcClient.rpc<string>("torque_acomp_checklist_set", {
    p_acomp_id: acompId,
    p_checklist: checklist,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
