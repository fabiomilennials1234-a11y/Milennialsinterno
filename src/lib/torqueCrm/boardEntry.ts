// =============================================================================
// #128 — Entrada no board (módulo puro). Board Torque CRM.
//
// Um card "entrou no board" no instante de seu created_at. Esta linha — "No
// board desde DD/MM" — aparece em TODA coluna do board (a_fazer..pronto), dando
// ao gestor a noção de há quanto tempo o cliente está em implantação.
//
// FUSO: a verdade do dia-calendário é America/Sao_Paulo (mesma decisão das RPCs
// de gate de data, ADR 0006). Um card criado às 22h SP do dia 03 (já 01h UTC do
// dia 04) está "no board desde 03/06" — o dia de SP, não o de UTC.
//
// Puro e determinístico: recebe a string ISO do created_at, devolve a linha.
// Não lê o relógio nem persiste nada.
// =============================================================================

const SP_TZ = 'America/Sao_Paulo';

const dayMonthFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: SP_TZ,
});

/**
 * Formata o created_at (timestamptz ISO) de um card como "No board desde DD/MM"
 * no fuso America/Sao_Paulo. Retorna null para entrada inválida/ausente — quem
 * renderiza decide não mostrar a linha (sem texto quebrado na UI).
 */
export function boardEntryLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  // pt-BR com 2-digit já produz "DD/MM".
  return `No board desde ${dayMonthFmt.format(date)}`;
}
