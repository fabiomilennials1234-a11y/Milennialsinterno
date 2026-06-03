import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "_scratch",
      ".claude",
      ".cursor",
      ".playwright-mcp",
      // Edge Functions run in Deno, not the browser; their own tooling typechecks them.
      "supabase/functions",
      // Auto-generated from Supabase schema.
      "src/integrations/supabase/types.ts",
      // Fixtures do teste de boundaries (#76): contêm violações DELIBERADAS de
      // fronteira. Não fazem parte do build; o lint geral as ignora. O script
      // `test:boundaries` roda eslint SÓ nelas e exige que a violação dispare.
      "src/modules/__boundaries_fixture__",
    ],
  },
  // ===========================================================================
  // Monolito Modular — fronteira de módulo (ADR 0004, #76).
  // Escopo DELIBERADAMENTE limitado a `src/modules/**`: o legado em
  // `src/features/**` e `src/pages/**` NÃO entra de uma vez (evita explodir o
  // build nos ~295 imports cruzados pré-existentes). Cada área entra no
  // perímetro pelo estrangulamento, fatia a fatia.
  //
  // Regra: cada pasta em `src/modules/<nome>` é um "module" cujo ÚNICO entry
  // point público é `index.ts`. Importar internals (`@/modules/x/lib/...`) de
  // fora do módulo quebra o build.
  // ===========================================================================
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      // boundaries usa o resolver de `eslint-plugin-import`. Sem o resolver TS,
      // imports `@/...` e relativos sem extensão ficam "unknown" e a regra não
      // dispara. O resolver mapeia o alias `@/* -> src/*` do tsconfig.
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: true,
      },
      "boundaries/elements": [
        {
          type: "module",
          pattern: "src/modules/*",
          mode: "folder",
          capture: ["moduleName"],
        },
      ],
    },
    rules: {
      // Importar um módulo só pelo barrel index.ts; internals são privados.
      // v6: `boundaries/dependencies` substitui o `entry-point` deprecado.
      // `to.internalPath: '!index.ts'` = proibir import de qualquer arquivo do
      // módulo que NÃO seja o index.ts (i.e., furar o barrel). Imports dentro do
      // próprio módulo (self) e via barrel são permitidos.
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: { type: "module" },
              disallow: { to: { type: "module", internalPath: "!index.ts" } },
              message:
                "Furou o barrel do módulo. Importe de '@/modules/${dependency.moduleName}' (index.ts), nao de internals (ADR 0004).",
            },
          ],
        },
      ],
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
);
