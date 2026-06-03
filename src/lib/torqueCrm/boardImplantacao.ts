// src/lib/torqueCrm/boardImplantacao.ts
//
// Slice 2 (#92) — Board Torque CRM. Módulo PURO (sem React, sem Supabase).
//
// Reducer das transições do card de implantação (ADR 0006). Esta slice cobre
// UMA transição: "Começar" promove um card de A FAZER para a coluna do seu tier
// (board_status 'a_fazer' -> 'tier'). As demais transições (marcar item ->
// apresentacao, agendar, pronto, reagendar) chegam nas slices #93–97 como novos
// casos deste reducer.
//
// Por que um módulo puro além da RPC SQL: a RPC torque_board_comecar
// (SECURITY DEFINER) roda a transição no banco com autorização; este reducer é
// o dono da REGRA de transição em TS — testável sem banco (vitest), espelhado
// pela RPC e provado de novo pela pgTAP. Mesmo padrão de migracaoSteps.ts.
import type { CrmProduto } from "@/hooks/useCrmKanban";
import { isComplete, type ChecklistItem } from "./checklist";

/** Coluna do board (espelha o CHECK crm_configuracoes.board_status, ADR 0006). */
export type BoardStatus = "a_fazer" | "tier" | "apresentacao" | "pronto";

/** Estado mínimo de um card de board relevante para as transições. */
export interface BoardCard {
  id: string;
  produto: CrmProduto;
  board_status: BoardStatus;
}

/**
 * Transição "Começar": promove o card de A FAZER para a coluna do seu tier.
 *
 * Regra (ADR 0006): única transição válida é `a_fazer -> tier`. O produto/tier
 * NÃO muda — o card já nasceu roteado pro tier mais alto (getHighestProduct) na
 * geração; "Começar" apenas o revela na coluna do tier. Função pura: não muta o
 * input, retorna um card novo.
 *
 * @throws se o card não está em 'a_fazer' (transição inválida) — blinda
 *   duplo-clique e chamadas fora de ordem; a RPC reflete o mesmo guard.
 */
export function comecar(card: BoardCard): BoardCard {
  if (card.board_status !== "a_fazer") {
    throw new Error(
      `transição inválida: "Começar" exige board_status='a_fazer', recebido '${card.board_status}'`,
    );
  }
  return { ...card, board_status: "tier" };
}

/**
 * Transição de auto-move por checklist (ADR 0006, Slice #93): quando o card está
 * na coluna de trabalho ('tier') e o checklist fica 100% completo, o card sobe
 * para 'apresentacao'. É o dono da REGRA de auto-move em TS; a RPC
 * torque_board_checklist_set reflete a mesma regra no banco (atômica) e a pgTAP
 * prova a invariante no SQL.
 *
 * Decisões (consequências de segunda ordem, ADR 0006):
 *  - ONE-WAY: só promove 'tier' -> 'apresentacao'. NUNCA rebaixa. Um card já em
 *    'apresentacao' (possivelmente já agendado) com um item desmarcado NÃO volta
 *    pra 'tier' — desfazer não pode destruir um agendamento.
 *  - Vazio não é completo (isComplete): card recém-entrado no tier não auto-move.
 *  - Idempotente: re-aplicar num card já em 'apresentacao' completo é no-op.
 *
 * Função pura: não muta o input, retorna um card novo.
 */
export function onChecklistComplete(card: BoardCard, checklist: readonly ChecklistItem[]): BoardCard {
  if (card.board_status === "tier" && isComplete(checklist)) {
    return { ...card, board_status: "apresentacao" };
  }
  return { ...card };
}

/**
 * Transição "Pronto" (Slice #94, ADR 0006): conclui a apresentação. O card sai
 * de 'apresentacao' e arquiva em PRONTOS ('pronto'). Estado terminal do board
 * de implantação — a partir daqui dispara a criação do card de Acompanhamento
 * (slice futura), fora do escopo do reducer.
 *
 * O reducer NÃO conhece datas. O gate "≥00h do dia agendado" (dateGate) é
 * pré-condição de UX e é re-validado no servidor (RPC torque_board_pronto valida
 * apresentacao_at). Aqui só blindamos a invariante de estado.
 *
 * @throws se o card não está em 'apresentacao' — blinda duplo-clique e chamadas
 *   fora de ordem; a RPC reflete o mesmo guard.
 */
export function marcarPronto(card: BoardCard): BoardCard {
  if (card.board_status !== "apresentacao") {
    throw new Error(
      `transição inválida: "Pronto" exige board_status='apresentacao', recebido '${card.board_status}'`,
    );
  }
  return { ...card, board_status: "pronto" };
}

/**
 * Transição "Reagendar" (Slice #94, ADR 0006): troca a data/hora da apresentação
 * — o card PERMANECE em 'apresentacao'. A nova data em si é gravada pela RPC
 * torque_board_agendar (apresentacao_at); o reducer só prova a invariante de
 * estado: reagendar não tira o card de 'apresentacao'.
 *
 * @throws se o card não está em 'apresentacao' — só se reagenda o que já está
 *   agendado; a RPC reflete o mesmo guard.
 */
export function reagendar(card: BoardCard): BoardCard {
  if (card.board_status !== "apresentacao") {
    throw new Error(
      `transição inválida: "Reagendar" exige board_status='apresentacao', recebido '${card.board_status}'`,
    );
  }
  return { ...card };
}
