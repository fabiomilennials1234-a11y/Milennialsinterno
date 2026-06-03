// src/lib/torqueCrm/acompanhamento.test.ts
//
// Slice 5 (#95) — Board de Acompanhamentos (pós-implantação). ADR 0006 §2.
// vitest do módulo PURO de domínio: colunas válidas + transição de drag livre.

import { describe, it, expect } from "vitest";
import {
  ACOMP_COLUNAS,
  ACOMP_COLUNA_LABEL,
  ACOMP_COLUNA_INICIAL,
  isAcompColuna,
  mover,
  type AcompColuna,
  type AcompCard,
} from "./acompanhamento";

describe("ACOMP_COLUNAS — contrato das 4 colunas (ADR 0006 §2)", () => {
  it("são exatamente 4, na ordem do board", () => {
    expect(ACOMP_COLUNAS).toEqual([
      "fazer_follow_up",
      "follow_up_feito",
      "tasks_em_aberto",
      "aguardando_resposta",
    ]);
  });

  it("card de acompanhamento nasce em fazer_follow_up (entra ao cair em PRONTOS)", () => {
    expect(ACOMP_COLUNA_INICIAL).toBe("fazer_follow_up");
  });

  it("toda coluna tem label humano não-vazio", () => {
    for (const c of ACOMP_COLUNAS) {
      expect(ACOMP_COLUNA_LABEL[c]?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("isAcompColuna — guarda de coluna válida", () => {
  it("aceita as 4 colunas canônicas", () => {
    for (const c of ACOMP_COLUNAS) expect(isAcompColuna(c)).toBe(true);
  });

  it("rejeita lixo / colunas do board de implantação / vazio", () => {
    expect(isAcompColuna("pronto")).toBe(false);
    expect(isAcompColuna("a_fazer")).toBe(false);
    expect(isAcompColuna("")).toBe(false);
    expect(isAcompColuna("FAZER_FOLLOW_UP")).toBe(false);
  });
});

describe("mover — drag livre entre colunas (ADR 0006 §2: card vive em 1 coluna)", () => {
  const base: AcompCard = { id: "ac-1", coluna: "fazer_follow_up" };

  it("move para qualquer coluna válida (sem gate sequencial)", () => {
    expect(mover(base, "aguardando_resposta")).toEqual({
      id: "ac-1",
      coluna: "aguardando_resposta",
    });
    expect(mover(base, "tasks_em_aberto").coluna).toBe("tasks_em_aberto");
  });

  it("é pura — não muta o card de entrada", () => {
    const r = mover(base, "follow_up_feito");
    expect(base.coluna).toBe("fazer_follow_up");
    expect(r).not.toBe(base);
  });

  it("mover para a mesma coluna é no-op tolerante (idempotente)", () => {
    expect(mover(base, "fazer_follow_up").coluna).toBe("fazer_follow_up");
  });

  it("rejeita coluna-destino inválida (blinda payload corrompido do drag)", () => {
    expect(() => mover(base, "pronto" as AcompColuna)).toThrow(/coluna inválida/i);
    expect(() => mover(base, "" as AcompColuna)).toThrow(/coluna inválida/i);
  });
});
