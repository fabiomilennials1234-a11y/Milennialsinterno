// Mapa explícito (path → roles permitidas) usado pelo wrapper <RoleRoute> em App.tsx.
//
// Por que existe:
// - Antes desse arquivo, App.tsx envolvia rotas PRO+ com `RoleRoute roles={['gestor_ads']}`
//   literais. Resultado: gestor_ads via "/consultor-comercial" no sidebar (porque sidebar
//   deriva da matriz e a matriz inclui esse cross-link), mas o wrapper bloqueava antes do
//   page guard interno rodar — Navigate to "/" → loop pra hub do role.
// - Agora cada path tem suas roles DERIVADAS de ROLE_PAGE_MATRIX via getRolesAllowedForPath.
//   Sidebar promete = wrapper aceita = page guard aceita. Defesa em profundidade alinhada.
//
// Aliases: rotas com :userId param (ex: /gestor-ads/:userId) mapeiam pra mesma path base
// que a rota generic. /outbound-dashboard usa as mesmas roles de /millennials-outbound.

import { getRolesAllowedForPath, type UserRole } from '@/types/auth';

export const ROUTE_GUARDS_BY_PATH: Record<string, UserRole[]> = {
  '/gestor-ads': getRolesAllowedForPath('/gestor-ads'),
  '/millennials-outbound': getRolesAllowedForPath('/millennials-outbound'),
  '/sucesso-cliente': getRolesAllowedForPath('/sucesso-cliente'),
  '/consultor-comercial': getRolesAllowedForPath('/consultor-comercial'),
  '/consultor-mktplace': getRolesAllowedForPath('/consultor-mktplace'),
  '/financeiro': getRolesAllowedForPath('/financeiro'),
  // /outbound-dashboard não tem entry própria na matriz — é uma vista satélite do hub
  // outbound. Mesma role gating.
  '/outbound-dashboard': getRolesAllowedForPath('/millennials-outbound'),
  '/gestor-crm': getRolesAllowedForPath('/gestor-crm'),
  '/editor-video': getRolesAllowedForPath('/editor-video'),
  '/atrizes-gravacao': getRolesAllowedForPath('/atrizes-gravacao'),
  '/design': getRolesAllowedForPath('/design'),
  '/devs': getRolesAllowedForPath('/devs'),
  '/rh': getRolesAllowedForPath('/rh'),
};

/**
 * Resolve as roles aceitas pelo wrapper <RoleRoute> de uma rota.
 * Aceita o path base (sem param dinâmico). Falla loud se o path não foi declarado —
 * força quem adiciona rota nova a registrar aqui (evita o bug literal voltar).
 */
export function getRouteGuardRoles(path: string): readonly UserRole[] {
  const roles = ROUTE_GUARDS_BY_PATH[path];
  if (!roles) {
    throw new Error(
      `[routeAuth] path "${path}" não declarado em ROUTE_GUARDS_BY_PATH. ` +
        `Adicione uma entrada derivada de getRolesAllowedForPath().`,
    );
  }
  return roles;
}
