import { describe, it, expect } from "vitest";
import type { UserRole } from "@/types/auth";

/**
 * Regressão do fix arquitetônico de routing role-based (2026-04-23, opção B).
 *
 * Espelha a lógica do DefaultRedirect em App.tsx. O bug original: o loop usava
 * canViewTabById(tab.id) que matcha qualquer tab que o role PODE VER (não só
 * o dele). Resultado: gestor_ads/outbound/sucesso_cliente caíam em
 * /kanban/design porque BOARD_VISIBILITY deles inclui 'design' antes do
 * próprio papel na ordem de tabPriority.
 *
 * Fix: match exato por user.role === tab.id. Cada role vai para SUA rota.
 */

// Cópia intencional do mapa em App.tsx — se divergir, este teste pega.
const TAB_PRIORITY_SNAPSHOT = [
  { id: "design", path: "/kanban/design" },
  { id: "editor_video", path: "/kanban/editor-video" },
  { id: "devs", path: "/kanban/devs" },
  { id: "atrizes_gravacao", path: "/kanban/atrizes" },
  { id: "produtora", path: "/kanban/produtora" },
  { id: "gestor_crm", path: "/kanban/crm" },
  { id: "consultor_comercial", path: "/consultor-comercial" },
  { id: "consultor_mktplace", path: "/consultor-mktplace" },
  { id: "gestor_ads", path: "/gestor-ads" },
  { id: "outbound", path: "/millennials-outbound" },
  { id: "sucesso_cliente", path: "/kanban/sucesso" },
  { id: "financeiro", path: "/financeiro" },
  { id: "rh", path: "/kanban/rh" },
];

function defaultPathForRole(role: UserRole): string | null {
  for (const tab of TAB_PRIORITY_SNAPSHOT) {
    if (role === tab.id) return tab.path;
  }
  return null;
}

describe("DefaultRedirect: role → path mapping", () => {
  it("consultor_comercial redireciona para /consultor-comercial (hub Paddock)", () => {
    expect(defaultPathForRole("consultor_comercial")).toBe("/consultor-comercial");
  });

  it("consultor_comercial NÃO cai em /kanban/comercial (regressão do bug Maycon)", () => {
    expect(defaultPathForRole("consultor_comercial")).not.toBe("/kanban/comercial");
  });

  it("gestor_ads redireciona para /gestor-ads (hub PRO+)", () => {
    expect(defaultPathForRole("gestor_ads")).toBe("/gestor-ads");
  });

  it("gestor_ads NÃO cai em /kanban/ads", () => {
    expect(defaultPathForRole("gestor_ads")).not.toBe("/kanban/ads");
  });

  it("gestor_ads NÃO cai em /kanban/design (regressão do bug de match por BOARD_VISIBILITY)", () => {
    expect(defaultPathForRole("gestor_ads")).not.toBe("/kanban/design");
  });

  it("outbound redireciona para /millennials-outbound (hub PRO+)", () => {
    expect(defaultPathForRole("outbound")).toBe("/millennials-outbound");
  });

  it("outbound NÃO cai em /kanban/design (regressão do bug de match por BOARD_VISIBILITY)", () => {
    expect(defaultPathForRole("outbound")).not.toBe("/kanban/design");
  });

  it("sucesso_cliente redireciona para /kanban/sucesso", () => {
    expect(defaultPathForRole("sucesso_cliente")).toBe("/kanban/sucesso");
  });

  it("sucesso_cliente NÃO cai em /kanban/design (regressão do bug de match por BOARD_VISIBILITY)", () => {
    expect(defaultPathForRole("sucesso_cliente")).not.toBe("/kanban/design");
  });

  // Não-regressões: rotas não tocadas pelo fix
  it("consultor_mktplace continua em /consultor-mktplace", () => {
    expect(defaultPathForRole("consultor_mktplace")).toBe("/consultor-mktplace");
  });

  it("design continua em /kanban/design", () => {
    expect(defaultPathForRole("design")).toBe("/kanban/design");
  });

  it("financeiro continua em /financeiro", () => {
    expect(defaultPathForRole("financeiro")).toBe("/financeiro");
  });

  it("rh continua em /kanban/rh", () => {
    expect(defaultPathForRole("rh")).toBe("/kanban/rh");
  });

  it("gestor_crm continua em /kanban/crm", () => {
    expect(defaultPathForRole("gestor_crm")).toBe("/kanban/crm");
  });
});
