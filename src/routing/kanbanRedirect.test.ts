import { describe, it, expect } from "vitest";
import { resolveKanbanRedirect } from "./kanbanRedirect";

/**
 * Regressão do fix bug Maycon (2026-04-24).
 *
 * Contexto: role `consultor_comercial` caía em `/kanban/comercial` (board legacy
 * global) quando deveria ir pro hub PRO+ `/consultor-comercial`. Board comercial
 * continua existindo — scope de cards por client.group_id via RLS (decisão Opus B) —
 * mas é acessado só por executives/gestor_projetos, não pelo consultor em si.
 */
describe("resolveKanbanRedirect", () => {
  it("redireciona consultor_comercial de /kanban/comercial pro hub PRO+", () => {
    expect(resolveKanbanRedirect("comercial", "consultor_comercial")).toBe(
      "/consultor-comercial",
    );
  });

  it("NÃO redireciona CEO de /kanban/comercial (admin vê board legacy)", () => {
    expect(resolveKanbanRedirect("comercial", "ceo")).toBeNull();
  });

  it("NÃO redireciona gestor_projetos de /kanban/comercial", () => {
    expect(resolveKanbanRedirect("comercial", "gestor_projetos")).toBeNull();
  });

  it("NÃO redireciona cto de /kanban/comercial", () => {
    expect(resolveKanbanRedirect("comercial", "cto")).toBeNull();
  });

  it("NÃO redireciona consultor_comercial em outros boards", () => {
    expect(resolveKanbanRedirect("design", "consultor_comercial")).toBeNull();
    expect(resolveKanbanRedirect("ads", "consultor_comercial")).toBeNull();
  });

  it("NÃO redireciona quando role é undefined (usuário ainda carregando)", () => {
    expect(resolveKanbanRedirect("comercial", undefined)).toBeNull();
    expect(resolveKanbanRedirect("comercial", null)).toBeNull();
  });

  it("NÃO redireciona quando boardId é undefined", () => {
    expect(resolveKanbanRedirect(undefined, "consultor_comercial")).toBeNull();
  });

  it("match exato de slug — não confunde 'comercial-x' com 'comercial'", () => {
    expect(
      resolveKanbanRedirect("comercial-legacy", "consultor_comercial"),
    ).toBeNull();
    expect(
      resolveKanbanRedirect("grupo-2-comercial", "consultor_comercial"),
    ).toBeNull();
  });
});
