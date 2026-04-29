/**
 * Catálogo de permissões granulares — espelho client-side de app_capabilities
 * + matriz de operação kanban.
 *
 * Usado no editor de permissões (EditUserModal) para listar TUDO que pode
 * ser concedido a um usuário, agrupado por categoria.
 *
 * Backend é a fonte canônica (tabelas app_capabilities, user_page_grants,
 * user_capability_grants, user_action_overrides). Este módulo apenas dá
 * shape/labels pra UI.
 */

export type CapabilityCategory =
  | 'pages'
  | 'kanban_actions'
  | 'users'
  | 'organization'
  | 'clients'
  | 'financeiro'
  | 'rh'
  | 'sensitive'
  | 'system';

export interface CapabilityDef {
  key: string;
  label: string;
  category: CapabilityCategory;
  description?: string;
  isSensitive?: boolean;
}

export interface KanbanActionDef {
  key: 'view' | 'create' | 'move' | 'archive' | 'delete' | 'edit_briefing';
  label: string;
}

export const KANBAN_ACTIONS: KanbanActionDef[] = [
  { key: 'view',          label: 'Ver' },
  { key: 'create',        label: 'Criar' },
  { key: 'move',          label: 'Mover' },
  { key: 'archive',       label: 'Arquivar' },
  { key: 'delete',        label: 'Deletar' },
  { key: 'edit_briefing', label: 'Editar briefing' },
];

/** Page slugs que possuem matriz de operação kanban (cobertos por can_operate_kanban_card). */
export const KANBAN_PAGE_SLUGS: { slug: string; label: string }[] = [
  { slug: 'design',              label: 'Design' },
  { slug: 'editor-video',        label: 'Editor de Vídeo' },
  { slug: 'devs',                label: 'Desenvolvedores' },
  { slug: 'produtora',           label: 'Produtora' },
  { slug: 'rh',                  label: 'RH' },
  { slug: 'financeiro',          label: 'Financeiro' },
  { slug: 'gestor-crm',          label: 'CRM' },
  { slug: 'outbound',            label: 'Outbound' },
  { slug: 'consultor-mktplace',  label: 'MKT Place' },
  { slug: 'consultor-comercial', label: 'Consultor Comercial' },
  { slug: 'gestor-ads',          label: 'Gestor de Ads' },
  { slug: 'cadastro-clientes',   label: 'Cadastro de Clientes' },
];

export const CATEGORY_LABEL: Record<CapabilityCategory, string> = {
  pages:          'Visão de páginas',
  kanban_actions: 'Operações em kanbans',
  users:          'Gestão de usuários',
  organization:   'Organização (grupos / squads)',
  clients:        'Clientes',
  financeiro:     'Financeiro',
  rh:             'RH',
  sensitive:      'Acessos sensíveis',
  system:         'Sistema',
};

export const CATEGORY_ORDER: CapabilityCategory[] = [
  'pages',
  'kanban_actions',
  'clients',
  'users',
  'organization',
  'financeiro',
  'rh',
  'system',
  'sensitive',
];
