// Wrapper fino sobre createKanbanCompletionHooks. Logica vive no factory.
import { createKanbanCompletionHooks, type CompletionNotification } from './createKanbanCompletionHooks';

export type VideoCompletionNotification = CompletionNotification;

const hooks = createKanbanCompletionHooks({
  notificationsTable: 'video_completion_notifications',
  briefingsTable: 'video_briefings',
  toastMessage: (title) => `Sua demanda de vídeo "${title}" está pronta!`,
  defaultCompletedByName: 'Editor de Vídeo',
  queryKeys: {
    notifications: 'video-completion-notifications',
    creator: 'video-card-creator',
    multipleCreators: 'multiple-video-cards-creators',
  },
});

export const useVideoCompletionNotifications     = hooks.useNotifications;
export const useMarkVideoNotificationRead        = hooks.useMarkRead;
export const useCreateVideoCompletionNotification = hooks.useCreate;
export const useVideoCompletionToasts            = hooks.useToasts;
export const useVideoCardCreatorInfo             = hooks.useCardCreator;
export const useMultipleVideoCardsCreators       = hooks.useMultipleCardsCreators;
