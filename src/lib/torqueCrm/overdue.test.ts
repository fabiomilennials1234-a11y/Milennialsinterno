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
