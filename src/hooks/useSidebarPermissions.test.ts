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
