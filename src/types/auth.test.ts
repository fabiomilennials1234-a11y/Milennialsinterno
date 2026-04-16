import { describe, it, expect } from "vitest";
import {
  canViewBoard,
  canManageUsers,
  isAdmin,
  canCreateTab,
  canMoveCardsFreely,
  isExecutive,
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
