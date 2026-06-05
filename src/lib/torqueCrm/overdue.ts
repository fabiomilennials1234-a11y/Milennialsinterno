// =============================================================================
// #130 — Calculadora de atraso por coluna do board Torque CRM (módulo puro).
//
// "dias na coluna" = diferença de DIAS-CALENDÁRIO no fuso America/Sao_Paulo
// entre stage_entered_at e now. Por dia-calendário (não janelas de 24h), igual
// a boardEntry/dateGate: a verdade do dia é SP — um card que entrou 23h SP de
// ontem "está há 1 dia na coluna" assim que vira 00h SP de hoje.
//
// REGRA DE ATRASO: atrasado sse diasNaColuna > slaDays (estrito). Logo:
//   dias == sla     -> ainda no prazo (NÃO atrasa)  <- fronteira que mais erra
//   dias == sla + 1 -> atrasado por 1 dia
//   slaDays == null -> nunca atrasa (coluna sem SLA, ex.: Prontos)
//
// Puro e determinístico: recebe now por injeção (não lê relógio). Extrai a
// lógica que vivia impura em OutboundOnboardingSection (new Date()+differenceInDays
// sem fuso), agora testável e correta no fuso.
// =============================================================================

export interface OverdueInput {
  stageEnteredAt: Date | string | null | undefined;
  slaDays: number | null;
  now: Date;
  tz?: string;
}

export interface OverdueResult {
  diasNaColuna: number;
  atrasado: boolean;
  diasAlemPrazo: number;
}

const DEFAULT_TZ = 'America/Sao_Paulo';

/** Data-calendário (Y/M/D) de um instante no fuso dado, como inteiros. */
function calendarParts(date: Date, tz: string): { y: number; m: number; d: number } {
  // en-CA -> "YYYY-MM-DD"; timeZone projeta o instante no fuso alvo.
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('-')
    .map(Number);
  return { y, m, d };
}

/** Dias-calendário entre dois instantes no fuso dado (b - a). */
function calendarDaysBetween(a: Date, b: Date, tz: string): number {
  const pa = calendarParts(a, tz);
  const pb = calendarParts(b, tz);
  // UTC midnight das datas-calendário -> subtração imune a DST.
  const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
  const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((ub - ua) / 86_400_000);
}

const NO_OVERDUE: OverdueResult = { diasNaColuna: 0, atrasado: false, diasAlemPrazo: 0 };

export function computeOverdue(input: OverdueInput): OverdueResult {
  const { stageEnteredAt, slaDays, now, tz = DEFAULT_TZ } = input;

  if (!stageEnteredAt) return NO_OVERDUE;
  const entered = stageEnteredAt instanceof Date ? stageEnteredAt : new Date(stageEnteredAt);
  if (Number.isNaN(entered.getTime())) return NO_OVERDUE;

  // Nunca negativo: relógio do servidor pode estar marginalmente à frente do client.
  const diasNaColuna = Math.max(0, calendarDaysBetween(entered, now, tz));

  // Sem SLA (coluna terminal/sem prazo) -> nunca atrasa.
  if (slaDays == null) {
    return { diasNaColuna, atrasado: false, diasAlemPrazo: 0 };
  }

  const atrasado = diasNaColuna > slaDays;
  return {
    diasNaColuna,
    atrasado,
    diasAlemPrazo: atrasado ? diasNaColuna - slaDays : 0,
  };
}
