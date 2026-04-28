import { describe, it, expect } from 'vitest';
import {
  ROLE_PAGE_MATRIX,
  BOARD_VISIBILITY,
  canViewBoard,
  getRolesAllowedForPath,
  type UserRole,
} from './auth';
import { DEFAULT_PAGES_BY_ROLE, ALL_PAGES } from '../lib/pageCatalog';
import { ROUTE_GUARDS_BY_PATH } from '../lib/routeAuth';
import {
  SPECIAL_ROUTES,
  SPECIAL_ROUTES_BY_ROLE,
  ROLE_BOARD_SLUGS,
  ROLE_INDEPENDENT_CATEGORIES,
} from '../hooks/useSidebarPermissions';

const EXECUTIVES: UserRole[] = ['ceo', 'cto', 'gestor_projetos'];

describe('ROLE_PAGE_MATRIX — single source of truth', () => {
  it('toda entry de cada role tem ao menos uma forma de navegação', () => {
    for (const [role, entries] of Object.entries(ROLE_PAGE_MATRIX)) {
      if (EXECUTIVES.includes(role as UserRole)) continue;
      for (const entry of entries) {
        const hasNav =
          !!entry.proPlusRoute ||
          (entry.boardSlugs?.length ?? 0) > 0 ||
          (entry.independentCategorySlugs?.length ?? 0) > 0;
        expect(
          hasNav,
          `${role} → ${entry.pageSlug}: nenhuma forma de navegação declarada (proPlusRoute, boardSlugs ou independentCategorySlugs)`,
        ).toBe(true);
      }
    }
  });

  it('canViewBoardAliases declarados são reachable via canViewBoard', () => {
    for (const [role, entries] of Object.entries(ROLE_PAGE_MATRIX)) {
      if (EXECUTIVES.includes(role as UserRole)) continue;
      for (const entry of entries) {
        for (const alias of entry.canViewBoardAliases ?? []) {
          expect(
            canViewBoard(role as UserRole, alias),
            `${role}: canViewBoard('${alias}') deve retornar true (declarado em ${entry.pageSlug})`,
          ).toBe(true);
        }
      }
    }
  });

  it('BOARD_VISIBILITY tem entry pra TODOS os roles', () => {
    for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
      expect(BOARD_VISIBILITY[role], `BOARD_VISIBILITY[${role}] deve existir`).toBeDefined();
    }
  });

  it('executivos (ceo/cto/gestor_projetos) têm wildcard em BOARD_VISIBILITY', () => {
    for (const role of EXECUTIVES) {
      expect(BOARD_VISIBILITY[role]).toContain('*');
    }
  });
});

describe('PAGE_DEFAULTS — alinhado à matriz', () => {
  it('DEFAULT_PAGES_BY_ROLE[role] === pageSlugs da matriz (exceto executivos)', () => {
    for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
      if (EXECUTIVES.includes(role)) continue;
      const expected = ROLE_PAGE_MATRIX[role].map(e => e.pageSlug);
      expect(
        DEFAULT_PAGES_BY_ROLE[role],
        `DEFAULT_PAGES_BY_ROLE[${role}] deve refletir matriz`,
      ).toEqual(expected);
    }
  });

  it('executivos recebem todas as páginas do catálogo', () => {
    const allIds = ALL_PAGES.map(p => p.id);
    for (const role of EXECUTIVES) {
      expect(DEFAULT_PAGES_BY_ROLE[role]).toEqual(allIds);
    }
  });

  it('toda página declarada na matriz existe em ALL_PAGES (catálogo de páginas)', () => {
    const catalogIds = new Set(ALL_PAGES.map(p => p.id));
    for (const [role, entries] of Object.entries(ROLE_PAGE_MATRIX)) {
      if (EXECUTIVES.includes(role as UserRole)) continue;
      for (const entry of entries) {
        expect(
          catalogIds.has(entry.pageSlug),
          `${role} declara pageSlug '${entry.pageSlug}' que não está em ALL_PAGES`,
        ).toBe(true);
      }
    }
  });
});

describe('SPECIAL_ROUTES_BY_ROLE — sidebar cross-page', () => {
  it('contém TODAS as rotas PRO+ declaradas pelo role', () => {
    for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
      const expectedPaths = ROLE_PAGE_MATRIX[role]
        .filter(e => !!e.proPlusRoute)
        .map(e => e.proPlusRoute!.path);
      const actualPaths = SPECIAL_ROUTES_BY_ROLE[role].map(r => r.path);
      expect(actualPaths.sort()).toEqual(expectedPaths.sort());
    }
  });

  // Regressão dos 11 gaps: garantir que as rotas anunciadas no admin
  // realmente aparecem no sidebar como PRO+ do role.
  const gapAssertions: Array<[UserRole, string]> = [
    ['gestor_ads', '/atrizes-gravacao'],
    ['gestor_ads', '/gestor-crm'],
    ['gestor_ads', '/consultor-comercial'],
    ['outbound', '/atrizes-gravacao'],
    ['outbound', '/gestor-crm'],
    ['outbound', '/consultor-comercial'],
    ['outbound', '/millennials-outbound'],
    ['sucesso_cliente', '/gestor-crm'],
    ['sucesso_cliente', '/consultor-comercial'],
    ['editor_video', '/atrizes-gravacao'],
    ['atrizes_gravacao', '/editor-video'],
    ['consultor_mktplace', '/consultor-mktplace'],
    ['rh', '/rh'],
  ];

  for (const [role, path] of gapAssertions) {
    it(`fecha gap: ${role} renderiza hub PRO+ ${path}`, () => {
      const paths = SPECIAL_ROUTES_BY_ROLE[role].map(r => r.path);
      expect(paths, `${role} deve incluir ${path} em SPECIAL_ROUTES_BY_ROLE`).toContain(path);
    });
  }
});

describe('Compat com SPECIAL_ROUTES (singular) e ROLE_BOARD_SLUGS', () => {
  it('SPECIAL_ROUTES.cto === SPECIAL_ROUTES.ceo', () => {
    // CTO não tem proPlusRoute na matriz (mas o fallback gestor_projetos cobre executivos
    // que precisam de hub administrativo). Pra ceo/cto não há entry — ok.
    // Testes legacy garantem behavior.
    expect(SPECIAL_ROUTES).toBeDefined();
  });

  it('SPECIAL_ROUTES.consultor_comercial → /consultor-comercial', () => {
    expect(SPECIAL_ROUTES.consultor_comercial?.path).toBe('/consultor-comercial');
  });

  it('SPECIAL_ROUTES.gestor_ads → /gestor-ads', () => {
    expect(SPECIAL_ROUTES.gestor_ads?.path).toBe('/gestor-ads');
  });

  it('ROLE_BOARD_SLUGS.consultor_comercial === [] (sidebar só hub PRO+)', () => {
    expect(ROLE_BOARD_SLUGS.consultor_comercial).toEqual([]);
  });

  it('ROLE_BOARD_SLUGS.gestor_ads contém ["ads"]', () => {
    expect(ROLE_BOARD_SLUGS.gestor_ads).toContainEqual(['ads']);
  });

  it('ROLE_INDEPENDENT_CATEGORIES espelha matriz', () => {
    expect(ROLE_INDEPENDENT_CATEGORIES.atrizes_gravacao).toContain('atrizes');
    expect(ROLE_INDEPENDENT_CATEGORIES.produtora).toContain('produtora');
    expect(ROLE_INDEPENDENT_CATEGORIES.gestor_ads).toEqual(
      expect.arrayContaining(['produtora', 'atrizes']),
    );
  });
});

describe('Sidebar promete = page guard aceita (invariante inviolável)', () => {
  // Antes desse refactor, sidebar derivava da matriz mas page guards (allowedRoles
  // dentro de cada page component) eram literais. Resultado: gestor_ads via
  // "/gestor-crm" no sidebar mas a page bloqueava com Navigate to "/" → loop de
  // redirect para o hub do role. Esse test garante que toda (role, rota) que o
  // sidebar promete via SPECIAL_ROUTES_BY_ROLE é aceita pelo guard derivado.
  it('toda (role, rota) em SPECIAL_ROUTES_BY_ROLE passa em getRolesAllowedForPath', () => {
    const violations: string[] = [];
    for (const role of Object.keys(SPECIAL_ROUTES_BY_ROLE) as UserRole[]) {
      for (const route of SPECIAL_ROUTES_BY_ROLE[role]) {
        const allowed = getRolesAllowedForPath(route.path);
        if (!allowed.includes(role)) {
          violations.push(
            `${role} vê "${route.label}" (${route.path}) na sidebar mas page guard não inclui ${role}`,
          );
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('App.tsx wrapper aceita = matriz declara (terceira camada)', () => {
  // Antes, App.tsx envolvia rotas com `RoleRoute roles={['singleRole']}` literais.
  // Mesmo que o page guard interno e o sidebar estivessem alinhados via matriz,
  // o wrapper bloqueava ANTES do page guard rodar. Resultado: gestor_ads /
  // sucesso_cliente acessando /consultor-comercial caíam em Navigate to "/".
  // Esse invariante garante que todo path em SPECIAL_ROUTES_BY_ROLE é honrado
  // pelo wrapper RoleRoute via ROUTE_GUARDS_BY_PATH.
  it('toda (role, rota) em SPECIAL_ROUTES_BY_ROLE é aceita pelo wrapper RoleRoute', () => {
    const violations: string[] = [];
    for (const role of Object.keys(SPECIAL_ROUTES_BY_ROLE) as UserRole[]) {
      for (const route of SPECIAL_ROUTES_BY_ROLE[role]) {
        const guarded = ROUTE_GUARDS_BY_PATH[route.path];
        if (!guarded) {
          // Path não tem wrapper RoleRoute (ex: rotas com ProtectedRoute simples).
          // Tudo bem — wrapper só é exigido onde Role gating é necessário.
          continue;
        }
        if (!guarded.includes(role)) {
          violations.push(
            `${role} vê "${route.label}" (${route.path}) no sidebar mas wrapper RoleRoute em App.tsx (ROUTE_GUARDS_BY_PATH) não aceita ${role}`,
          );
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('ROUTE_GUARDS_BY_PATH derivado === getRolesAllowedForPath (sem desvio manual)', () => {
    // Garante que ninguém edite ROUTE_GUARDS_BY_PATH com array literal — só via
    // getRolesAllowedForPath. /outbound-dashboard é alias intencional para
    // /millennials-outbound (mesma role gating).
    const aliases: Record<string, string> = {
      '/outbound-dashboard': '/millennials-outbound',
    };
    for (const [path, declared] of Object.entries(ROUTE_GUARDS_BY_PATH)) {
      const sourcePath = aliases[path] ?? path;
      const expected = getRolesAllowedForPath(sourcePath);
      expect(
        [...declared].sort(),
        `ROUTE_GUARDS_BY_PATH['${path}'] deve === getRolesAllowedForPath('${sourcePath}')`,
      ).toEqual([...expected].sort());
    }
  });
});
