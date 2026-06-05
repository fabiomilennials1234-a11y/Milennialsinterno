// =============================================================================
// #130 — Resolver de SLA do board Torque CRM (módulo puro).
//
// Mapeia um card (board_status, produto) para o max_days da sua COLUNA LÓGICA.
// A coluna lógica é board_status, EXCETO quando board_status='tier', caso em que
// a coluna é o próprio produto (torque/automation/copilot) — espelha columnOf()
// de CrmBoardKanban, mas puro/testável.
//
// O SlaMap (coluna -> max_days) vem da tabela crm_sla (#129). Coluna ausente do
// mapa => sem SLA (null), idêntico a 'pronto' (estado terminal).
// =============================================================================

/** Coluna lógica do board: chave de SLA. */
export type SlaColumn =
  | 'a_fazer'
  | 'torque'
  | 'automation'
  | 'copilot'
  | 'apresentacao'
  | 'pronto';

/** coluna lógica -> max_days (vindo do DB). max_days null/ausente = sem SLA. */
export type SlaMap = Partial<Record<SlaColumn, number | null>>;

/**
 * Coluna lógica de um card. board_status='tier' desdobra pelo produto; qualquer
 * outro board_status é a própria coluna.
 */
export function resolveSlaColumn(boardStatus: string, produto: string): string {
  return boardStatus === 'tier' ? produto : boardStatus;
}

/**
 * max_days da coluna lógica de um card. Sem SLA (coluna ausente do mapa ou
 * max_days null, ex.: 'pronto') => null. Nunca devolve undefined.
 */
export function resolveSlaDays(
  slaMap: SlaMap,
  boardStatus: string,
  produto: string,
): number | null {
  const col = resolveSlaColumn(boardStatus, produto) as SlaColumn;
  return slaMap[col] ?? null;
}
