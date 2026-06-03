// src/lib/torqueCrm/dateGate.ts
//
// Slice 4 (#94) — Board Torque CRM. Módulo PURO (sem React, sem Supabase).
//
// Gate de data da APRESENTAÇÃO (ADR 0006): a partir de 00h do DIA agendado, no
// fuso America/Sao_Paulo, a apresentação fica "concluível" e a UI libera os
// botões PRONTO e REAGENDAR. Antes do dia, só exibe a data.
//
// Por que um módulo puro além da validação SQL: a UI precisa decidir
// localmente se mostra os botões (sem round-trip), mas o servidor é a fonte da
// verdade — a RPC torque_board_pronto re-valida apresentacao_at com o MESMO
// critério (helper _torque_pode_concluir). Cliente nunca é confiável para
// liberar uma transição; aqui é só UX. Mesmo padrão dos reducers/RPC do board.
//
// Regra (ADR 0006): o gate é por DIA-CALENDÁRIO no fuso de SP, NÃO pelo
// timestamp exato — apresentação adiantada não trava. Qualquer instante a
// partir de 00:00 (horário de SP) do dia agendado libera. A comparação tem que
// lidar com virada de meia-noite e com o offset do fuso sem depender do fuso da
// máquina (usa Intl/en-CA para extrair o dia-calendário no tz alvo).

const SP_TZ = "America/Sao_Paulo";

/**
 * Retorna a data-calendário (YYYY-MM-DD) de um instante NO fuso informado.
 * en-CA formata como ISO (YYYY-MM-DD), então a string é diretamente comparável
 * lexicograficamente entre dias. Independe do fuso da máquina que roda o código.
 */
function diaCalendario(d: Date, tz: string): string {
  // pt-BR usa DD/MM/YYYY; en-CA usa YYYY-MM-DD (ordenável). Escolhemos en-CA.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * True sse `now` já alcançou (≥) 00h do DIA-CALENDÁRIO de `scheduledISO`, no
 * fuso `tz`. Em outras palavras: o dia-calendário (em `tz`) de `now` é maior ou
 * igual ao dia-calendário (em `tz`) do agendamento.
 *
 * Comparação por string YYYY-MM-DD (en-CA) no fuso alvo:
 *   - resolve a virada de meia-noite (00:00 SP do dia → libera);
 *   - resolve o offset do fuso (instante que já é "amanhã" em UTC mas ainda é
 *     véspera em SP → trava), pois os dois lados são extraídos NO MESMO tz;
 *   - é por dia, não por hora: agendamento adiantado não trava.
 *
 * @param scheduledISO timestamp ISO do agendamento (apresentacao_at). null/''
 *   → false (não há data agendada, nada a liberar).
 * @param now instante de referência (default: agora).
 * @param tz fuso IANA (default: America/Sao_Paulo).
 */
export function podeConcluir(
  scheduledISO: string | null | undefined,
  now: Date = new Date(),
  tz: string = SP_TZ,
): boolean {
  if (!scheduledISO) return false;
  const scheduled = new Date(scheduledISO);
  if (Number.isNaN(scheduled.getTime())) return false;

  const diaAgendado = diaCalendario(scheduled, tz);
  const diaAgora = diaCalendario(now, tz);
  // Strings YYYY-MM-DD comparam lexicograficamente == cronologicamente.
  return diaAgora >= diaAgendado;
}

/**
 * Offset (em minutos) do fuso `tz` em relação ao UTC no instante `d`.
 * Positivo a leste de Greenwich; SP = -180 (UTC-3, sem DST desde 2019). Calculado
 * comparando o "wall clock" do tz com o de UTC para o mesmo instante — robusto a
 * mudanças de DST de outros fusos.
 */
function tzOffsetMinutes(d: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUTC - d.getTime()) / 60000);
}

/**
 * Converte um instante (ISO/Date) para o valor de um <input type="datetime-local">
 * EXPRESSO no fuso `tz` (o input é naïve — sem fuso). Ex.: '2026-06-10T17:00:00Z'
 * em SP (UTC-3) → '2026-06-10T14:00'. '' se a entrada é nula/ inválida.
 */
export function toSpInputValue(iso: string | null | undefined, tz: string = SP_TZ): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const offset = tzOffsetMinutes(d, tz);
  const local = new Date(d.getTime() + offset * 60000);
  // Campos UTC do instante deslocado == wall clock no tz alvo.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}`;
}

/**
 * Inversa de toSpInputValue: interpreta o valor naïve de um datetime-local COMO
 * horário do fuso `tz` e devolve o instante ISO (UTC). Ex.: '2026-06-10T14:00'
 * em SP → '2026-06-10T17:00:00.000Z'. '' / inválido → null.
 */
export function fromSpInputValue(value: string | null | undefined, tz: string = SP_TZ): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, da, h, mi] = m.map(Number) as unknown as number[];
  // Trata os campos como UTC, depois corrige pelo offset do tz NAQUELE instante.
  const guessUTC = Date.UTC(y, mo - 1, da, h, mi, 0);
  const offset = tzOffsetMinutes(new Date(guessUTC), tz);
  return new Date(guessUTC - offset * 60000).toISOString();
}
