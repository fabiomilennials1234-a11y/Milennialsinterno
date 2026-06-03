import { describe, it, expect } from "vitest";
import {
  seed,
  toggle,
  add,
  remove,
  rename,
  isComplete,
  progress,
  type ChecklistItem,
} from "./checklist";

// =============================================================
// Slice 3 (#93) — Board Torque CRM. Módulo PURO e GENÉRICO (sem React, sem
// Supabase, sem dependência de CRM). Será REUSADO na aba Acompanhamentos
// "Tasks em aberto" (ADR 0006 §2) — por isso opera sobre ChecklistItem[] cru,
// não importa nada de useCrmKanban. O seed a partir dos steps do tier é um
// adapter fino fora deste módulo.
//
// Invariantes (ADR 0006):
//   - marcar/desmarcar em QUALQUER ordem (sem gate sequencial);
//   - add/remove/rename por item;
//   - isComplete: TODOS done E lista não-vazia (vazio nunca é "completo");
//   - todas as ops são PURAS (não mutam o input).
// =============================================================

function items(): ChecklistItem[] {
  return [
    { id: "a", label: "A", done: false },
    { id: "b", label: "B", done: true },
    { id: "c", label: "C", done: false },
  ];
}

describe("seed", () => {
  it("monta o checklist a partir de pares {id,label}, todos done=false", () => {
    const out = seed([
      { id: "x", label: "X" },
      { id: "y", label: "Y" },
    ]);
    expect(out).toEqual([
      { id: "x", label: "X", done: false },
      { id: "y", label: "Y", done: false },
    ]);
  });

  it("lista vazia → checklist vazio", () => {
    expect(seed([])).toEqual([]);
  });
});

describe("toggle", () => {
  it("marca um item não-feito (em qualquer ordem, sem gate)", () => {
    const out = toggle(items(), "c");
    expect(out.find((i) => i.id === "c")?.done).toBe(true);
  });

  it("desmarca um item feito", () => {
    const out = toggle(items(), "b");
    expect(out.find((i) => i.id === "b")?.done).toBe(false);
  });

  it("não muta o input (função pura)", () => {
    const before = items();
    toggle(before, "a");
    expect(before.find((i) => i.id === "a")?.done).toBe(false);
  });

  it("id inexistente → retorna lista igual (no-op tolerante)", () => {
    expect(toggle(items(), "zzz")).toEqual(items());
  });
});

describe("add", () => {
  it("acrescenta um item ao fim, done=false", () => {
    const out = add(items(), { id: "d", label: "D" });
    expect(out).toHaveLength(4);
    expect(out[3]).toEqual({ id: "d", label: "D", done: false });
  });

  it("não muta o input", () => {
    const before = items();
    add(before, { id: "d", label: "D" });
    expect(before).toHaveLength(3);
  });

  it("id duplicado → lança (id é a identidade do item)", () => {
    expect(() => add(items(), { id: "a", label: "dup" })).toThrow(/duplicad/i);
  });
});

describe("remove", () => {
  it("remove o item pelo id", () => {
    const out = remove(items(), "b");
    expect(out.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("id inexistente → lista igual (no-op tolerante)", () => {
    expect(remove(items(), "zzz")).toEqual(items());
  });

  it("não muta o input", () => {
    const before = items();
    remove(before, "a");
    expect(before).toHaveLength(3);
  });
});

describe("rename", () => {
  it("renomeia o label preservando id e done", () => {
    const out = rename(items(), "b", "Beta");
    const it = out.find((i) => i.id === "b");
    expect(it).toEqual({ id: "b", label: "Beta", done: true });
  });

  it("não muta o input", () => {
    const before = items();
    rename(before, "a", "Alpha");
    expect(before.find((i) => i.id === "a")?.label).toBe("A");
  });

  it("label vazio/whitespace → lança (item sem rótulo é lixo)", () => {
    expect(() => rename(items(), "a", "   ")).toThrow(/label/i);
  });
});

describe("isComplete", () => {
  it("TODOS done → true", () => {
    expect(isComplete([{ id: "a", label: "A", done: true }])).toBe(true);
  });

  it("algum não-feito → false", () => {
    expect(isComplete(items())).toBe(false);
  });

  it("lista VAZIA → false (vazio nunca é completo — espelha o board)", () => {
    expect(isComplete([])).toBe(false);
  });
});

describe("progress", () => {
  it("conta done/total", () => {
    expect(progress(items())).toEqual({ done: 1, total: 3 });
  });

  it("lista vazia → 0/0", () => {
    expect(progress([])).toEqual({ done: 0, total: 0 });
  });
});
