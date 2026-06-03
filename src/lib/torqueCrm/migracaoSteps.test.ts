import { describe, it, expect } from "vitest";
import { stepToChecklist, type ChecklistItem } from "./migracaoSteps";
import {
  CRM_STEPS_BY_PRODUTO,
  CRM_STEP_LABEL,
  type CrmProduto,
} from "@/hooks/useCrmKanban";

// =============================================================
// Slice 1 (#91) — migração de progresso: current_step → checklist
//
// Módulo PURO. Espelha a lógica que a migration SQL aplica aos cards vivos:
// dado o produto e o `current_step` da state-machine antiga, produz o checklist
// novo `[{id,label,done}]` marcando como done o PREFIXO de steps ATÉ (inclusive)
// o current_step na ordem de CRM_STEPS_BY_PRODUTO. Prova de não-perda de
// progresso: nº de itens done = índice do current_step + 1.
//
// Obs: o produto 'torque' é o ex-'v8' renomeado. A state-machine de seed
// continua sendo a do tier; aqui testamos as três famílias de steps.
// =============================================================

describe("stepToChecklist", () => {
  it("marca como done o prefixo de steps até o current_step (inclusive)", () => {
    const produto: CrmProduto = "automation";
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const current = steps[3]; // 4º step
    const checklist = stepToChecklist(produto, current);

    // Um item por step do tier, na ordem.
    expect(checklist).toHaveLength(steps.length);
    checklist.forEach((item, i) => {
      expect(item.id).toBe(steps[i]);
      expect(item.label).toBe(CRM_STEP_LABEL[steps[i]] ?? steps[i]);
    });

    // Prefixo done: índices 0..3 done; 4.. pendentes.
    const doneFlags = checklist.map((i) => i.done);
    expect(doneFlags).toEqual([
      true, true, true, true,
      ...steps.slice(4).map(() => false),
    ]);
    expect(checklist.filter((i) => i.done)).toHaveLength(4);
  });

  it("primeiro step: só o primeiro item done", () => {
    const produto: CrmProduto = "torque";
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const checklist = stepToChecklist(produto, steps[0]);
    expect(checklist.filter((i) => i.done)).toHaveLength(1);
    expect(checklist[0].done).toBe(true);
    expect(checklist.slice(1).every((i) => !i.done)).toBe(true);
  });

  it("último step: todos os itens done (card pronto para APRESENTAÇÃO)", () => {
    const produto: CrmProduto = "copilot";
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const last = steps[steps.length - 1];
    const checklist = stepToChecklist(produto, last);
    expect(checklist).toHaveLength(steps.length);
    expect(checklist.every((i) => i.done)).toBe(true);
  });

  it("step inválido (não pertence à state-machine): nenhum done — não inventa progresso", () => {
    const produto: CrmProduto = "torque";
    const steps = CRM_STEPS_BY_PRODUTO[produto];
    const checklist = stepToChecklist(produto, "step_que_nao_existe");
    expect(checklist).toHaveLength(steps.length);
    expect(checklist.every((i) => !i.done)).toBe(true);
  });

  it("torque herda a state-machine do ex-v8 (mesmos steps, mesma ordem)", () => {
    // Invariante do rename: 'torque' É o ex-'v8'. A seed de checklist do tier
    // base não muda — só o nome do produto.
    const torque = stepToChecklist("torque", CRM_STEPS_BY_PRODUTO.torque[0]);
    expect(torque.map((i) => i.id)).toEqual([...CRM_STEPS_BY_PRODUTO.torque]);
  });

  it("cada item tem o shape do contrato {id,label,done}", () => {
    const checklist = stepToChecklist("automation", "estruturar_funil");
    checklist.forEach((item: ChecklistItem) => {
      expect(Object.keys(item).sort()).toEqual(["done", "id", "label"]);
      expect(typeof item.id).toBe("string");
      expect(typeof item.label).toBe("string");
      expect(typeof item.done).toBe("boolean");
    });
  });
});
