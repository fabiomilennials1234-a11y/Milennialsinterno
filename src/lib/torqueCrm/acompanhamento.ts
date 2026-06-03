// src/lib/torqueCrm/acompanhamento.ts
//
// Slice 5 (#95) — Board de Acompanhamentos (pós-implantação). ADR 0006 §2.
// Módulo PURO (sem React, sem Supabase): dono das 4 colunas e da regra de
// "drag livre". É o espelho TS da tabela crm_acompanhamentos.coluna (CHECK) e
// da RPC torque_acomp_mover (guard de coluna no servidor) — testável sem banco.
//
// "Mundos separados" (ADR §2): este board é INDEPENDENTE do card de implantação
// (crm_configuracoes). Aqui não há board_status, tier nem checklist de steps —
// só a coluna do ciclo de relacionamento. O checklist de "Tasks em aberto"
// (Slice #96) reusa o módulo genérico ./checklist.ts, não este.

/** As 4 colunas do board de Acompanhamentos, na ordem de exibição (ADR §2). */
export const ACOMP_COLUNAS = [
  "fazer_follow_up",
  "follow_up_feito",
  "tasks_em_aberto",
  "aguardando_resposta",
] as const;

/** Coluna do board de Acompanhamentos (espelha crm_acompanhamentos.coluna CHECK). */
export type AcompColuna = (typeof ACOMP_COLUNAS)[number];

/** Rótulos humanos das colunas. */
export const ACOMP_COLUNA_LABEL: Record<AcompColuna, string> = {
  fazer_follow_up: "Fazer follow-up",
  follow_up_feito: "Follow-up feito",
  tasks_em_aberto: "Tasks em aberto",
  aguardando_resposta: "Aguardando resposta",
};

/**
 * Coluna em que o card NASCE (ADR §2): ao cair em PRONTOS no board de
 * implantação, o gancho cria o acompanhamento entrando em "Fazer follow-up".
 */
export const ACOMP_COLUNA_INICIAL: AcompColuna = "fazer_follow_up";

/** Estado mínimo de um card de acompanhamento relevante para o drag. */
export interface AcompCard {
  id: string;
  coluna: AcompColuna;
}

/** Type-guard: `x` é uma coluna canônica do board de Acompanhamentos. */
export function isAcompColuna(x: unknown): x is AcompColuna {
  return typeof x === "string" && (ACOMP_COLUNAS as readonly string[]).includes(x);
}

/**
 * Drag livre (ADR §2): move o card para `destino`. Card vive em exatamente uma
 * coluna; o gestor move manualmente, em qualquer ordem — SEM gate sequencial.
 * Mover para a própria coluna é no-op tolerante (idempotente contra re-drop).
 * Função pura: não muta o input, retorna um card novo.
 *
 * @throws se `destino` não é uma coluna válida — blinda payload corrompido do
 *   drag; a RPC torque_acomp_mover reflete o mesmo guard no servidor.
 */
export function mover(card: AcompCard, destino: AcompColuna): AcompCard {
  if (!isAcompColuna(destino)) {
    throw new Error(`acompanhamento: coluna inválida '${destino}'`);
  }
  return { ...card, coluna: destino };
}
