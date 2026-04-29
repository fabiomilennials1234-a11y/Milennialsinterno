// Wrapper fino sobre createKanbanCompletionHooks. Logica vive no factory.
// Produtora usa realtime channel + sem briefingsTable (creator vem direto de kanban_cards).
import { createKanbanCompletionHooks, type CompletionNotification } from './createKanbanCompletionHooks';

export type ProdutoraCompletionNotification = CompletionNotification;

const hooks = createKanbanCompletionHooks({
  notificationsTable: 'produtora_completion_notifications',
  toastMessage: (title) => `🎬 Sua demanda "${title}" foi gravada!`,
  toastDescription: (name) => `Concluída por ${name}`,
  toastDuration: 8_000,
  defaultCompletedByName: 'Produtora',
  queryKeys: {
    notifications: 'produtora-completion-notifications',
    creator: 'produtora-card-creator',
    multipleCreators: 'produtora-cards-creators',
  },
  realtime: {
    channelName: 'produtora-completion-notifications',
  },
});

export const useProdutoraCompletionNotifications     = hooks.useNotifications;
export const useMarkProdutoraNotificationAsRead      = hooks.useMarkRead;
export const useCreateProdutoraCompletionNotification = hooks.useCreate;
export const useProdutoraCompletionToasts            = hooks.useToasts;
export const useProdutoraCardCreator                 = hooks.useCardCreator;
export const useMultipleProdutoraCardsCreators       = hooks.useMultipleCardsCreators;
