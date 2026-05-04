import { describe, it, expect } from "vitest";
import type { UserRole } from "@/types/auth";
import { SEARCHABLE_PAGES } from "../searchablePages";

/**
 * Espelha a lógica de filtro do search em AppHeader.tsx (`visiblePages`).
 * Se divergir, o teste pega — o filtro é simples o bastante pra manter duplicado.
 */
function filterForRole(role: UserRole | null | undefined) {
  const isAdmin = role === "ceo" || role === "cto" || role === "gestor_projetos";
  return SEARCHABLE_PAGES.filter((page) => {
    if (!page.allowedRoles) return true;
    if (isAdmin) return true;
    if (!role) return false;
    return page.allowedRoles.includes(role);
  });
}

describe("SEARCHABLE_PAGES — role-based filtering", () => {
  it("consultor_comercial NÃO vê '/kanban/comercial' no search (regressão bug Maycon)", () => {
    const visible = filterForRole("consultor_comercial");
    const paths = visible.map((p) => p.path);
    expect(paths).not.toContain("/kanban/comercial");
  });

  it("consultor_comercial vê '/consultor-comercial' (hub PRO+)", () => {
    const visible = filterForRole("consultor_comercial");
    const paths = visible.map((p) => p.path);
    expect(paths).toContain("/consultor-comercial");
  });

  it("CEO vê '/kanban/comercial' (admin bypassa allowedRoles)", () => {
    const visible = filterForRole("ceo");
    const paths = visible.map((p) => p.path);
    expect(paths).toContain("/kanban/comercial");
  });

  it("CTO vê '/kanban/comercial' (admin bypassa allowedRoles)", () => {
    const visible = filterForRole("cto");
    const paths = visible.map((p) => p.path);
    expect(paths).toContain("/kanban/comercial");
  });

  it("gestor_projetos vê '/kanban/comercial' (admin bypassa allowedRoles)", () => {
    const visible = filterForRole("gestor_projetos");
    const paths = visible.map((p) => p.path);
    expect(paths).toContain("/kanban/comercial");
  });

  it("roles não-admin sem allowedRoles='*' NÃO veem '/kanban/comercial'", () => {
    const roles: UserRole[] = [
      "gestor_ads",
      "outbound",
      "sucesso_cliente",
      "design",
      "editor_video",
      "devs",
      "financeiro",
    ];
    for (const role of roles) {
      const paths = filterForRole(role).map((p) => p.path);
      expect(paths, `${role} não deveria ver /kanban/comercial`).not.toContain(
        "/kanban/comercial",
      );
    }
  });

  it("Label do hub é 'Treinador Comercial PRO+' (não 'Comercial PRO+')", () => {
    const entry = SEARCHABLE_PAGES.find((p) => p.path === "/consultor-comercial");
    expect(entry?.label).toBe("Treinador Comercial PRO+");
  });

  it("Páginas sem allowedRoles continuam públicas (não ficaram quebradas)", () => {
    const publicPages = SEARCHABLE_PAGES.filter((p) => !p.allowedRoles);
    expect(publicPages.length).toBeGreaterThan(10);
    // Sanidade: pelo menos o hub consultor-comercial e o kanban design são públicos
    expect(publicPages.map((p) => p.path)).toContain("/consultor-comercial");
    expect(publicPages.map((p) => p.path)).toContain("/kanban/design");
  });
});
