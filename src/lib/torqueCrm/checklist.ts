// src/lib/torqueCrm/checklist.ts
//
// Slice 3 (#93) — Board Torque CRM. Módulo PURO e GENÉRICO (sem React, sem
// Supabase, sem dependência de CRM). É o dono das operações de checklist
// achatado `[{id,label,done}]` (ADR 0006).
//
// Genérico DE PROPÓSITO: será REUSADO na aba Acompanhamentos "Tasks em aberto"
// (ADR §2), que tem um checklist editável que começa vazio. Por isso este
// módulo NÃO conhece "steps", "tier" nem CRM — opera sobre ChecklistItem[] cru.
// O seed a partir dos steps do tier (CRM_STEPS_BY_PRODUTO) é um adapter fino que
// vive fora daqui (board/migracaoSteps), chamando `seed(pares)`.
//
// Todas as operações são PURAS: não mutam o input, retornam um array novo.
// Regra de marcação (ADR 0006): SEM gate sequencial — qualquer item é marcável
// a qualquer momento, em qualquer ordem.

/** Item de checklist achatado (contrato ADR 0006). Fonte única do tipo. */
export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/** Par mínimo para semear um item (done nasce false). */
export interface ChecklistSeedItem {
  id: string;
  label: string;
}

/** Monta um checklist a partir de pares {id,label}; todos nascem done=false. */
export function seed(pairs: readonly ChecklistSeedItem[]): ChecklistItem[] {
  return pairs.map(({ id, label }) => ({ id, label, done: false }));
}

/**
 * Alterna o `done` de um item pelo id (marcar/desmarcar). Sem gate de ordem.
 * Id inexistente → no-op tolerante (retorna cópia equivalente).
 */
export function toggle(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((i) => (i.id === id ? { ...i, done: !i.done } : { ...i }));
}

/**
 * Acrescenta um item ao fim (done=false).
 * @throws se o id já existe — o id é a identidade do item no array.
 */
export function add(items: readonly ChecklistItem[], item: ChecklistSeedItem): ChecklistItem[] {
  if (items.some((i) => i.id === item.id)) {
    throw new Error(`checklist: id duplicado '${item.id}'`);
  }
  return [...items.map((i) => ({ ...i })), { id: item.id, label: item.label, done: false }];
}

/** Remove o item pelo id. Id inexistente → no-op tolerante. */
export function remove(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
  return items.filter((i) => i.id !== id).map((i) => ({ ...i }));
}

/**
 * Renomeia o label de um item, preservando id e done.
 * @throws se o label novo for vazio/whitespace — item sem rótulo é lixo.
 */
export function rename(items: readonly ChecklistItem[], id: string, label: string): ChecklistItem[] {
  if (label.trim() === "") {
    throw new Error("checklist: label não pode ser vazio");
  }
  return items.map((i) => (i.id === id ? { ...i, label } : { ...i }));
}

/**
 * True sse TODOS os itens estão done E a lista é não-vazia. Lista vazia nunca é
 * "completa" — espelha o board (`complete = total > 0 && done === total`) e
 * impede o auto-move de um card recém-entrado no tier com checklist vazio.
 */
export function isComplete(items: readonly ChecklistItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done);
}

/** Conta done/total. */
export function progress(items: readonly ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
