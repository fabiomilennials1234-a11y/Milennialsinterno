// Wrapper fino sobre createKanbanCompletionHooks. Logica vive no factory.
import { createKanbanCompletionHooks, type CompletionNotification } from './createKanbanCompletionHooks';

export type DesignCompletionNotification = CompletionNotification;

const hooks = createKanbanCompletionHooks({
  notificationsTable: 'design_completion_notifications',
  briefingsTable: 'design_briefings',
  toastMessage: (title) => `A sua demanda "${title}" em design está pronta!`,
  defaultCompletedByName: 'Designer',
  queryKeys: {
    notifications: 'design-completion-notifications',
    creator: 'card-creator',
    multipleCreators: 'multiple-cards-creators',
  },
});

export const useDesignCompletionNotifications = hooks.useNotifications;
export const useMarkNotificationRead          = hooks.useMarkRead;
export const useCreateCompletionNotification  = hooks.useCreate;
export const useDesignCompletionToasts        = hooks.useToasts;
export const useCardCreatorInfo               = hooks.useCardCreator;
export const useMultipleCardsCreators         = hooks.useMultipleCardsCreators;
