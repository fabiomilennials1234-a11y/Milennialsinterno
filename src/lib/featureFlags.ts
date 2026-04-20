// Feature flags (compile-time, lidas do Vite env).
//
// Padrão do projeto: variáveis públicas usam prefixo VITE_ e são strings.
// Normalização: tratamos apenas 'true' (case-insensitive) como ligado.
//
// Novas flags: preferir "off por padrão" e documentar no .env.example.

function readBool(key: string): boolean {
  const raw = import.meta.env[key as keyof ImportMetaEnv];
  return typeof raw === 'string' && raw.toLowerCase() === 'true';
}

export const FEATURE_FLAGS = {
  // Dual-read de permissões. Quando ligada:
  //   1. o frontend loga divergências entre a fonte legada (additional_pages + DEFAULT_PAGES_BY_ROLE)
  //      e a fonte nova (get_my_page_access RPC)
  //   2. o Create/Edit User passa a chamar grant_pages após a edge function
  //      de admin para popular user_page_grants
  //
  // NÃO altera a decisão de visibilidade em runtime. Sidebar continua lendo
  // BOARD_VISIBILITY + additional_pages até cutover formal.
  USE_PAGE_GRANTS: readBool('VITE_USE_PAGE_GRANTS'),
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
