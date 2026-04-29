// Wrapper fino sobre createKanbanCompletionHooks. Logica vive no factory.
import { createKanbanCompletionHooks, type CompletionNotification } from './createKanbanCompletionHooks';

export type DevCompletionNotification = CompletionNotification;

const hooks = createKanbanCompletionHooks({
  notificationsTable: 'dev_completion_notifications',
  briefingsTable: 'dev_briefings',
  toastMessage: (title) => `Sua demanda de desenvolvimento "${title}" está pronta!`,
  defaultCompletedByName: 'Dev',
  queryKeys: {
    notifications: 'dev-completion-notifications',
    creator: 'dev-card-creator',
    multipleCreators: 'multiple-dev-cards-creators',
  },
});

export const useDevCompletionNotifications     = hooks.useNotifications;
export const useMarkDevNotificationRead        = hooks.useMarkRead;
export const useCreateDevCompletionNotification = hooks.useCreate;
export const useDevCompletionToasts            = hooks.useToasts;
export const useDevCardCreatorInfo             = hooks.useCardCreator;
export const useMultipleDevCardsCreators       = hooks.useMultipleCardsCreators;
