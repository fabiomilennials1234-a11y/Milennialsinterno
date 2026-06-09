import { describe, it, expect } from 'vitest';
import { getRolesAllowedForPath, getRolesWithPageSlug } from './auth';
import { getRouteGuardRoles } from '../lib/routeAuth';

// Slice #149 (Concessão) — página Concessões (ADR 0009 §5). O acesso de
// rota/sidebar deriva da ÚNICA fonte de verdade (ROLE_PAGE_MATRIX → proPlusRoute),
// que declara a entry `concessoes` para sucesso_cliente. Executivos
// (ceo/cto/gestor_projetos) herdam por _EXECUTIVE_FALLBACK_ROLES.
//
// Estes testes TRAVAM a invariante: se alguém remover sucesso_cliente da matriz
// do /concessoes, o guard, o sidebar e o page-guard deixam de expor a página e
// estes testes quebram (regressão visível, não silenciosa).
//
// A defesa de DADOS (CS só lê concessões de clientes que vê; só concede na
// própria carteira) é a RLS SELECT (cliente.pode_ver_cliente) + o predicado
// _concessao_pode_conceder na RPC — provados no backend. Aqui é só navegação.

const EXECUTIVES = ['ceo', 'cto', 'gestor_projetos'] as const;

describe('Concessão (#149) — acesso à página /concessoes', () => {
  it('sucesso_cliente está nas roles permitidas para /concessoes (derivado da matriz)', () => {
    expect(getRolesAllowedForPath('/concessoes')).toContain('sucesso_cliente');
  });

  it('executivos herdam acesso a /concessoes', () => {
    const allowed = getRolesAllowedForPath('/concessoes');
    for (const exec of EXECUTIVES) {
      expect(allowed).toContain(exec);
    }
  });

  it('getRolesWithPageSlug("concessoes") inclui sucesso_cliente + executivos', () => {
    const roles = getRolesWithPageSlug('concessoes');
    expect(roles).toContain('sucesso_cliente');
    for (const exec of EXECUTIVES) {
      expect(roles).toContain(exec);
    }
  });

  it('o guard de rota <PageAccessRoute> de /concessoes aceita sucesso_cliente + executivos', () => {
    // getRouteGuardRoles falha loud se o path não estiver registrado em
    // ROUTE_GUARDS_BY_PATH — esta asserção também prova que a rota foi registrada.
    const guardRoles = getRouteGuardRoles('/concessoes');
    expect(guardRoles).toContain('sucesso_cliente');
    for (const exec of EXECUTIVES) {
      expect(guardRoles).toContain(exec);
    }
  });

  it('não vaza acesso a roles fora de escopo (ex: gestor_ads, financeiro)', () => {
    const allowed = getRolesAllowedForPath('/concessoes');
    expect(allowed).not.toContain('gestor_ads');
    expect(allowed).not.toContain('financeiro');
  });
});
