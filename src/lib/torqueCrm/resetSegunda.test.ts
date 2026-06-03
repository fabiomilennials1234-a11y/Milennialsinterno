// src/lib/torqueCrm/resetSegunda.test.ts
//
// Slice 6 (#96) — Reset semanal do board de Acompanhamentos. ADR 0006 §2 + HITL #4.
// vitest do módulo PURO: contrato de QUAIS colunas resetam e para ONDE. É a fonte
// única que a função SQL _cron_torque_acomp_reset_segunda espelha (toda segunda
// 00h America/Sao_Paulo: follow_up_feito E aguardando_resposta voltam pra
// fazer_follow_up; tasks_em_aberto fica INTACTO).

import { describe, it, expect } from "vitest";
import {
  colunasQueResetam,
  COLUNA_DESTINO_RESET,
  resetariaCard,
} from "./resetSegunda";
import { ACOMP_COLUNAS, type AcompColuna } from "./acompanhamento";

describe("colunasQueResetam — contrato do reset de segunda (ADR 0006 §2 + HITL #4)", () => {
  it("reseta EXATAMENTE follow_up_feito e aguardando_resposta", () => {
    expect(colunasQueResetam()).toEqual(["follow_up_feito", "aguardando_resposta"]);
  });

  it("NÃO inclui tasks_em_aberto (fica intacto — checklist do gestor)", () => {
    expect(colunasQueResetam()).not.toContain("tasks_em_aberto");
  });

  it("NÃO inclui fazer_follow_up (destino, não origem)", () => {
    expect(colunasQueResetam()).not.toContain("fazer_follow_up");
  });

  it("só contém colunas canônicas do board de acompanhamentos", () => {
    for (const c of colunasQueResetam()) {
      expect((ACOMP_COLUNAS as readonly string[]).includes(c)).toBe(true);
    }
  });
});

describe("COLUNA_DESTINO_RESET — para onde os cards voltam", () => {
  it("é fazer_follow_up", () => {
    expect(COLUNA_DESTINO_RESET).toBe("fazer_follow_up");
  });
});

describe("resetariaCard — predicado de elegibilidade ao reset", () => {
  it("true para as 2 colunas que resetam", () => {
    expect(resetariaCard("follow_up_feito")).toBe(true);
    expect(resetariaCard("aguardando_resposta")).toBe(true);
  });

  it("false para tasks_em_aberto e fazer_follow_up", () => {
    expect(resetariaCard("tasks_em_aberto")).toBe(false);
    expect(resetariaCard("fazer_follow_up")).toBe(false);
  });

  it("false para coluna inválida (defesa)", () => {
    expect(resetariaCard("pronto" as AcompColuna)).toBe(false);
  });
});
