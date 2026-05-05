import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationGroups, useIndependentCategories, useProductCategories } from '@/hooks/useOrganization';
import { useAllBoards } from '@/hooks/useKanban';
import { useUsers } from '@/hooks/useUsers';
import { useAdsManagerBoards } from '@/hooks/useAdsManagerBoards';
import { useOutboundManagerBoards } from '@/hooks/useOutboundManagerBoards';
import { useCrmManagerBoards } from '@/hooks/useCrmManagerBoards';
import { ROLE_LABELS, canViewBoard, canViewRole, isExecutive, UserRole, ROLE_PAGE_MATRIX, GESTOR_PROJETOS_HIDDEN_DOMAINS } from '@/types/auth';
import { usePageAccess } from '@/hooks/usePageAccess';
import { Target } from 'lucide-react';

// ============================================
// CONFIGURAÇÕES DERIVADAS DA MATRIZ ÚNICA
// ============================================
// Toda configuração abaixo é DERIVADA de ROLE_PAGE_MATRIX em src/types/auth.ts.
// Não editar manualmente — toda mudança vai na matriz pra propagar
// consistentemente: admin UI (PAGE_DEFAULTS), filtro de boards (BOARD_VISIBILITY),
// sidebar (SPECIAL_ROUTES, ROLE_BOARD_SLUGS) e categorias independentes.

const EXECUTIVE_ROLES: UserRole[] = ['ceo', 'cto', 'gestor_projetos'];

/**
 * Slug "próprio" de cada cargo (kebab) — usado pra escolher a rota PRO+ default
 * que aparece no atalho "Minha Área". Casa com pageSlug das entries do role.
 */
function getOwnPageSlug(role: UserRole): string {
  return role.replace(/_/g, '-');
}

/**
 * Rota PRO+ "principal" do cargo — aparece como atalho "Minha Área" no topo da sidebar.
 * Mantida com a API antiga (singular por role) pra retrocompat com AppSidebar/tests.
 * Agora derivada da matriz: usa a entry cujo pageSlug = role.
 */
export const SPECIAL_ROUTES: Record<string, { path: string; label: string; icon: React.ElementType }> = (() => {
  const out: Record<string, { path: string; label: string; icon: React.ElementType }> = {};
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    const ownSlug = getOwnPageSlug(role);
    const entry = ROLE_PAGE_MATRIX[role].find(e => e.pageSlug === ownSlug && !!e.proPlusRoute);
    if (entry?.proPlusRoute) {
      out[role] = { ...entry.proPlusRoute, icon: Target };
    }
  }
  // Casos especiais que não casam pageSlug=role (ex: outbound vive em /millennials-outbound,
  // sucesso_cliente em /sucesso-cliente). A lookup acima já cobre porque pageSlug usa kebab do role.
  // gestor_projetos: hub administrativo dedicado, fora da matriz operacional.
  if (!out.gestor_projetos) {
    out.gestor_projetos = { path: '/gestor-projetos', label: 'Gestão de Projetos PRO+', icon: Target };
  }
  return out;
})();

/**
 * TODAS as rotas PRO+ que o role consegue navegar (não só a própria).
 * Sidebar deve renderizar TODAS pra fechar os 11 gaps duros entre o que o admin
 * promete e o que o runtime entrega. Cada item vira um link no menu lateral.
 */
export const SPECIAL_ROUTES_BY_ROLE: Record<UserRole, Array<{
  pageSlug: string;
  path: string;
  label: string;
  icon: React.ElementType;
}>> = (() => {
  const out = {} as Record<UserRole, Array<{ pageSlug: string; path: string; label: string; icon: React.ElementType }>>;
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    out[role] = ROLE_PAGE_MATRIX[role]
      .filter(e => !!e.proPlusRoute)
      .map(e => ({
        pageSlug: e.pageSlug,
        path: e.proPlusRoute!.path,
        label: e.proPlusRoute!.label,
        icon: Target,
      }));
  }
  return out;
})();

/**
 * Boards canônicos por cargo (somente mostrar se existir no banco).
 * Cada item do array é UM kanban; dentro dele, há variações de slug aceitas (fallbacks).
 * Derivado: pega cada entry com boardSlugs declarado e usa esses como variants.
 */
export const ROLE_BOARD_SLUGS: Record<UserRole, string[][]> = (() => {
  const out = {} as Record<UserRole, string[][]>;
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (role === 'ceo') {
      out[role] = [['ceo']];
      continue;
    }
    if (role === 'cto') {
      out[role] = [['ceo']];
      continue;
    }
    if (role === 'gestor_projetos') {
      out[role] = []; // Admin view cobre tudo
      continue;
    }
    out[role] = ROLE_PAGE_MATRIX[role]
      .filter(e => (e.boardSlugs?.length ?? 0) > 0)
      .map(e => e.boardSlugs!);
  }
  return out;
})();

/**
 * Categorias independentes que cada cargo pode ver.
 * Derivado: união dos independentCategorySlugs declarados nas entries do role.
 */
export const ROLE_INDEPENDENT_CATEGORIES: Record<UserRole, string[]> = (() => {
  const out = {} as Record<UserRole, string[]>;
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (EXECUTIVE_ROLES.includes(role)) {
      // gestor_projetos: wildcard com exclusões (ex: rh)
      if (role === 'gestor_projetos') {
        out[role] = ['*', ...GESTOR_PROJETOS_HIDDEN_DOMAINS.map(d => `!${d}`)];
      } else {
        out[role] = ['*'];
      }
      continue;
    }
    const slugs = ROLE_PAGE_MATRIX[role].flatMap(e => e.independentCategorySlugs ?? []);
    out[role] = Array.from(new Set(slugs));
  }
  return out;
})();

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Verifica se um board é do tipo "Gestor de Ads" (deve redirecionar para PRO+).
 * Match preciso por slug (evita falsos positivos como 'downloads' ou 'gestao-ads-especial'),
 * com fallback por nome exato para compatibilidade.
 */
export function isAdsBoard(board: { slug: string; name: string }): boolean {
  const slug = board.slug.toLowerCase();
  const name = board.name.toLowerCase();
  return (
    slug === 'ads' ||
    slug.startsWith('ads-') ||
    name === 'gestor de ads' ||
    name === 'gestão de tráfego' ||
    name.startsWith('gestor de ads ') ||
    name.startsWith('gestão de tráfego ')
  );
}

/**
 * Verifica se um board é do tipo "Outbound" (deve redirecionar para PRO+).
 */
export function isOutboundBoard(board: { slug: string; name: string }): boolean {
  const slug = board.slug.toLowerCase();
  const name = board.name.toLowerCase();
  return (
    slug === 'outbound' ||
    slug.startsWith('outbound-') ||
    slug === 'millennials-outbound' ||
    name === 'outbound' ||
    name.startsWith('outbound ')
  );
}

/**
 * Retorna o path correto para um board (considera redirecionamento PRO+)
 */
export function getBoardPath(board: { slug: string; name: string }): string {
  if (isAdsBoard(board)) {
    return '/gestor-ads';
  }
  if (isOutboundBoard(board)) {
    return '/millennials-outbound';
  }
  return `/kanban/${board.slug}`;
}

/**
 * Retorna o label correto para um board (considera PRO+)
 */
export function getBoardLabel(board: { slug: string; name: string }): string {
  if (isAdsBoard(board)) {
    return 'Gestão de Tráfego PRO+';
  }
  if (isOutboundBoard(board)) {
    return 'Outbound PRO+';
  }
  return board.name;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useSidebarPermissions() {
  const { user, isAdminUser, isCEO, userGroupId, userSquadId } = useAuth();
  const { data: groups = [] } = useOrganizationGroups();
  const { data: categories = [] } = useIndependentCategories();
  const { data: productCategories = [] } = useProductCategories();
  const { data: boards = [] } = useAllBoards();
  const { data: allUsers = [] } = useUsers();
  const { data: adsManagerBoards = [] } = useAdsManagerBoards();
  const { data: outboundManagerBoards = [] } = useOutboundManagerBoards();
  const { data: crmManagerBoards = [] } = useCrmManagerBoards();
  const { data: pageAccess = [] } = usePageAccess();

  // Rotas PRO+ que o usuário REALMENTE pode ver — cruza catálogo (todos os
  // proPlusRoute em ROLE_PAGE_MATRIX, dedup por pageSlug) com os grants reais
  // em user_page_grants (via RPC get_my_page_access). Antes, sidebar consumia
  // SPECIAL_ROUTES_BY_ROLE[user.role] direto da matriz hardcoded por role,
  // ignorando grants direct → bug Maycon (treinador comercial com grants para
  // design/editor-video/gestor-crm não via os links). Admin (isAdminUser)
  // continua bypass — vê tudo.
  const accessibleProPlusRoutes = useMemo(() => {
    if (!user?.role) return [];
    const allEntries = Object.values(ROLE_PAGE_MATRIX).flat();
    const bySlug = new Map<string, { pageSlug: string; path: string; label: string; icon: React.ElementType }>();
    for (const e of allEntries) {
      if (e.proPlusRoute && !bySlug.has(e.pageSlug)) {
        bySlug.set(e.pageSlug, {
          pageSlug: e.pageSlug,
          path: e.proPlusRoute.path,
          label: e.proPlusRoute.label,
          icon: Target,
        });
      }
    }
    return Array.from(bySlug.values()).filter(
      e => isAdminUser || pageAccess.includes(e.pageSlug)
    );
  }, [user?.role, pageAccess, isAdminUser]);

  // Grupos visíveis (CEO vê todos, outros veem apenas seu grupo)
  const visibleGroups = useMemo(() => {
    return isCEO ? groups : groups.filter(g => g.id === userGroupId);
  }, [groups, isCEO, userGroupId]);

  // Grupo e squad do usuário
  const userGroup = useMemo(() => {
    return groups.find(g => g.id === userGroupId);
  }, [groups, userGroupId]);

  const userSquad = useMemo(() => {
    return userGroup?.squads.find(s => s.id === userSquadId);
  }, [userGroup, userSquadId]);

  // Rota especial do usuário (ex: Gestor de Ads PRO+)
  const userSpecialRoute = useMemo(() => {
    return user?.role ? SPECIAL_ROUTES[user.role] : null;
  }, [user?.role]);

  // Verifica se pode ver uma categoria independente
  const canViewCategory = (categorySlug: string): boolean => {
    if (!user?.role) return false;
    const allowed = ROLE_INDEPENDENT_CATEGORIES[user.role] || [];
    if (allowed.includes('*')) {
      // Check exclusions (entries prefixed with '!')
      const excluded = allowed.filter(p => p.startsWith('!')).map(p => p.slice(1));
      if (excluded.some(ex => categorySlug.toLowerCase().includes(ex))) return false;
      return true;
    }
    return allowed.some(pattern => categorySlug.toLowerCase().includes(pattern.toLowerCase()));
  };

  // Categorias independentes visíveis para o usuário
  const visibleCategories = useMemo(() => {
    return categories.filter(cat => canViewCategory(cat.slug));
  }, [categories, user?.role]);

  // Boards visíveis para o cargo do usuário
  const visibleBoards = useMemo(() => {
    if (!user?.role) return [];
    if (isExecutive(user.role) || user.role === 'gestor_projetos') return [];

    const slugGroups = ROLE_BOARD_SLUGS[user.role] || [];

    const picked = slugGroups
      .map((variants) => {
        for (const slug of variants) {
          const exact = boards.find((b) => b.slug === slug);
          if (exact) return exact;
          // Fallback: match apenas se o slug do board começa com o padrão (ex: 'financeiro-board' para 'financeiro')
          const prefixed = boards.find((b) => b.slug.startsWith(slug + '-'));
          if (prefixed) return prefixed;
        }
        return null;
      })
      .filter(Boolean);

    // De-dup by id
    const seen = new Set<string>();
    return picked.filter((b) => {
      if (!b) return false;
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    }) as typeof boards;
  }, [boards, user?.role]);

  // Roles dos usuários em um grupo (filtrado por permissão do visualizador)
  const getGroupRoles = (groupId: string): UserRole[] => {
    const groupUsers = allUsers.filter(u => u.group_id === groupId);
    const roles = [...new Set(groupUsers.map(u => u.role))];
    if (!user?.role) return [];
    return roles.filter(role => canViewRole(user.role, role));
  };

  // Roles dos usuários em um squad (filtrado por permissão do visualizador)
  const getSquadRoles = (squadId: string): UserRole[] => {
    const squadUsers = allUsers.filter(u => u.squad_id === squadId);
    const roles = [...new Set(squadUsers.map(u => u.role))];
    if (!user?.role) return [];
    return roles.filter(role => canViewRole(user.role, role));
  };

  // Roles dos coringas (usuários no grupo mas não em squad)
  // Exclui consultor_comercial pois pertence ao Paddock, não ao Growth.
  // Também exclui roles que já aparecem em algum squad do mesmo grupo,
  // evitando duplicação visual na sidebar (ex: Design em CORINGAS + squads).
  const getCoringaRoles = (groupId: string): UserRole[] => {
    const coringaUsers = allUsers.filter(u => u.group_id === groupId && u.is_coringa && !u.squad_id);
    const roles = [...new Set(coringaUsers.map(u => u.role))];
    if (!user?.role) return [];

    // Roles already represented in squads within this group
    const group = groups.find(g => g.id === groupId);
    const squadRolesInGroup = new Set<UserRole>();
    if (group) {
      for (const squad of group.squads) {
        const squadUsers = allUsers.filter(u => u.squad_id === squad.id);
        for (const u of squadUsers) {
          squadRolesInGroup.add(u.role);
        }
      }
    }

    return roles.filter(role =>
      role !== 'consultor_comercial'
      && canViewRole(user.role, role)
      && !squadRolesInGroup.has(role)
    );
  };

  // Retorna o path correto para um cargo
  const getRoleKanbanPath = (role: UserRole): string => {
    if (SPECIAL_ROUTES[role]) {
      return SPECIAL_ROUTES[role].path;
    }

    const roleSlug = role.replace(/_/g, '-');
    const matchingBoard = boards.find(
      b => b.slug === roleSlug || b.slug.startsWith(roleSlug + '-') || b.name.toLowerCase().includes(ROLE_LABELS[role].toLowerCase())
    );

    if (matchingBoard) {
      return `/kanban/${matchingBoard.slug}`;
    }

    return `/kanban/${roleSlug}`;
  };

  return {
    // Dados do usuário
    user,
    isAdminUser,
    isCEO,
    userGroup,
    userSquad,
    userSpecialRoute,
    accessibleProPlusRoutes,

    // Dados filtrados
    visibleGroups,
    visibleCategories,
    visibleBoards,
    boards,
    adsManagerBoards, // Boards individuais dos gestores de ADS
    outboundManagerBoards, // Boards individuais dos outbound managers
    crmManagerBoards, // Boards individuais dos gestores de CRM
    productCategories, // Categorias de produtos (CEO only)

    // Funções de permissão
    canViewCategory,
    canViewBoard: (slug: string) => user?.role ? canViewBoard(user.role, slug) : false,
    getGroupRoles,
    getSquadRoles,
    getCoringaRoles,
    getRoleKanbanPath,
  };
}
