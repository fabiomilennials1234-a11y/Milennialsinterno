// src/lib/torqueCrm/boardRpc.ts
//
// Slice 2 (#92) — Board Torque CRM. Wrappers TIPADOS das RPCs do board (ADR 0006).
//
// A ÚNICA forma de ESCREVER no card de board (crm_configuracoes.board_status e a
// criação do card) é via estas funções → RPC SECURITY DEFINER. Nada de INSERT/
// UPDATE cru no client (ADR §92.3). A regra de transição vive no reducer puro
// boardImplantacao.ts (testado em vitest); aqui é só o canal tipado pro banco.
//
// As RPCs vivem em public (não em schema 'board'): o módulo CRM ainda não foi
// extraído pelo strangler. Chamadas via supabase.rpc(name, args) — sem .schema().
import { supabase } from "@/integrations/supabase/client";
import type { CrmProduto } from "@/hooks/useCrmKanban";
import type { ChecklistItem } from "./checklist";

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};
const rpcClient = supabase as unknown as RpcClient;

/**
 * Cria/garante o card de board de um cliente, roteado pro tier, NASCENDO em
 * A FAZER (contrato `torque_board_gerar`). Idempotente por (client_id,produto):
 * se já existe, devolve o id existente sem alterar o card.
 * @returns o id do card (crm_configuracoes.id).
 */
export async function gerarCardBoard(params: {
  clientId: string;
  gestorId: string;
  produto: CrmProduto;
  formData?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await rpcClient.rpc<string>("torque_board_gerar", {
    p_client_id: params.clientId,
    p_gestor_id: params.gestorId,
    p_produto: params.produto,
    p_form_data: params.formData ?? {},
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * "Começar": promove o card de A FAZER pra coluna do seu tier (contrato
 * `torque_board_comecar`). Espelha boardImplantacao.comecar(); a RPC rejeita
 * card fora de A FAZER (guard de transição / duplo-clique).
 */
export async function comecarCardBoard(configId: string): Promise<void> {
  const { error } = await rpcClient.rpc<void>("torque_board_comecar", {
    p_config_id: configId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Substitui o checklist INTEIRO de um card (contrato `torque_board_checklist_set`)
 * — toggle/add/remove/rename são todas mutações do mesmo array, computadas no
 * cliente pelo módulo puro checklist.ts; aqui só persistimos o resultado. A RPC
 * decide o auto-move atômico (tier->apresentacao no 100%) e devolve o
 * board_status resultante.
 * @returns o board_status do card após a escrita ('tier' | 'apresentacao' | ...).
 */
export async function setChecklistBoard(
  configId: string,
  checklist: ChecklistItem[],
): Promise<string> {
  const { data, error } = await rpcClient.rpc<string>("torque_board_checklist_set", {
    p_config_id: configId,
    p_checklist: checklist,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Agenda (ou REAGENDA) a apresentação de um card (contrato `torque_board_agendar`).
 * Grava `apresentacao_at`; o card precisa estar em 'apresentacao' (a RPC rejeita
 * fora dela). Primeiro agendamento e reagendamento são a MESMA operação — só
 * gravar a nova data; o card permanece em 'apresentacao' (espelha
 * boardImplantacao.reagendar).
 *
 * @param apresentacaoAt timestamp ISO (a UI compõe data+hora no fuso de SP).
 */
export async function agendarApresentacao(configId: string, apresentacaoAt: string): Promise<void> {
  const { error } = await rpcClient.rpc<void>("torque_board_agendar", {
    p_config_id: configId,
    p_apresentacao_at: apresentacaoAt,
  });
  if (error) throw new Error(error.message);
}

/**
 * "Pronto": conclui a apresentação e arquiva o card em PRONTOS (contrato
 * `torque_board_pronto`, board_status 'apresentacao' -> 'pronto'). Espelha
 * boardImplantacao.marcarPronto(). A RPC re-valida o GATE DE DATA no servidor
 * (apresentacao_at ≥ 00h do dia agendado, fuso SP) — o cliente nunca é confiável
 * para liberar a transição; o botão é só UX.
 */
export async function marcarProntoCard(configId: string): Promise<void> {
  const { error } = await rpcClient.rpc<void>("torque_board_pronto", {
    p_config_id: configId,
  });
  if (error) throw new Error(error.message);
}
