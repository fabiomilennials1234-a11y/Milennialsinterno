import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationGroups, useIndependentCategories, useProductCategories } from '@/hooks/useOrganization';
import { useAllBoards } from '@/hooks/useKanban';
import { useUsers } from '@/hooks/useUsers';
import { useAdsManagerBoards } from '@/hooks/useAdsManagerBoards';
import { ROLE_LABELS, canViewBoard, canViewRole, UserRole } from '@/types/auth';
import { Target } from 'lucide-react';

// ============================================
// CONFIGURAÇÕES CENTRALIZADAS DE PERMISSÕES
// ============================================

/**
 * Rotas especiais para cargos (como a página PRO+ do Gestor de Ads)
 */
export const SPECIAL_ROUTES: Record<string, { path: string; label: string; icon: React.ElementType }> = {
  gestor_ads: { path: '/gestor-ads', label: 'Gestão de Tráfego PRO+', icon: Target },
  sucesso_cliente: { path: '/sucesso-cliente', label: 'Sucesso do Cliente PRO+', icon: Target },
  consultor_comercial: { path: '/consultor-comercial', label: 'Comercial PRO+', icon: Target },
  financeiro: { path: '/financeiro', label: 'Financeiro PRO+', icon: Target },
  gestor_projetos: { path: '/gestor-projetos', label: 'Gestão de Projetos PRO+', icon: Target },
  gestor_crm: { path: '/gestor-crm', label: 'CRM PRO+', icon: Target },
  design: { path: '/design', label: 'Design PRO+', icon: Target },
  editor_video: { path: '/editor-video', label: 'Editor de Vídeo PRO+', icon: Target },
  devs: { path: '/devs', label: 'Desenvolvedor PRO+', icon: Target },
  atrizes_gravacao: { path: '/atrizes-gravacao', label: 'Gravação PRO+', icon: Target },
};

/**
 * Boards canônicos por cargo (somente mostrar se existir no banco)
 * Cada item do array é UM kanban; dentro dele, há variações de slug aceitas (fallbacks).
 */
export const ROLE_BOARD_SLUGS: Record<UserRole, string[][]> = {
  ceo: [['ceo']],
  gestor_projetos: [], // Vê tudo via admin view

  // Gestor de Ads: próprio + permitidos
  gestor_ads: [
    ['ads'],
    ['design'],
    ['editor-video'],
    ['devs'],
    ['crm', 'grupo-1-crm', 'grupo-2-crm'],
    ['comercial', 'grupo-1-comercial', 'grupo-2-comercial'],
  ],

  // Sucesso do Cliente: próprio + permitidos
  sucesso_cliente: [
    ['sucesso'],
    ['ads'],
    ['design'],
    ['editor-video'],
    ['devs'],
    ['crm', 'grupo-1-crm', 'grupo-2-crm'],
    ['comercial', 'grupo-1-comercial', 'grupo-2-comercial'],
    ['rh', 'rh-board'],
  ],

  // Design: apenas próprio
  design: [['design']],

  // Editor de Vídeo: apenas próprio
  editor_video: [['editor-video']],

  // Devs: próprio + design
  devs: [['devs'], ['design']],

  // Atrizes para Gravação: próprio independente
  atrizes_gravacao: [['atrizes']],

  // Produtora: NÃO tem kanban de grupo, só independente
  produtora: [],

  // Gestor de CRM: apenas próprio
  gestor_crm: [['crm', 'grupo-1-crm', 'grupo-2-crm']],

  // Consultor Comercial: apenas próprio
  consultor_comercial: [['comercial', 'grupo-1-comercial', 'grupo-2-comercial']],

  // Financeiro: apenas próprio
  financeiro: [['financeiro', 'financeiro-board']],

  // RH: apenas próprio
  rh: [['rh', 'rh-board']],
};

/**
 * Categorias independentes que cada cargo pode ver
 * Produtora e Atrizes são áreas independentes
 * Cadastro de Clientes é visível apenas para CEO e Gestor de Projetos
 */
export const ROLE_INDEPENDENT_CATEGORIES: Record<UserRole, string[]> = {
  ceo: ['*'], // Vê todas
  gestor_projetos: ['*'], // Vê todas
  gestor_ads: ['produtora', 'atrizes'],
  sucesso_cliente: ['produtora', 'atrizes'],
  design: [],
  editor_video: ['atrizes'],
  devs: [],
  atrizes_gravacao: ['atrizes'],
  produtora: ['produtora'],
  gestor_crm: [],
  consultor_comercial: [],
  financeiro: [],
  rh: [],
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Verifica se um board é do tipo "Gestor de Ads" (deve redirecionar para PRO+)
 */
export function isAdsBoard(board: { slug: string; name: string }): boolean {
  return (
    board.slug === 'ads' ||
    board.slug.includes('ads') ||
    board.name.toLowerCase().includes('gestor de ads') ||
    board.name.toLowerCase().includes('gestão de tráfego')
  );
}

/**
 * Retorna o path correto para um board (considera redirecionamento PRO+)
 */
export function getBoardPath(board: { slug: string; name: string }): string {
  if (isAdsBoard(board)) {
    return '/gestor-ads';
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
    if (allowed.includes('*')) return true;
    return allowed.some(pattern => categorySlug.toLowerCase().includes(pattern.toLowerCase()));
  };

  // Categorias independentes visíveis para o usuário
  const visibleCategories = useMemo(() => {
    return categories.filter(cat => canViewCategory(cat.slug));
  }, [categories, user?.role]);

  // Boards visíveis para o cargo do usuário
  const visibleBoards = useMemo(() => {
    if (!user?.role) return [];
    if (user.role === 'ceo' || user.role === 'gestor_projetos') return [];

    const slugGroups = ROLE_BOARD_SLUGS[user.role] || [];
    const picked = slugGroups
      .map((variants) => {
        for (const slug of variants) {
          const exact = boards.find((b) => b.slug === slug);
          if (exact) return exact;
          const partial = boards.find((b) => b.slug.includes(slug));
          if (partial) return partial;
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
  const getCoringaRoles = (groupId: string): UserRole[] => {
    const coringaUsers = allUsers.filter(u => u.group_id === groupId && u.is_coringa && !u.squad_id);
    const roles = [...new Set(coringaUsers.map(u => u.role))];
    if (!user?.role) return [];
    return roles.filter(role => canViewRole(user.role, role));
  };

  // Retorna o path correto para um cargo
  const getRoleKanbanPath = (role: UserRole): string => {
    if (SPECIAL_ROUTES[role]) {
      return SPECIAL_ROUTES[role].path;
    }

    const roleSlug = role.replace(/_/g, '-');
    const matchingBoard = boards.find(
      b => b.slug === roleSlug || b.slug.includes(roleSlug) || b.name.toLowerCase().includes(ROLE_LABELS[role].toLowerCase())
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

    // Dados filtrados
    visibleGroups,
    visibleCategories,
    visibleBoards,
    boards,
    adsManagerBoards, // Boards individuais dos gestores de ADS
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
