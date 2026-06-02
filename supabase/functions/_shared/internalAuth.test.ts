import { describe, it, expect } from "vitest";
import { extractBearer, isServiceRoleCaller, timingSafeEqual } from "./internalAuth";

const SECRET = "sb_secret_hlqbYZVexampleexampleexample";
const LEGACY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy.signature";

describe("extractBearer", () => {
  it("pulls token from a well-formed header", () => {
    expect(extractBearer(`Bearer ${SECRET}`)).toBe(SECRET);
    expect(extractBearer(`bearer ${SECRET}`)).toBe(SECRET); // case-insensitive scheme
    expect(extractBearer(`Bearer   ${SECRET}  `)).toBe(SECRET); // trims surrounding ws
  });

  it("returns null for malformed/absent headers", () => {
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer("")).toBeNull();
    expect(extractBearer(SECRET)).toBeNull(); // missing scheme
    expect(extractBearer("Basic abc")).toBeNull();
  });
});

describe("timingSafeEqual", () => {
  it("matches identical, rejects different", () => {
    expect(timingSafeEqual(SECRET, SECRET)).toBe(true);
    expect(timingSafeEqual(SECRET, SECRET + "x")).toBe(false);
    expect(timingSafeEqual(SECRET, "sb_secret_other")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("isServiceRoleCaller (issue #70 gate-2 regression)", () => {
  // The reconciler dispatches the NEW secret-key format. The gate MUST accept
  // it, or the durability net is dead (the bug that stuck transcription in
  // 'processing' forever).
  it("accepts the new sb_secret_ key", () => {
    expect(isServiceRoleCaller(SECRET, SECRET)).toBe(true);
  });

  it("accepts the legacy service-role JWT when provided", () => {
    expect(isServiceRoleCaller(LEGACY_JWT, SECRET, LEGACY_JWT)).toBe(true);
  });

  it("rejects a non-matching token", () => {
    expect(isServiceRoleCaller("sb_secret_attacker", SECRET)).toBe(false);
    expect(isServiceRoleCaller(LEGACY_JWT, SECRET)).toBe(false); // legacy not passed
    expect(isServiceRoleCaller(null, SECRET)).toBe(false);
    expect(isServiceRoleCaller("", SECRET)).toBe(false);
  });

  it("never authenticates against an empty/unset service key", () => {
    expect(isServiceRoleCaller("", "")).toBe(false);
    expect(isServiceRoleCaller(null, "")).toBe(false);
  });
});
