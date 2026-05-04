import { describe, it, expect } from "vitest";
import {
  canViewBoard,
  canViewRole,
  canManageUsers,
  isAdmin,
  canCreateTab,
  canMoveCardsFreely,
  isExecutive,
  getRolesAllowedForPath,
  ROLE_LABELS,
  ROLE_HIERARCHY,
  BOARD_VISIBILITY,
} from "./auth";

describe("CTO role", () => {
  it("isExecutive returns true for ceo and cto", () => {
    expect(isExecutive("ceo")).toBe(true);
    expect(isExecutive("cto")).toBe(true);
    expect(isExecutive("devs")).toBe(false);
    expect(isExecutive(null)).toBe(false);
    expect(isExecutive(undefined)).toBe(false);
  });

  it("canViewBoard returns true for CTO on any board", () => {
    expect(canViewBoard("cto", "any-slug")).toBe(true);
    expect(canViewBoard("cto", "gestor-ads")).toBe(true);
  });

  it("isAdmin returns true for cto", () => {
    expect(isAdmin("cto")).toBe(true);
    expect(isAdmin("ceo")).toBe(true);
    expect(isAdmin("gestor_projetos")).toBe(true);
    expect(isAdmin("devs")).toBe(false);
  });

  it("canCreateTab and canMoveCardsFreely allow cto", () => {
    expect(canCreateTab("cto")).toBe(true);
    expect(canMoveCardsFreely("cto")).toBe(true);
  });

  it("canManageUsers allows cto", () => {
    expect(canManageUsers("cto")).toBe(true);
  });

  it("ROLE_LABELS includes CTO", () => {
    expect(ROLE_LABELS.cto).toBe("CTO");
  });

  it("ROLE_HIERARCHY.cto equals ROLE_HIERARCHY.ceo", () => {
    expect(ROLE_HIERARCHY.cto).toBe(ROLE_HIERARCHY.ceo);
  });

  it("BOARD_VISIBILITY.cto mirrors ceo (wildcard)", () => {
    expect(BOARD_VISIBILITY.cto).toEqual(["*"]);
  });
});

describe("gestor_projetos RH exclusion", () => {
  it("canViewBoard blocks rh for gestor_projetos", () => {
    expect(canViewBoard("gestor_projetos", "rh")).toBe(false);
    expect(canViewBoard("gestor_projetos", "rh-jornada")).toBe(false);
    expect(canViewBoard("gestor_projetos", "rh_vagas")).toBe(false);
  });

  it("canViewBoard still allows non-rh boards for gestor_projetos", () => {
    expect(canViewBoard("gestor_projetos", "design")).toBe(true);
    expect(canViewBoard("gestor_projetos", "ads")).toBe(true);
    expect(canViewBoard("gestor_projetos", "financeiro")).toBe(true);
    expect(canViewBoard("gestor_projetos", "devs")).toBe(true);
  });

  it("canViewBoard allows rh for CEO and CTO", () => {
    expect(canViewBoard("ceo", "rh")).toBe(true);
    expect(canViewBoard("cto", "rh")).toBe(true);
  });

  it("canViewRole blocks rh for gestor_projetos", () => {
    expect(canViewRole("gestor_projetos", "rh")).toBe(false);
  });

  it("canViewRole still allows other roles for gestor_projetos", () => {
    expect(canViewRole("gestor_projetos", "design")).toBe(true);
    expect(canViewRole("gestor_projetos", "devs")).toBe(true);
    expect(canViewRole("gestor_projetos", "financeiro")).toBe(true);
    expect(canViewRole("gestor_projetos", "gestor_ads")).toBe(true);
  });

  it("canViewRole allows rh for CEO and CTO", () => {
    expect(canViewRole("ceo", "rh")).toBe(true);
    expect(canViewRole("cto", "rh")).toBe(true);
  });

  it("getRolesAllowedForPath('/rh') excludes gestor_projetos", () => {
    const allowed = getRolesAllowedForPath("/rh");
    expect(allowed).toContain("ceo");
    expect(allowed).toContain("cto");
    expect(allowed).not.toContain("gestor_projetos");
  });
});
