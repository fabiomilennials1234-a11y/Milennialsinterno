// Tipos de Cargo do Sistema
export type UserRole =
  | 'ceo'
  | 'cto'
  | 'gestor_projetos'
  | 'gestor_ads'
  | 'outbound'
  | 'sucesso_cliente'
  | 'design'
  | 'editor_video'
  | 'devs'
  | 'produtora'
  | 'gestor_crm'
  | 'consultor_comercial'
  | 'consultor_mktplace'
  | 'financeiro'
  | 'rh';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  can_access_mtech: boolean;
}

// ============================================
// MATRIZ ÚNICA DE PÁGINAS POR CARGO (single source of truth)
// ============================================
// Toda informação de "o que esse cargo enxerga" deriva daqui:
//  - PAGE_DEFAULTS (admin UI) → derivado em src/lib/pageCatalog.ts
//  - BOARD_VISIBILITY (filtro de boards) → derivado abaixo neste arquivo
//  - SPECIAL_ROUTES / SPECIAL_ROUTES_BY_ROLE / ROLE_BOARD_SLUGS
//    → derivados em src/hooks/useSidebarPermissions.ts
//
// Antes desse refactor, 5 fontes (modais, BOARD_VISIBILITY, SPECIAL_ROUTES,
// ROLE_BOARD_SLUGS, ROLE_INDEPENDENT_CATEGORIES) divergiram independentemente
// e o admin "anunciava" páginas que o runtime não entregava (11 gaps duros).
// Mudar AQUI propaga pra todas as superfícies.

export interface RolePageEntry {
  /** Slug canônico da página (kebab-case) — usado em additional_pages e ALL_PAGES */
  pageSlug: string;
  /** Rota direta da sidebar (PRO+). Quando presente, vira um item do menu "Minha Área". */
  proPlusRoute?: { path: string; label: string };
  /** Slugs de board no DB que satisfazem essa página (fallbacks aceitos) */
  boardSlugs?: string[];
  /** Slugs de categoria independente que satisfazem essa página */
  independentCategorySlugs?: string[];
  /** Aliases aceitos no canViewBoard pra essa página (slugs/nomes que devem retornar true) */
  canViewBoardAliases?: string[];
}

export type RolePageMatrix = Record<UserRole, RolePageEntry[]>;

// Helper para o "wildcard" dos executivos: precisa enumerar todas as páginas existentes.
// Construído implicitamente abaixo a partir das próprias entries dos demais cargos.
const _allPagesEntriesPlaceholder: RolePageEntry[] = [];

export const ROLE_PAGE_MATRIX: RolePageMatrix = {
  // CEO/CTO/Gestor de Projetos: wildcard. Preenchido após declaração via Object.assign abaixo.
  ceo: _allPagesEntriesPlaceholder,
  cto: _allPagesEntriesPlaceholder,
  gestor_projetos: _allPagesEntriesPlaceholder,

  gestor_ads: [
    {
      pageSlug: 'gestor-ads',
      proPlusRoute: { path: '/gestor-ads', label: 'Gestão de Tráfego PRO+' },
      boardSlugs: ['ads'],
      canViewBoardAliases: ['gestor_ads', 'ads', 'trafego'],
    },
    {
      pageSlug: 'design',
      proPlusRoute: { path: '/design', label: 'Design PRO+' },
      boardSlugs: ['design'],
      canViewBoardAliases: ['design'],
    },
    {
      pageSlug: 'editor-video',
      proPlusRoute: { path: '/editor-video', label: 'Editor de Vídeo PRO+' },
      boardSlugs: ['editor-video'],
      canViewBoardAliases: ['editor_video', 'video', 'editor'],
    },
    {
      pageSlug: 'devs',
      proPlusRoute: { path: '/devs', label: 'Desenvolvedor PRO+' },
      boardSlugs: ['devs'],
      canViewBoardAliases: ['devs'],
    },
    {
      pageSlug: 'produtora',
      independentCategorySlugs: ['produtora'],
      canViewBoardAliases: ['produtora'],
    },
    {
      pageSlug: 'gestor-crm',
      proPlusRoute: { path: '/gestor-crm', label: 'CRM PRO+' },
      canViewBoardAliases: ['gestor_crm', 'crm'],
    },
    {
      pageSlug: 'consultor-comercial',
      proPlusRoute: { path: '/consultor-comercial', label: 'Treinador Comercial PRO+' },
      canViewBoardAliases: ['consultor_comercial', 'comercial'],
    },
  ],

  outbound: [
    {
      pageSlug: 'gestor-ads',
      proPlusRoute: { path: '/gestor-ads', label: 'Gestão de Tráfego PRO+' },
      boardSlugs: ['ads'],
      canViewBoardAliases: ['gestor_ads', 'ads', 'trafego'],
    },
    {
      pageSlug: 'design',
      proPlusRoute: { path: '/design', label: 'Design PRO+' },
      boardSlugs: ['design'],
      canViewBoardAliases: ['design'],
    },
    {
      pageSlug: 'editor-video',
      proPlusRoute: { path: '/editor-video', label: 'Editor de Vídeo PRO+' },
      boardSlugs: ['editor-video'],
      canViewBoardAliases: ['editor_video', 'video', 'editor'],
    },
    {
      pageSlug: 'devs',
      proPlusRoute: { path: '/devs', label: 'Desenvolvedor PRO+' },
      boardSlugs: ['devs'],
      canViewBoardAliases: ['devs'],
    },
    {
      pageSlug: 'produtora',
      independentCategorySlugs: ['produtora'],
      canViewBoardAliases: ['produtora'],
    },
    {
      pageSlug: 'gestor-crm',
      proPlusRoute: { path: '/gestor-crm', label: 'CRM PRO+' },
      canViewBoardAliases: ['gestor_crm', 'crm'],
    },
    {
      pageSlug: 'consultor-comercial',
      proPlusRoute: { path: '/consultor-comercial', label: 'Treinador Comercial PRO+' },
      canViewBoardAliases: ['consultor_comercial', 'comercial'],
    },
    // Próprio hub Outbound (admin não anunciava antes — runtime entregava). Agora explícito.
    {
      pageSlug: 'outbound',
      proPlusRoute: { path: '/millennials-outbound', label: 'Outbound PRO+' },
      canViewBoardAliases: ['outbound'],
    },
  ],

  sucesso_cliente: [
    {
      pageSlug: 'sucesso-cliente',
      proPlusRoute: { path: '/sucesso-cliente', label: 'Sucesso do Cliente PRO+' },
      boardSlugs: ['sucesso'],
      canViewBoardAliases: ['sucesso_cliente', 'sucesso'],
    },
    {
      pageSlug: 'gestor-ads',
      proPlusRoute: { path: '/gestor-ads', label: 'Gestão de Tráfego PRO+' },
      boardSlugs: ['ads'],
      canViewBoardAliases: ['gestor_ads', 'ads', 'trafego'],
    },
    {
      pageSlug: 'design',
      proPlusRoute: { path: '/design', label: 'Design PRO+' },
      boardSlugs: ['design'],
      canViewBoardAliases: ['design'],
    },
    {
      pageSlug: 'editor-video',
      proPlusRoute: { path: '/editor-video', label: 'Editor de Vídeo PRO+' },
      boardSlugs: ['editor-video'],
      canViewBoardAliases: ['editor_video', 'video', 'editor'],
    },
    {
      pageSlug: 'devs',
      proPlusRoute: { path: '/devs', label: 'Desenvolvedor PRO+' },
      boardSlugs: ['devs'],
      canViewBoardAliases: ['devs'],
    },
    {
      pageSlug: 'produtora',
      independentCategorySlugs: ['produtora'],
      canViewBoardAliases: ['produtora'],
    },
    {
      pageSlug: 'gestor-crm',
      proPlusRoute: { path: '/gestor-crm', label: 'CRM PRO+' },
      canViewBoardAliases: ['gestor_crm', 'crm'],
    },
    {
      pageSlug: 'consultor-comercial',
      proPlusRoute: { path: '/consultor-comercial', label: 'Treinador Comercial PRO+' },
      canViewBoardAliases: ['consultor_comercial', 'comercial'],
    },
    {
      pageSlug: 'cliente-list',
      proPlusRoute: { path: '/lista-clientes', label: 'Lista de Clientes' },
    },
    {
      pageSlug: 'cadastro-clientes',
      proPlusRoute: { path: '/cadastro-clientes', label: 'Cadastro de Clientes' },
    },
    {
      pageSlug: 'upsells',
      proPlusRoute: { path: '/upsells', label: 'UP Sells' },
    },
  ],

  design: [
    {
      pageSlug: 'design',
      proPlusRoute: { path: '/design', label: 'Design PRO+' },
      boardSlugs: ['design'],
      canViewBoardAliases: ['design'],
    },
  ],

  editor_video: [
    {
      pageSlug: 'editor-video',
      proPlusRoute: { path: '/editor-video', label: 'Editor de Vídeo PRO+' },
      boardSlugs: ['editor-video'],
      canViewBoardAliases: ['editor_video', 'video', 'editor'],
    },
  ],

  devs: [
    {
      pageSlug: 'devs',
      proPlusRoute: { path: '/devs', label: 'Desenvolvedor PRO+' },
      boardSlugs: ['devs'],
      canViewBoardAliases: ['devs'],
    },
    {
      pageSlug: 'design',
      proPlusRoute: { path: '/design', label: 'Design PRO+' },
      boardSlugs: ['design'],
      canViewBoardAliases: ['design'],
    },
  ],

  produtora: [
    {
      pageSlug: 'produtora',
      independentCategorySlugs: ['produtora'],
      canViewBoardAliases: ['produtora'],
    },
  ],

  gestor_crm: [
    {
      pageSlug: 'gestor-crm',
      proPlusRoute: { path: '/gestor-crm', label: 'CRM PRO+' },
      canViewBoardAliases: ['gestor_crm', 'crm'],
    },
  ],

  consultor_comercial: [
    {
      pageSlug: 'consultor-comercial',
      proPlusRoute: { path: '/consultor-comercial', label: 'Treinador Comercial PRO+' },
      // 'paddock' mantido como alias histórico (Treinador Comercial vive no Paddock)
      canViewBoardAliases: ['consultor_comercial', 'comercial', 'paddock'],
    },
  ],

  consultor_mktplace: [
    {
      pageSlug: 'consultor-mktplace',
      proPlusRoute: { path: '/consultor-mktplace', label: 'Consultor(a) de MKT Place PRO+' },
      boardSlugs: ['mktplace'],
      canViewBoardAliases: ['consultor_mktplace', 'mktplace'],
    },
  ],

  financeiro: [
    {
      pageSlug: 'financeiro',
      proPlusRoute: { path: '/financeiro', label: 'Financeiro PRO+' },
      boardSlugs: ['financeiro', 'financeiro-board'],
      independentCategorySlugs: ['financeiro'],
      canViewBoardAliases: ['financeiro'],
    },
    {
      pageSlug: 'cliente-list',
      proPlusRoute: { path: '/lista-clientes', label: 'Lista de Clientes' },
    },
    {
      pageSlug: 'comissoes',
      proPlusRoute: { path: '/comissoes', label: 'Comissões' },
    },
  ],

  rh: [],
};

// Wildcards (CEO/CTO/Gestor de Projetos): união de todas as entries únicas por pageSlug.
// Garantimos que executive enxerga TODAS as páginas declaradas pelos demais cargos.
function buildAllPagesEntries(): RolePageEntry[] {
  const seen = new Map<string, RolePageEntry>();
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (role === 'ceo' || role === 'cto' || role === 'gestor_projetos') continue;
    for (const entry of ROLE_PAGE_MATRIX[role]) {
      if (!seen.has(entry.pageSlug)) seen.set(entry.pageSlug, entry);
    }
  }
  return Array.from(seen.values());
}

const _allPagesEntries = buildAllPagesEntries();
// Mutate placeholders in-place (mantém referência igual à do export).
_allPagesEntriesPlaceholder.push(..._allPagesEntries);

export function getAllPagesEntries(): RolePageEntry[] {
  return _allPagesEntries;
}

// ============================================
// HELPERS DE GUARDA DE PÁGINA (derivados da matriz)
// ============================================
// Usados pelos page guards (allowedRoles dentro de cada page component) para
// garantir que sidebar promete == page aceita. Antes desse refactor, sidebar
// derivava da matriz mas guards eram literais — divergência silenciosa.

const _EXECUTIVE_FALLBACK_ROLES: UserRole[] = ['ceo', 'cto', 'gestor_projetos'];

/**
 * Roles permitidas pra acessar uma rota PRO+ específica.
 * Derivado de ROLE_PAGE_MATRIX: cada role cuja entry declara `proPlusRoute.path === path`.
 * Executivos (ceo/cto/gestor_projetos) sempre incluídos (têm '*' em BOARD_VISIBILITY).
 */
export function getRolesAllowedForPath(path: string): UserRole[] {
  const out = new Set<UserRole>();
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (ROLE_PAGE_MATRIX[role].some(e => e.proPlusRoute?.path === path)) {
      out.add(role);
    }
  }
  // Slug do path (ex: '/rh' → 'rh', '/rh/jornada' → 'rh')
  const pathSlug = path.replace(/^\//, '').split('/')[0];
  for (const r of _EXECUTIVE_FALLBACK_ROLES) {
    // gestor_projetos: não adicionar como fallback se path pertence a domínio oculto
    if (r === 'gestor_projetos' && GESTOR_PROJETOS_HIDDEN_DOMAINS.includes(pathSlug)) {
      continue;
    }
    out.add(r);
  }
  return Array.from(out);
}

/**
 * Roles permitidas pra ver uma página (por pageSlug, não por path).
 * Útil pra board viewers (Editor de Vídeo, Atrizes) onde o gating é por página
 * cross-cutting, não por rota PRO+.
 */
export function getRolesWithPageSlug(pageSlug: string): UserRole[] {
  const out = new Set<UserRole>();
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (ROLE_PAGE_MATRIX[role].some(e => e.pageSlug === pageSlug)) {
      out.add(role);
    }
  }
  for (const r of _EXECUTIVE_FALLBACK_ROLES) {
    if (r === 'gestor_projetos' && GESTOR_PROJETOS_HIDDEN_DOMAINS.includes(pageSlug)) {
      continue;
    }
    out.add(r);
  }
  return Array.from(out);
}

// Hierarquia de cargos
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ceo: 100,
  cto: 100,
  gestor_projetos: 90,
  gestor_ads: 60,
  outbound: 50,
  sucesso_cliente: 50,
  design: 40,
  editor_video: 40,
  devs: 40,
  produtora: 40,
  gestor_crm: 40,
  consultor_comercial: 40,
  consultor_mktplace: 40,
  financeiro: 40,
  rh: 40,
};

// Labels dos cargos
export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: 'CEO',
  cto: 'CTO',
  gestor_projetos: 'Gestor de Projetos',
  gestor_ads: 'Gestor de Ads',
  outbound: 'Outbound',
  sucesso_cliente: 'Sucesso do Cliente',
  design: 'Design',
  editor_video: 'Editor de Vídeo',
  devs: 'Desenvolvedor',
  produtora: 'Produtora',
  gestor_crm: 'Gestor de CRM',
  consultor_comercial: 'Treinador Comercial',
  consultor_mktplace: 'Consultor(a) de MKT Place',
  financeiro: 'Financeiro',
  rh: 'RH',
};

// Domínios ocultos para gestor_projetos.
// gestor_projetos tem wildcard '*' em BOARD_VISIBILITY (vê tudo), mas NÃO deve
// ver RH. Em vez de remover o wildcard (quebraria tudo), excluímos domínios
// específicos nos chokepoints: canViewBoard, canViewRole, getRolesAllowedForPath.
// Centralizado aqui pra facilitar futuras exclusões.
export const GESTOR_PROJETOS_HIDDEN_DOMAINS: readonly string[] = ['rh'];

// Regras de visualização de Kanban/Cargo
// DERIVADO de ROLE_PAGE_MATRIX. NÃO editar manualmente — toda mudança vai na matriz.
// Mantido como export pra compatibilidade com consumers existentes (canViewBoard, AppSidebar etc).
export const BOARD_VISIBILITY: Record<UserRole, string[]> = (() => {
  const out = {} as Record<UserRole, string[]>;
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (role === 'ceo' || role === 'cto' || role === 'gestor_projetos') {
      out[role] = ['*'];
      continue;
    }
    const aliases = ROLE_PAGE_MATRIX[role].flatMap(e => e.canViewBoardAliases ?? []);
    out[role] = Array.from(new Set(aliases));
  }
  return out;
})();

// Permissões de criação de abas
export const CAN_CREATE_TABS: UserRole[] = ['ceo', 'cto', 'gestor_projetos'];

// Permissões de criação de bancadas
export const CAN_CREATE_WORKBENCHES: UserRole[] = ['ceo', 'cto', 'gestor_projetos'];

// Permissões de movimento livre de cards
export const CAN_MOVE_CARDS_FREELY: UserRole[] = ['ceo', 'cto', 'gestor_projetos'];

// Verificar se usuário pode ver um board baseado no slug/nome
// Matching é por segmento para evitar falsos positivos (ex: 'ads' não casar com 'downloads').
// Aceita: slug exato, prefixo seguido de '-' (ou '_' / espaço) ou algum segmento igual.
export function canViewBoard(role: UserRole, boardSlugOrName: string): boolean {
  const visibility = BOARD_VISIBILITY[role];

  // gestor_projetos: wildcard EXCETO domínios ocultos
  if (role === 'gestor_projetos' && visibility.includes('*')) {
    const normalized = boardSlugOrName.toLowerCase();
    const segments = normalized.split(/[-_\s]+/).filter(Boolean);
    if (GESTOR_PROJETOS_HIDDEN_DOMAINS.some(d => normalized === d || segments.includes(d))) {
      return false;
    }
    return true;
  }

  if (visibility.includes('*')) return true;

  const normalized = boardSlugOrName.toLowerCase();
  // Split em segmentos por hífen, underscore ou espaço
  const segments = normalized.split(/[-_\s]+/).filter(Boolean);

  return visibility.some(pattern => {
    const normalizedPattern = pattern.toLowerCase();
    if (normalized === normalizedPattern) return true;
    if (
      normalized.startsWith(normalizedPattern + '-') ||
      normalized.startsWith(normalizedPattern + '_') ||
      normalized.startsWith(normalizedPattern + ' ')
    ) {
      return true;
    }
    return segments.includes(normalizedPattern);
  });
}

// Verificar se um cargo pode ver outro cargo/kanban
export function canViewRole(viewerRole: UserRole, targetRole: UserRole): boolean {
  if (viewerRole === 'gestor_projetos') {
    if (GESTOR_PROJETOS_HIDDEN_DOMAINS.includes(targetRole)) return false;
    return true;
  }
  if (isExecutive(viewerRole)) return true;
  
  const visibility = BOARD_VISIBILITY[viewerRole];
  if (visibility.includes('*')) return true;
  
  // Normalize the target role for comparison
  const targetLabel = ROLE_LABELS[targetRole].toLowerCase();
  const targetSlug = targetRole.toLowerCase().replace(/_/g, '-');
  
  // Check if any visibility pattern matches the target role
  return visibility.some(pattern => {
    const normalizedPattern = pattern.toLowerCase();
    return targetLabel.includes(normalizedPattern) || 
           targetSlug.includes(normalizedPattern) ||
           targetRole.includes(normalizedPattern);
  });
}

// Verificar se usuário pode ver uma aba (alias para retrocompatibilidade)
export function canViewTab(role: UserRole, tabId: string): boolean {
  return canViewBoard(role, tabId);
}

// Verificar se usuário pode criar abas
export function canCreateTab(role: UserRole): boolean {
  return CAN_CREATE_TABS.includes(role);
}

// Verificar se usuário pode criar bancadas
export function canCreateWorkbench(role: UserRole): boolean {
  return CAN_CREATE_WORKBENCHES.includes(role);
}

// Verificar se usuário pode mover cards livremente
export function canMoveCardsFreely(role: UserRole): boolean {
  return CAN_MOVE_CARDS_FREELY.includes(role);
}

export function isExecutive(role: UserRole | null | undefined): boolean {
  return role === 'ceo' || role === 'cto';
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return isExecutive(role) || role === 'gestor_projetos';
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return isExecutive(role) || role === 'sucesso_cliente' || role === 'gestor_projetos';
}

export function canRegisterClients(role: UserRole | null | undefined): boolean {
  return isExecutive(role) || role === 'sucesso_cliente' || role === 'gestor_projetos';
}
