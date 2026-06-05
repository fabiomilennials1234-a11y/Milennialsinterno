import { describe, it, expect } from 'vitest';
import { getRolesAllowedForPath } from './auth';
import { getRouteGuardRoles } from '../lib/routeAuth';

// Slice 2 (#137) — Gestor de ads acompanha o board do CRM (read-only).
// PRD #135. O acesso de rota/sidebar do ads ao /gestor-crm deriva da ÚNICA
// fonte de verdade (ROLE_PAGE_MATRIX → proPlusRoute), que já declara a entry
// `gestor-crm` para gestor_ads. Estes testes TRAVAM essa invariante: se alguém
// remover gestor_ads da matriz do /gestor-crm, o guard e o sidebar deixam de
// expor o board e estes testes quebram (regressão visível, não silenciosa).
//
// A defesa de DADOS (ads só lê cards da própria carteira) é a RLS SELECT
// escopada por _ads_owns_client — provada em pgTAP (ads_crm_board_rls_test.sql).
// Aqui é só a camada de navegação.

describe('Slice 2 (#137) — ads acessa /gestor-crm (read-only)', () => {
  it('gestor_ads está nas roles permitidas para /gestor-crm (derivado da matriz)', () => {
    expect(getRolesAllowedForPath('/gestor-crm')).toContain('gestor_ads');
  });

  it('o guard de rota <RoleRoute> de /gestor-crm aceita gestor_ads', () => {
    // getRouteGuardRoles deriva de getRolesAllowedForPath — guard, sidebar e
    // page-guard prometem a mesma coisa (defesa em profundidade alinhada).
    expect(getRouteGuardRoles('/gestor-crm')).toContain('gestor_ads');
  });

  it('gestor_crm continua com acesso ao /gestor-crm (sem regressão)', () => {
    expect(getRolesAllowedForPath('/gestor-crm')).toContain('gestor_crm');
  });
});
