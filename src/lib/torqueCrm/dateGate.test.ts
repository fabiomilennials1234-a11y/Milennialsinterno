import { describe, it, expect } from "vitest";
import { podeConcluir, toSpInputValue, fromSpInputValue } from "./dateGate";

// =============================================================
// Slice 4 (#94) — Board Torque CRM. Módulo PURO (sem React, sem Supabase).
//
// dateGate.podeConcluir(scheduledISO, now, tz): a apresentação fica "concluível"
// (libera os botões PRONTO/REAGENDAR) a partir de 00h do DIA agendado, no fuso
// America/Sao_Paulo (ADR 0006). Antes do dia: só exibe a data, sem botões.
//
// Invariante (ADR 0006): o gate é por DIA-CALENDÁRIO no fuso de SP, NÃO pelo
// timestamp exato. Apresentação adiantada não trava — qualquer instante a partir
// de 00:00 (horário de SP) do dia agendado libera. A comparação tem que lidar
// com a virada de meia-noite e com o offset do fuso (SP = UTC-3, sem DST desde
// 2019), sem depender do fuso da máquina que roda o teste.
// =============================================================

const SP = "America/Sao_Paulo";

describe("podeConcluir — gate de data (≥ 00h do dia agendado, fuso SP)", () => {
  it("ANTES do dia agendado → false (véspera, mesmo às 23:59 SP)", () => {
    // Agendado para 2026-06-10 14:00 SP (= 17:00Z). 'now' = 2026-06-09 23:59 SP.
    const scheduled = "2026-06-10T17:00:00.000Z";
    const now = new Date("2026-06-10T02:59:00.000Z"); // 2026-06-09 23:59 SP
    expect(podeConcluir(scheduled, now, SP)).toBe(false);
  });

  it("NO dia agendado, às 00:00 SP em ponto → true (vira a meia-noite libera)", () => {
    // Agendado 2026-06-10 14:00 SP. 'now' = 2026-06-10 00:00 SP (= 03:00Z).
    const scheduled = "2026-06-10T17:00:00.000Z";
    const now = new Date("2026-06-10T03:00:00.000Z"); // 2026-06-10 00:00 SP
    expect(podeConcluir(scheduled, now, SP)).toBe(true);
  });

  it("NO dia agendado, antes da hora marcada → true (gate é por dia, não por hora)", () => {
    // Agendado 2026-06-10 14:00 SP; 'now' = 2026-06-10 09:00 SP. Adiantado libera.
    const scheduled = "2026-06-10T17:00:00.000Z";
    const now = new Date("2026-06-10T12:00:00.000Z"); // 2026-06-10 09:00 SP
    expect(podeConcluir(scheduled, now, SP)).toBe(true);
  });

  it("DEPOIS do dia agendado → true", () => {
    const scheduled = "2026-06-10T17:00:00.000Z";
    const now = new Date("2026-06-12T12:00:00.000Z"); // 2026-06-12 SP
    expect(podeConcluir(scheduled, now, SP)).toBe(true);
  });

  it("virada de meia-noite: 23:59:59 SP da véspera → false; +1s (00:00:00 SP) → true", () => {
    const scheduled = "2026-06-10T17:00:00.000Z";
    const justBefore = new Date("2026-06-10T02:59:59.000Z"); // 2026-06-09 23:59:59 SP
    const atMidnight = new Date("2026-06-10T03:00:00.000Z"); // 2026-06-10 00:00:00 SP
    expect(podeConcluir(scheduled, justBefore, SP)).toBe(false);
    expect(podeConcluir(scheduled, atMidnight, SP)).toBe(true);
  });

  it("fuso SP (UTC-3): um instante UTC que já é 'amanhã' em UTC mas ainda é véspera em SP → false", () => {
    // Agendado 2026-06-10 (qualquer hora) SP. 'now' = 2026-06-10 01:00Z = ainda
    // 2026-06-09 22:00 SP. Em UTC já é dia 10; em SP ainda é dia 9 → trava.
    const scheduled = "2026-06-10T13:00:00.000Z"; // 2026-06-10 10:00 SP
    const now = new Date("2026-06-10T01:00:00.000Z"); // 2026-06-09 22:00 SP
    expect(podeConcluir(scheduled, now, SP)).toBe(false);
  });

  it("borda do agendamento perto da meia-noite SP: scheduled 2026-06-10 00:30 SP, now 2026-06-10 00:10 SP → true (mesmo dia)", () => {
    // scheduled = 2026-06-10 00:30 SP = 03:30Z. now = 2026-06-10 00:10 SP = 03:10Z.
    // Mesmo dia-calendário SP, antes da hora marcada → libera (gate por dia).
    const scheduled = "2026-06-10T03:30:00.000Z";
    const now = new Date("2026-06-10T03:10:00.000Z");
    expect(podeConcluir(scheduled, now, SP)).toBe(true);
  });

  it("null/empty scheduled → false (não há data agendada, nada a liberar)", () => {
    const now = new Date("2026-06-10T03:00:00.000Z");
    expect(podeConcluir(null, now, SP)).toBe(false);
    expect(podeConcluir("", now, SP)).toBe(false);
  });

  it("default tz é America/Sao_Paulo quando omitido", () => {
    const scheduled = "2026-06-10T17:00:00.000Z";
    const beforeSP = new Date("2026-06-10T02:59:00.000Z"); // véspera SP
    const onDaySP = new Date("2026-06-10T03:00:00.000Z"); // dia SP
    expect(podeConcluir(scheduled, beforeSP)).toBe(false);
    expect(podeConcluir(scheduled, onDaySP)).toBe(true);
  });
});

// =============================================================
// Conversão datetime-local <-> ISO no fuso SP (UI de agendar/reagendar).
// O <input type="datetime-local"> é naïve; gravamos/lemos sempre em SP.
// =============================================================
describe("toSpInputValue / fromSpInputValue (fuso SP, UTC-3)", () => {
  it("toSpInputValue: instante UTC -> wall clock SP (input naïve)", () => {
    expect(toSpInputValue("2026-06-10T17:00:00.000Z", SP)).toBe("2026-06-10T14:00");
  });

  it("toSpInputValue: vira o dia ao converter (00:00Z -> 21:00 do dia anterior SP)", () => {
    expect(toSpInputValue("2026-06-10T00:00:00.000Z", SP)).toBe("2026-06-09T21:00");
  });

  it("toSpInputValue: null/'' -> ''", () => {
    expect(toSpInputValue(null, SP)).toBe("");
    expect(toSpInputValue("", SP)).toBe("");
  });

  it("fromSpInputValue: wall clock SP -> instante UTC (+3h)", () => {
    expect(fromSpInputValue("2026-06-10T14:00", SP)).toBe("2026-06-10T17:00:00.000Z");
  });

  it("fromSpInputValue: ''/inválido -> null", () => {
    expect(fromSpInputValue("", SP)).toBeNull();
    expect(fromSpInputValue("lixo", SP)).toBeNull();
  });

  it("round-trip ISO -> input -> ISO preserva o instante", () => {
    const iso = "2026-07-01T18:30:00.000Z";
    const back = fromSpInputValue(toSpInputValue(iso, SP), SP);
    expect(back).toBe(iso);
  });
});
