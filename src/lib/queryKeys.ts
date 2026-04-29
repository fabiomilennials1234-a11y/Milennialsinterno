/**
 * Catálogo central de query keys do React Query.
 *
 * Cada domínio expõe uma fábrica hierárquica que devolve arrays usados como
 * `queryKey` e como filtro de `invalidateQueries`. Padrão inspirado em
 * https://tkdodo.eu/blog/effective-react-query-keys.
 *
 * Princípio: invalidações granulares (mais específicas) e amplas (lista raiz)
 * compartilham o mesmo prefixo, então `invalidateQueries({ queryKey: kanban.all })`
 * derruba TODAS as queries de kanban sem precisar listar cada caso.
 *
 * Migração progressiva: novos hooks já adotam estas keys; hooks antigos serão
 * convertidos sob demanda, em PRs separados, sem big-bang.
 */

export const queryKeys = {
  /** Tudo de cliente. */
  clients: {
    all: ['clients'] as const,
    list: (filters?: Record<string, unknown>) => ['clients', 'list', filters ?? null] as const,
    detail: (clientId: string | undefined) => ['clients', 'detail', clientId] as const,
    /** Alias usado pelo hook legacy `useFinanceiroActiveClients`. */
    financeiroActive: () => ['financeiro-active-clients'] as const,
    /** Tracking diário do cliente. */
    tracking: (clientId: string) => ['client-tracking', clientId] as const,
    /** Onboarding do cliente. */
    onboarding: (clientId: string | undefined) =>
      ['client-onboarding', clientId ?? null] as const,
    /** Tags ativas do cliente. */
    tags: (clientId: string | undefined) => ['client-tags', clientId ?? null] as const,
    tagsBatch: (clientIds: string[]) =>
      ['client-tags-batch', [...clientIds].sort().join(',')] as const,
  },

  /** Kanban genérico. */
  kanban: {
    all: ['kanban'] as const,
    board: (slug: string) => ['kanban', 'board', slug] as const,
    columns: (boardId: string | undefined) =>
      ['kanban', 'columns', boardId ?? null] as const,
    cards: (boardId: string | undefined) =>
      ['kanban', 'cards', boardId ?? null] as const,
    /** Permissões de ação por board (RPC `get_kanban_action_permissions`). */
    actionPermissions: (boardId: string | null | undefined) =>
      ['kanban-action-permissions', boardId ?? null] as const,
  },

  /** Boards especializados (design / video / devs / produtora / atrizes). */
  specializedBoard: (prefix: string) => ({
    all: [`${prefix}-board`] as const,
    board: () => [`${prefix}-board`] as const,
    columns: (boardId: string | undefined) =>
      [`${prefix}-columns`, boardId ?? null] as const,
    cards: (boardId: string | undefined) =>
      [`${prefix}-cards`, boardId ?? null] as const,
    persons: (role: string) => [`all-${prefix}-persons`, role] as const,
  }),

  /** Notificações de delay (factory `createKanbanDelayHooks`). */
  delay: (prefix: string) => ({
    delayedCards: () => [`${prefix}-delayed-cards`] as const,
    notifications: () => [`${prefix}-delay-notifications`] as const,
    justifications: (personName?: string) =>
      [`${prefix}-justifications`, personName ?? null] as const,
  }),

  /** Notificações de completion (factory `createKanbanCompletionHooks`). */
  completion: (prefix: string) => ({
    notifications: () => [`${prefix}-completion-notifications`] as const,
    creator: (cardId: string | undefined) =>
      [`${prefix}-card-creator`, cardId ?? null] as const,
    multipleCreators: (cardIds: string[]) =>
      [`${prefix}-cards-creators`, [...cardIds].sort().join(',')] as const,
  }),

  /** Anexos de card. */
  attachments: {
    byCard: (cardId: string | undefined) => ['card-attachments', cardId ?? null] as const,
    multipleByCards: (cardIds: string[]) =>
      ['multiple-cards-attachments', [...cardIds].sort().join(',')] as const,
  },

  /** Comentários e atividade de card. */
  cardActivity: {
    comments: (cardId: string | undefined) => ['card-comments', cardId ?? null] as const,
    activities: (cardId: string | undefined) => ['card-activities', cardId ?? null] as const,
  },

  /** Briefings (design/video/dev/produtora/atrizes). */
  briefing: {
    byCard: (kind: string, cardId: string | undefined) =>
      [`${kind}-briefing`, cardId ?? null] as const,
  },

  /** Dashboards executivos. */
  dashboards: {
    ceoIndicadores: (month: string) => ['ceo-indicadores', month] as const,
    ceoAdvancedStats: () => ['ceo-advanced-stats'] as const,
    financeiroOverview: () => ['financeiro-overview'] as const,
    outbound: (managerId: string | null) => ['outbound-dashboard', managerId] as const,
    tv: () => ['tv-dashboard-stats'] as const,
  },

  /** Permissões de página (RPC `get_user_page_grants`). */
  pageGrants: {
    user: (userId: string | undefined) => ['user-page-grants', userId ?? null] as const,
  },

  /** Tarefas por área. */
  tasks: {
    ads: (managerId?: string) => ['ads-tasks', managerId ?? null] as const,
    comercial: (userId?: string) => ['comercial-tasks', userId ?? null] as const,
    rh: (filters?: Record<string, unknown>) => ['rh-tarefas', filters ?? null] as const,
  },
} as const;

/**
 * Type helper: extrai a forma de uma key gerada por uma função do catálogo.
 *
 * ```ts
 * type ClientDetailKey = QueryKey<typeof queryKeys.clients.detail>;
 * // ['clients', 'detail', string | undefined]
 * ```
 */
export type QueryKey<T> = T extends (...args: never[]) => infer R ? R : never;
