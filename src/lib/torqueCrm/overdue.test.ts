import { describe, it, expect } from 'vitest';
import { computeOverdue } from './overdue';

// =============================================================================
// #130 — Calculadora de atraso por coluna do board Torque CRM.
//
// "dias na coluna" = diferença de DIAS-CALENDÁRIO no fuso America/Sao_Paulo
// entre stage_entered_at e now (consistente com boardEntry/dateGate: a verdade
// do dia é SP). Atrasado quando diasNaColuna > sla_days (estritamente). sla=null
// => nunca atrasado (coluna sem SLA, ex.: Prontos).
//
// FRONTEIRA CRÍTICA (o caso que mais erra): dias==sla NÃO atrasa; dias==sla+1 atrasa.
// =============================================================================

// Helpers: instantes em SP (UTC-3). 'YYYY-MM-DDThh:mm' SP -> ISO Z.
// 12:00 SP = 15:00Z. Usamos meio-dia para ficar longe da virada e isolar a
// contagem de dias-calendário (a virada tem teste próprio).
const sp = (isoLocal: string) => new Date(`${isoLocal}:00-03:00`);

describe('computeOverdue — fronteira do prazo (SLA dias inteiros)', () => {
  const tz = 'America/Sao_Paulo';

  it('dias == sla: dentro do prazo (NÃO atrasado)', () => {
    // entrou 01/06 12:00 SP; agora 03/06 12:00 SP => 2 dias-calendário.
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-01T12:00'),
      slaDays: 2,
      now: sp('2026-06-03T12:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(2);
    expect(r.atrasado).toBe(false);
    expect(r.diasAlemPrazo).toBe(0);
  });

  it('dias == sla + 1: atrasado por 1 dia', () => {
    // entrou 01/06 12:00 SP; agora 04/06 12:00 SP => 3 dias; sla=2 => atrasado 1.
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-01T12:00'),
      slaDays: 2,
      now: sp('2026-06-04T12:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(3);
    expect(r.atrasado).toBe(true);
    expect(r.diasAlemPrazo).toBe(1);
  });

  it('dia 0 (mesma data-calendário): sla=2 não atrasa', () => {
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-03T09:00'),
      slaDays: 2,
      now: sp('2026-06-03T22:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(0);
    expect(r.atrasado).toBe(false);
  });
});

describe('computeOverdue — virada de dia no fuso SP', () => {
  const tz = 'America/Sao_Paulo';

  it('conta por dia-calendário SP, não por janela de 24h', () => {
    // entrou 03/06 23:00 SP (= 04/06 02:00Z). now 04/06 01:00 SP (= 04/06 04:00Z).
    // Só 2h reais se passaram, MAS já virou o dia-calendário em SP: 1 dia.
    const entered = new Date('2026-06-03T23:00:00-03:00');
    const now = new Date('2026-06-04T01:00:00-03:00');
    const r = computeOverdue({ stageEnteredAt: entered, slaDays: 5, now, tz });
    expect(r.diasNaColuna).toBe(1);
    expect(r.atrasado).toBe(false);
  });

  it('mesma janela de 24h mas mesmo dia-calendário SP: 0 dias', () => {
    // entrou 03/06 01:00 SP; now 03/06 23:00 SP. 22h reais, mesmo dia SP => 0.
    const entered = new Date('2026-06-03T01:00:00-03:00');
    const now = new Date('2026-06-03T23:00:00-03:00');
    const r = computeOverdue({ stageEnteredAt: entered, slaDays: 5, now, tz });
    expect(r.diasNaColuna).toBe(0);
  });

  it('instante UTC que já virou mas em SP ainda é véspera conta como mesmo dia', () => {
    // entrou 03/06 22:00 SP (= 04/06 01:00Z). now 03/06 23:00 SP (= 04/06 02:00Z).
    // Em UTC os dois são dia 04; em SP ambos são dia 03 => 0 dias.
    const entered = new Date('2026-06-04T01:00:00Z');
    const now = new Date('2026-06-04T02:00:00Z');
    const r = computeOverdue({ stageEnteredAt: entered, slaDays: 5, now, tz });
    expect(r.diasNaColuna).toBe(0);
  });
});

describe('computeOverdue — sem SLA e entradas degeneradas', () => {
  const tz = 'America/Sao_Paulo';
  const now = new Date('2026-06-30T12:00:00-03:00');

  it('slaDays = null: nunca atrasa, por mais dias que passem', () => {
    const r = computeOverdue({
      stageEnteredAt: new Date('2026-01-01T12:00:00-03:00'),
      slaDays: null,
      now,
      tz,
    });
    expect(r.diasNaColuna).toBeGreaterThan(100);
    expect(r.atrasado).toBe(false);
    expect(r.diasAlemPrazo).toBe(0);
  });

  it('stageEnteredAt ausente: resultado neutro (não atrasa)', () => {
    expect(computeOverdue({ stageEnteredAt: null, slaDays: 2, now, tz })).toEqual({
      diasNaColuna: 0,
      atrasado: false,
      diasAlemPrazo: 0,
      diasRestantes: null,
      estado: 'neutro',
    });
    expect(computeOverdue({ stageEnteredAt: undefined, slaDays: 2, now, tz }).atrasado).toBe(false);
  });

  it('stageEnteredAt inválido: resultado neutro', () => {
    expect(computeOverdue({ stageEnteredAt: 'lixo', slaDays: 2, now, tz }).atrasado).toBe(false);
  });

  it('relógio à frente (entered no futuro): diasNaColuna clamped a 0, não atrasa', () => {
    const r = computeOverdue({
      stageEnteredAt: new Date('2026-07-05T12:00:00-03:00'),
      slaDays: 2,
      now,
      tz,
    });
    expect(r.diasNaColuna).toBe(0);
    expect(r.atrasado).toBe(false);
  });

  it('aceita stageEnteredAt como string ISO (vinda do supabase)', () => {
    const r = computeOverdue({
      stageEnteredAt: '2026-06-25T15:00:00Z', // 12:00 SP do dia 25
      slaDays: 2,
      now,
      tz,
    });
    expect(r.diasNaColuna).toBe(5);
    expect(r.atrasado).toBe(true);
    expect(r.diasAlemPrazo).toBe(3);
  });
});

// =============================================================================
// Contador regressivo (extensão da feature de SLA do board CRM, PRD #127).
//
// Cards no prazo mostram quanto FALTA. Contrato derivado, nunca persistido:
//   diasRestantes = slaDays - diasNaColuna   (dias-calendário até atrasar)
//   estado: 'neutro' | 'ok' | 'iminente' | 'atrasado'
//     - 'neutro'   : sem SLA (slaDays=null). diasRestantes=null. Sem contador.
//     - 'ok'       : no prazo e diasRestantes >= 2. "Faltam Xd para o prazo".
//     - 'iminente' : no prazo e diasRestantes <= 1 (0 ou 1). Âmbar/warning.
//     - 'atrasado' : diasNaColuna > slaDays. Badge vermelho (já existia).
//
// COERÊNCIA com a fronteira de #130 (dias==sla NÃO atrasa; dias==sla+1 atrasa):
//   dias == sla   -> diasRestantes 0  -> 'iminente' ("vence hoje")
//   dias == sla+1 -> diasRestantes -1 -> 'atrasado'
//   dias == sla-1 -> diasRestantes 1  -> 'iminente' ("falta 1d")
//   dias == sla-2 -> diasRestantes 2  -> 'ok'       (primeiro 'ok')
// =============================================================================

describe('computeOverdue — contador regressivo: fronteira do iminente', () => {
  const tz = 'America/Sao_Paulo';

  it('diasRestantes == 2 (dias == sla-2): estado ok, ainda longe', () => {
    // entrou 01/06 12:00 SP; agora 03/06 12:00 SP => 2 dias; sla=4 => restam 2.
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-01T12:00'),
      slaDays: 4,
      now: sp('2026-06-03T12:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(2);
    expect(r.atrasado).toBe(false);
    expect(r.diasRestantes).toBe(2);
    expect(r.estado).toBe('ok');
  });

  it('diasRestantes == 1 (dias == sla-1): estado iminente ("falta 1d")', () => {
    // entrou 01/06 12:00 SP; agora 03/06 12:00 SP => 2 dias; sla=3 => resta 1.
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-01T12:00'),
      slaDays: 3,
      now: sp('2026-06-03T12:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(2);
    expect(r.atrasado).toBe(false);
    expect(r.diasRestantes).toBe(1);
    expect(r.estado).toBe('iminente');
  });

  it('diasRestantes == 0 (dias == sla): estado iminente ("vence hoje"), NÃO atrasado', () => {
    // entrou 01/06 12:00 SP; agora 03/06 12:00 SP => 2 dias; sla=2 => resta 0.
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-01T12:00'),
      slaDays: 2,
      now: sp('2026-06-03T12:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(2);
    expect(r.atrasado).toBe(false);
    expect(r.diasRestantes).toBe(0);
    expect(r.estado).toBe('iminente');
  });

  it('diasRestantes negativo (dias == sla+1): estado atrasado', () => {
    // entrou 01/06 12:00 SP; agora 04/06 12:00 SP => 3 dias; sla=2 => -1.
    const r = computeOverdue({
      stageEnteredAt: sp('2026-06-01T12:00'),
      slaDays: 2,
      now: sp('2026-06-04T12:00'),
      tz,
    });
    expect(r.diasNaColuna).toBe(3);
    expect(r.atrasado).toBe(true);
    expect(r.diasRestantes).toBe(-1);
    expect(r.estado).toBe('atrasado');
  });
});

describe('computeOverdue — contador regressivo: sem SLA e virada de dia', () => {
  const tz = 'America/Sao_Paulo';

  it('slaDays = null: estado neutro, diasRestantes null, sem contador', () => {
    const r = computeOverdue({
      stageEnteredAt: sp('2026-01-01T12:00'),
      slaDays: null,
      now: sp('2026-06-30T12:00'),
      tz,
    });
    expect(r.atrasado).toBe(false);
    expect(r.diasRestantes).toBeNull();
    expect(r.estado).toBe('neutro');
  });

  it('virada de dia SP encolhe diasRestantes: ok -> iminente ao cruzar 00h SP', () => {
    // sla=2. entrou 02/06 23:00 SP. Às 02/06 23:30 SP => 0 dias, restam 2 (ok).
    const antes = computeOverdue({
      stageEnteredAt: sp('2026-06-02T23:00'),
      slaDays: 2,
      now: sp('2026-06-02T23:30'),
      tz,
    });
    expect(antes.diasNaColuna).toBe(0);
    expect(antes.diasRestantes).toBe(2);
    expect(antes.estado).toBe('ok');

    // 30min reais depois, mas já virou 03/06 00:30 SP => 1 dia, resta 1 (iminente).
    const depois = computeOverdue({
      stageEnteredAt: sp('2026-06-02T23:00'),
      slaDays: 2,
      now: sp('2026-06-03T00:30'),
      tz,
    });
    expect(depois.diasNaColuna).toBe(1);
    expect(depois.diasRestantes).toBe(1);
    expect(depois.estado).toBe('iminente');
  });

  it('stageEnteredAt ausente com SLA: neutro (não há entrada para contar)', () => {
    const r = computeOverdue({
      stageEnteredAt: null,
      slaDays: 2,
      now: sp('2026-06-30T12:00'),
      tz,
    });
    expect(r.estado).toBe('neutro');
    expect(r.diasRestantes).toBeNull();
  });
});

// =============================================================================
// Contrato de display do card (CrmBoardKanban). O card NÃO reimplementa regra:
// deriva a cópia 1:1 de { estado, diasRestantes }. Esta tabela trava esse mapa
// para que mudança no módulo que quebre a cópia falhe aqui, não em produção.
// =============================================================================

/** Espelha a derivação de cópia do BoardCard. Fonte única: estado + diasRestantes. */
function slaLabel(r: { estado: string; diasRestantes: number | null; diasAlemPrazo: number }):
  string | null {
  switch (r.estado) {
    case 'neutro':
      return null; // sem contador
    case 'ok':
      return `Faltam ${r.diasRestantes}d para o prazo`;
    case 'iminente':
      return r.diasRestantes === 0 ? 'Vence hoje' : 'Falta 1d';
    case 'atrasado':
      return `⚠️ Atrasado — ${r.diasAlemPrazo}d além do prazo`;
    default:
      return null;
  }
}

describe('contador regressivo — contrato de cópia do card por estado', () => {
  const tz = 'America/Sao_Paulo';
  const enteredAt = sp('2026-06-01T12:00');
  const now = sp('2026-06-03T12:00'); // sempre 2 dias na coluna

  it('sla=4 (restam 2): "Faltam 2d para o prazo"', () => {
    const r = computeOverdue({ stageEnteredAt: enteredAt, slaDays: 4, now, tz });
    expect(slaLabel(r)).toBe('Faltam 2d para o prazo');
  });

  it('sla=3 (resta 1): "Falta 1d" (âmbar)', () => {
    const r = computeOverdue({ stageEnteredAt: enteredAt, slaDays: 3, now, tz });
    expect(slaLabel(r)).toBe('Falta 1d');
  });

  it('sla=2 (resta 0): "Vence hoje" (âmbar)', () => {
    const r = computeOverdue({ stageEnteredAt: enteredAt, slaDays: 2, now, tz });
    expect(slaLabel(r)).toBe('Vence hoje');
  });

  it('sla=1 (1 dia além): badge atrasado intacto (sem regressão)', () => {
    const r = computeOverdue({ stageEnteredAt: enteredAt, slaDays: 1, now, tz });
    expect(slaLabel(r)).toBe('⚠️ Atrasado — 1d além do prazo');
  });

  it('sla=null: card sem linha de SLA (null)', () => {
    const r = computeOverdue({ stageEnteredAt: enteredAt, slaDays: null, now, tz });
    expect(slaLabel(r)).toBeNull();
  });
});
