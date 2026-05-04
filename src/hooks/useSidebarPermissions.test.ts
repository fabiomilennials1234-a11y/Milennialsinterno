import { describe, it, expect } from "vitest";
import {
  ROLE_BOARD_SLUGS,
  ROLE_INDEPENDENT_CATEGORIES,
  SPECIAL_ROUTES,
} from "./useSidebarPermissions";

describe("CTO sidebar permissions", () => {
  it("ROLE_BOARD_SLUGS.cto equals ROLE_BOARD_SLUGS.ceo", () => {
    expect(ROLE_BOARD_SLUGS.cto).toEqual(ROLE_BOARD_SLUGS.ceo);
  });

  it("ROLE_INDEPENDENT_CATEGORIES.cto equals ROLE_INDEPENDENT_CATEGORIES.ceo", () => {
    expect(ROLE_INDEPENDENT_CATEGORIES.cto).toEqual(
      ROLE_INDEPENDENT_CATEGORIES.ceo,
    );
  });

  it("SPECIAL_ROUTES.cto equals SPECIAL_ROUTES.ceo", () => {
    expect(SPECIAL_ROUTES.cto).toEqual(SPECIAL_ROUTES.ceo);
  });
});

// Regressão: fix de routing role-based (2026-04-23).
// Bug: consultor_comercial aterrissava em /kanban/comercial (board legacy)
// em vez de /consultor-comercial (hub Paddock). Causa raiz: sidebar tinha
// slug duplicado ['comercial'] disputando com o PRO+ route.
describe("consultor_comercial routing", () => {
  it("ROLE_BOARD_SLUGS.consultor_comercial is empty — sidebar só mostra hub PRO+", () => {
    expect(ROLE_BOARD_SLUGS.consultor_comercial).toEqual([]);
  });

  it("SPECIAL_ROUTES.consultor_comercial points to /consultor-comercial hub", () => {
    expect(SPECIAL_ROUTES.consultor_comercial).toBeDefined();
    expect(SPECIAL_ROUTES.consultor_comercial.path).toBe("/consultor-comercial");
  });
});

describe("gestor_projetos RH exclusion in sidebar", () => {
  it("ROLE_INDEPENDENT_CATEGORIES.gestor_projetos has wildcard with rh exclusion", () => {
    expect(ROLE_INDEPENDENT_CATEGORIES.gestor_projetos).toContain("*");
    expect(ROLE_INDEPENDENT_CATEGORIES.gestor_projetos).toContain("!rh");
  });

  it("ROLE_INDEPENDENT_CATEGORIES.ceo has pure wildcard (no exclusions)", () => {
    expect(ROLE_INDEPENDENT_CATEGORIES.ceo).toEqual(["*"]);
  });

  it("ROLE_INDEPENDENT_CATEGORIES.cto has pure wildcard (no exclusions)", () => {
    expect(ROLE_INDEPENDENT_CATEGORIES.cto).toEqual(["*"]);
  });
});

describe("gestor_ads routing", () => {
  it("SPECIAL_ROUTES.gestor_ads points to /gestor-ads hub", () => {
    expect(SPECIAL_ROUTES.gestor_ads).toBeDefined();
    expect(SPECIAL_ROUTES.gestor_ads.path).toBe("/gestor-ads");
  });

  // gestor_ads mantém slug ['ads'] porque opera também no board de grupo.
  // Mudança do redirect default é em App.tsx, não aqui.
  it("ROLE_BOARD_SLUGS.gestor_ads still contains own group board", () => {
    expect(ROLE_BOARD_SLUGS.gestor_ads).toContainEqual(["ads"]);
  });
});
