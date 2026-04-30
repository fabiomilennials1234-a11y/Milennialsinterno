// Feature flags (compile-time, lidas do Vite env).
//
// Padrão do projeto: variáveis públicas usam prefixo VITE_ e são strings.
// Normalização: tratamos apenas 'true' (case-insensitive) como ligado.
//
// Novas flags: preferir "off por padrão" e documentar no .env.example.

// Atualmente vazio. USE_PAGE_GRANTS foi removido em 2026-04-30 apos cutover do
// modelo user_page_grants (dual-write virou single-source via edge functions).
// Mantemos o arquivo + tipo pra adicoes futuras sem refatorar imports.

export const FEATURE_FLAGS = {} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
