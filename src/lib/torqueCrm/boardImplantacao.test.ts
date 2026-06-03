import { describe, it, expect } from "vitest";
import { comecar, onChecklistComplete, marcarPronto, reagendar, type BoardCard, type BoardStatus } from "./boardImplantacao";
import type { ChecklistItem } from "./checklist";
import type { CrmProduto } from "@/hooks/useCrmKanban";

// =============================================================
// Slice 2 (#92) — Board Torque CRM. Módulo PURO (sem React, sem Supabase).
//
// Reducer da transição "Começar": promove um card de A FAZER para a coluna do
// seu tier (board_status: 'a_fazer' -> 'tier'). É o dono da regra de transição;
// a RPC SECURITY DEFINER torque_board_comecar reflete esta lógica no banco e a
// pgTAP prova a mesma invariante no SQL. Prior art: migracaoSteps.ts/.test.ts.
//
// Invariante (ADR 0006): a única transição válida nesta slice é a_fazer -> tier.
// O produto (tier) NÃO muda — o card já nasce roteado pro tier mais alto via
// getHighestProduct na geração; "Começar" só revela o card na coluna do tier.
// =============================================================

const TORQUE: CrmProduto = "torque";

function card(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: "cfg-1",
    produto: TORQUE,
    board_status: "a_fazer",
    ...overrides,
  };
}

describe("comecar", () => {
  it("promove um card de A FAZER para a coluna do seu tier (a_fazer -> tier)", () => {
    const next = comecar(card({ board_status: "a_fazer" }));
    expect(next.board_status).toBe<BoardStatus>("tier");
  });

  it("preserva o produto/tier — Começar não re-roteia o card", () => {
    const next = comecar(card({ produto: "copilot", board_status: "a_fazer" }));
    expect(next.produto).toBe<CrmProduto>("copilot");
    expect(next.board_status).toBe<BoardStatus>("tier");
  });

  it("preserva os demais campos do card (transição imutável e cirúrgica)", () => {
    const before = card({ id: "cfg-42", produto: "automation", board_status: "a_fazer" });
    const next = comecar(before);
    expect(next.id).toBe("cfg-42");
    // Não muta o input (função pura).
    expect(before.board_status).toBe("a_fazer");
    expect(next).not.toBe(before);
  });

  it("rejeita Começar em card que já saiu de A FAZER (tier) — transição inválida", () => {
    expect(() => comecar(card({ board_status: "tier" }))).toThrow(/transição inválida/i);
  });

  it("rejeita Começar em card em apresentacao", () => {
    expect(() => comecar(card({ board_status: "apresentacao" }))).toThrow(/transição inválida/i);
  });

  it("rejeita Começar em card já pronto (terminal)", () => {
    expect(() => comecar(card({ board_status: "pronto" }))).toThrow(/transição inválida/i);
  });
});

// =============================================================
// Slice 3 (#93) — onChecklistComplete: ao marcar TODOS os itens do checklist
// de um card em 'tier', o card auto-move tier -> apresentacao (ADR 0006).
//
// Invariantes:
//   - só promove a partir de 'tier' (a coluna de trabalho);
//   - só com checklist 100% completo E não-vazio (espelha isComplete);
//   - NÃO rebaixa: card fora de 'tier' (apresentacao/pronto/a_fazer) fica como
//     está mesmo com checklist completo — desmarcar depois não puxa de volta;
//   - função pura, idempotente.
// =============================================================

function full(): ChecklistItem[] {
  return [
    { id: "a", label: "A", done: true },
    { id: "b", label: "B", done: true },
  ];
}
function partial(): ChecklistItem[] {
  return [
    { id: "a", label: "A", done: true },
    { id: "b", label: "B", done: false },
  ];
}

describe("onChecklistComplete", () => {
  it("card em tier + checklist 100% → auto-move para apresentacao", () => {
    const next = onChecklistComplete(card({ board_status: "tier" }), full());
    expect(next.board_status).toBe<BoardStatus>("apresentacao");
  });

  it("card em tier + checklist incompleto → permanece em tier", () => {
    const next = onChecklistComplete(card({ board_status: "tier" }), partial());
    expect(next.board_status).toBe<BoardStatus>("tier");
  });

  it("card em tier + checklist VAZIO → permanece em tier (vazio não é completo)", () => {
    const next = onChecklistComplete(card({ board_status: "tier" }), []);
    expect(next.board_status).toBe<BoardStatus>("tier");
  });

  it("card já em apresentacao + checklist completo → NÃO rebaixa nem re-promove (idempotente)", () => {
    const next = onChecklistComplete(card({ board_status: "apresentacao" }), full());
    expect(next.board_status).toBe<BoardStatus>("apresentacao");
  });

  it("card em apresentacao com item DESMARCADO → permanece em apresentacao (não volta pra tier)", () => {
    const next = onChecklistComplete(card({ board_status: "apresentacao" }), partial());
    expect(next.board_status).toBe<BoardStatus>("apresentacao");
  });

  it("card a_fazer não auto-move (ainda não começou)", () => {
    const next = onChecklistComplete(card({ board_status: "a_fazer" }), full());
    expect(next.board_status).toBe<BoardStatus>("a_fazer");
  });

  it("preserva os demais campos e não muta o input (função pura)", () => {
    const before = card({ id: "cfg-9", produto: "copilot", board_status: "tier" });
    const next = onChecklistComplete(before, full());
    expect(next.id).toBe("cfg-9");
    expect(next.produto).toBe<CrmProduto>("copilot");
    expect(before.board_status).toBe("tier");
    expect(next).not.toBe(before);
  });
});

// =============================================================
// Slice 4 (#94) — marcarPronto / reagendar (ADR 0006).
//
// APRESENTAÇÃO é o estágio de agendamento. A partir de 00h do dia agendado
// (gate de data — módulo dateGate, testado à parte) liberam dois caminhos:
//   - marcarPronto: apresentacao -> pronto (card arquiva em PRONTOS);
//   - reagendar: card PERMANECE em apresentacao (só troca a data/hora, que é
//     responsabilidade da RPC torque_board_agendar; o reducer só prova a
//     invariante de estado: reagendar não tira o card de apresentacao).
//
// O reducer NÃO conhece datas — o gate de data vive em dateGate (puro, próprio)
// e é re-validado no servidor (RPC torque_board_pronto valida apresentacao_at).
// Aqui só blindamos as transições de board_status.
// =============================================================

describe("marcarPronto", () => {
  it("apresentacao -> pronto", () => {
    const next = marcarPronto(card({ board_status: "apresentacao" }));
    expect(next.board_status).toBe<BoardStatus>("pronto");
  });

  it("preserva produto/id e não muta o input (função pura)", () => {
    const before = card({ id: "cfg-7", produto: "automation", board_status: "apresentacao" });
    const next = marcarPronto(before);
    expect(next.id).toBe("cfg-7");
    expect(next.produto).toBe<CrmProduto>("automation");
    expect(before.board_status).toBe("apresentacao");
    expect(next).not.toBe(before);
  });

  it("rejeita marcarPronto em card que não está em apresentacao (a_fazer)", () => {
    expect(() => marcarPronto(card({ board_status: "a_fazer" }))).toThrow(/transição inválida/i);
  });

  it("rejeita marcarPronto em card em tier", () => {
    expect(() => marcarPronto(card({ board_status: "tier" }))).toThrow(/transição inválida/i);
  });

  it("rejeita marcarPronto em card já pronto (terminal; blinda duplo-clique)", () => {
    expect(() => marcarPronto(card({ board_status: "pronto" }))).toThrow(/transição inválida/i);
  });
});

describe("reagendar", () => {
  it("card em apresentacao PERMANECE em apresentacao (só troca data)", () => {
    const next = reagendar(card({ board_status: "apresentacao" }));
    expect(next.board_status).toBe<BoardStatus>("apresentacao");
  });

  it("não muta o input (função pura)", () => {
    const before = card({ id: "cfg-3", board_status: "apresentacao" });
    const next = reagendar(before);
    expect(next).not.toBe(before);
    expect(next.id).toBe("cfg-3");
  });

  it("rejeita reagendar fora de apresentacao (tier) — só se reagenda o que está agendado", () => {
    expect(() => reagendar(card({ board_status: "tier" }))).toThrow(/transição inválida/i);
  });

  it("rejeita reagendar card já pronto", () => {
    expect(() => reagendar(card({ board_status: "pronto" }))).toThrow(/transição inválida/i);
  });
});
