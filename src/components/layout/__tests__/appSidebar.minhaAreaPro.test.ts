import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão do fix bug Maycon (2026-04-24).
 *
 * O bloco "Minha Área PRO+" do AppSidebar DEVE renderizar o link `userSpecialRoute`
 * independente de `userGroup`. Originalmente estava gated por `!userGroup`, o que
 * fazia Maycon (consultor_comercial em grupo-2) não ver o link pro hub PRO+.
 *
 * Este teste lê o source e valida estaticamente que:
 *   (a) existe um bloco "MINHA ÁREA PRO+" (topo, independe de grupo)
 *   (b) a condição de renderização desse bloco NÃO contém `!userGroup`
 *   (c) o bloco é posicionado ANTES de "MINHA ORGANIZAÇÃO"
 *
 * Alternativa seria mount() + AuthProvider mock — custo não vale pro ganho.
 */

const SIDEBAR_PATH = join(
  __dirname,
  "..",
  "AppSidebar.tsx",
);

const SOURCE = readFileSync(SIDEBAR_PATH, "utf8");

describe("AppSidebar — Minha Área PRO+ (bug Maycon)", () => {
  it("existe bloco comentado 'MINHA ÁREA PRO+' no topo", () => {
    expect(SOURCE).toContain("MINHA ÁREA PRO+");
  });

  it("o bloco PRO+ aparece ANTES de 'MINHA ORGANIZAÇÃO'", () => {
    const proIdx = SOURCE.indexOf("MINHA ÁREA PRO+");
    const orgIdx = SOURCE.indexOf("MINHA ORGANIZAÇÃO");
    expect(proIdx).toBeGreaterThan(-1);
    expect(orgIdx).toBeGreaterThan(-1);
    expect(proIdx).toBeLessThan(orgIdx);
  });

  it("a condição do bloco PRO+ NÃO gata por `!userGroup`", () => {
    // Pega o trecho entre o comentário PRO+ e o próximo bloco. A condição JSX
    // deve vir logo em seguida.
    const startMarker = "MINHA ÁREA PRO+";
    const start = SOURCE.indexOf(startMarker);
    const endMarker = "MINHA ORGANIZAÇÃO";
    const end = SOURCE.indexOf(endMarker, start);
    const slice = SOURCE.slice(start, end);

    expect(slice).toContain("userSpecialRoute");
    expect(slice).toContain("!isAdminUser");
    expect(slice).toContain("!isCollapsed");
    // Invariante crítica: a condição não pode checar `!userGroup` — senão
    // usuários com grupo perdem o link do hub PRO+ (bug original).
    expect(slice).not.toMatch(/!\s*userGroup\s*&&/);
  });
});
