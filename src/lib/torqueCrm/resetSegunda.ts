// src/lib/torqueCrm/resetSegunda.ts
//
// Slice 6 (#96) — Reset semanal do board de Acompanhamentos. ADR 0006 §2 + HITL #4.
//
// Módulo PURO (sem React, sem Supabase): a fonte única de QUAIS colunas resetam
// e para ONDE, no reset de toda segunda 00h (fuso America/Sao_Paulo). É o espelho
// TS da função SQL _cron_torque_acomp_reset_segunda — ambos provados (vitest +
// pgTAP). Manter as duas verdades alinhadas mata "o cron resetou a coluna errada".
//
// REGRA (ADR §2, ampliada pelo HITL #4 do fundador): cards em "Follow-up feito" E
// "Aguardando resposta" voltam para "Fazer follow-up". "Tasks em aberto" fica
// INTACTO — é o checklist de pendências que o gestor montou, não um estado de
// follow-up que expira na semana.

import type { AcompColuna } from "./acompanhamento";

/** Coluna para onde os cards elegíveis voltam no reset de segunda. */
export const COLUNA_DESTINO_RESET: AcompColuna = "fazer_follow_up";

/**
 * Colunas cujos cards RESETAM toda segunda (ADR §2 + HITL #4). Exatamente duas:
 * follow_up_feito e aguardando_resposta. tasks_em_aberto e fazer_follow_up NÃO
 * resetam (o destino não é origem; o checklist do gestor é intocável).
 * Retorna um array novo a cada chamada — ninguém muta a fonte da verdade.
 */
export function colunasQueResetam(): AcompColuna[] {
  return ["follow_up_feito", "aguardando_resposta"];
}

/**
 * True sse um card na coluna `coluna` seria movido pelo reset de segunda.
 * Coluna inválida → false (defesa: o reset nunca toca o que não reconhece).
 */
export function resetariaCard(coluna: AcompColuna): boolean {
  return (colunasQueResetam() as readonly string[]).includes(coluna);
}
