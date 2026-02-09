// Tipos de Cargo do Sistema
export type UserRole = 
  | 'ceo'
  | 'gestor_projetos'
  | 'gestor_ads'
  | 'sucesso_cliente'
  | 'design'
  | 'editor_video'
  | 'devs'
  | 'atrizes_gravacao'
  | 'produtora'
  | 'gestor_crm'
  | 'consultor_comercial'
  | 'financeiro'
  | 'rh';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

// Hierarquia de cargos
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ceo: 100,
  gestor_projetos: 90,
  gestor_ads: 60,
  sucesso_cliente: 50,
  design: 40,
  editor_video: 40,
  devs: 40,
  atrizes_gravacao: 40,
  produtora: 40,
  gestor_crm: 40,
  consultor_comercial: 40,
  financeiro: 40,
  rh: 40,
};

// Labels dos cargos
export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: 'CEO',
  gestor_projetos: 'Gestor de Projetos',
  gestor_ads: 'Gestor de Ads',
  sucesso_cliente: 'Sucesso do Cliente',
  design: 'Design',
  editor_video: 'Editor de Vídeo',
  devs: 'Desenvolvedor',
  atrizes_gravacao: 'Atrizes para Gravação',
  produtora: 'Produtora',
  gestor_crm: 'Gestor de CRM',
  consultor_comercial: 'Consultor Comercial',
  financeiro: 'Financeiro',
  rh: 'RH',
};

// Regras de visualização de Kanban/Cargo
// Mapeia qual cargo pode ver quais outros cargos/kanbans
export const BOARD_VISIBILITY: Record<UserRole, string[]> = {
  // CEO: Acesso total a todos os Kanban/Cargo
  ceo: ['*'],
  
  // Gestor de Projetos: Acesso total a todos os Kanban/Cargo
  gestor_projetos: ['*'],
  
  // Gestor de Ads: Vê SOMENTE os listados
  gestor_ads: [
    // Próprio cargo (Gestor de Ads = Gestor de Tráfego = PRO+)
    'gestor_ads', 'ads', 'trafego',

    // Cargos permitidos
    'design',
    'editor_video', 'video', 'editor',
    'devs',

    // Cargos independentes
    'produtora',
    'atrizes_gravacao', 'atrizes',

    // Outros cargos permitidos
    'gestor_crm', 'crm',
    'consultor_comercial', 'comercial'
  ],
  
  // Sucesso do Cliente: Vê apenas os listados
  sucesso_cliente: [
    'sucesso_cliente', 'sucesso',     // Próprio cargo
    'gestor_ads', 'ads', 'trafego',   // Gestor de Ads
    'design',                         // Design
    'editor_video', 'video', 'editor', // Editor de Vídeo
    'devs',                           // Devs
    'produtora',                      // Produtora (independente)
    'atrizes_gravacao', 'atrizes',    // Atrizes para Gravação (independente)
    'gestor_crm', 'crm',              // Gestor de CRM
    'consultor_comercial', 'comercial', // Consultor Comercial
    'rh'                              // RH
  ],
  
  // Design: Apenas próprio cargo
  design: ['design'],
  
  // Editor de Vídeo: Apenas próprio cargo
  editor_video: ['editor_video', 'video', 'editor'],
  
  // Devs: Próprio cargo + Design
  devs: ['devs', 'design'],
  
  // Atrizes para Gravação (Independente): Próprio + Editor de Vídeo
  atrizes_gravacao: ['atrizes_gravacao', 'atrizes', 'editor_video', 'video', 'editor'],
  
  // Produtora (Independente): Apenas próprio cargo
  produtora: ['produtora'],
  
  // Gestor de CRM: Apenas próprio cargo
  gestor_crm: ['gestor_crm', 'crm'],
  
  // Consultor Comercial: Apenas próprio cargo
  consultor_comercial: ['consultor_comercial', 'comercial'],
  
  // Financeiro: Apenas próprio cargo
  financeiro: ['financeiro'],
  
  // RH: Apenas próprio cargo
  rh: ['rh'],
};

// Permissões de criação de abas
export const CAN_CREATE_TABS: UserRole[] = ['ceo', 'gestor_projetos'];

// Permissões de criação de bancadas
export const CAN_CREATE_WORKBENCHES: UserRole[] = ['ceo', 'gestor_projetos'];

// Permissões de movimento livre de cards
export const CAN_MOVE_CARDS_FREELY: UserRole[] = ['ceo', 'gestor_projetos'];

// Verificar se usuário pode ver um board baseado no slug/nome
export function canViewBoard(role: UserRole, boardSlugOrName: string): boolean {
  const visibility = BOARD_VISIBILITY[role];
  if (visibility.includes('*')) return true;
  
  // Normalize the board slug/name for comparison
  const normalized = boardSlugOrName.toLowerCase();
  
  // Check if any visibility pattern matches the board
  return visibility.some(pattern => {
    const normalizedPattern = pattern.toLowerCase();
    // Check if the board name/slug contains the pattern
    return normalized.includes(normalizedPattern);
  });
}

// Verificar se um cargo pode ver outro cargo/kanban
export function canViewRole(viewerRole: UserRole, targetRole: UserRole): boolean {
  // CEO e Gestor de Projetos veem tudo
  if (viewerRole === 'ceo' || viewerRole === 'gestor_projetos') return true;
  
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

// Verificar se é admin (CEO ou Gestor de Projetos)
export function isAdmin(role: UserRole): boolean {
  return role === 'ceo' || role === 'gestor_projetos';
}

// Verificar se pode gerenciar usuários (CEO, Gestor de Projetos ou Sucesso do Cliente)
export function canManageUsers(role: UserRole): boolean {
  return role === 'ceo' || role === 'gestor_projetos' || role === 'sucesso_cliente';
}

// Verificar se pode cadastrar clientes (CEO, Gestor de Projetos ou Sucesso do Cliente)
export function canRegisterClients(role: UserRole): boolean {
  return role === 'ceo' || role === 'gestor_projetos' || role === 'sucesso_cliente';
}
