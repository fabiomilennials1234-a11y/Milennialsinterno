// Wrapper fino sobre createKanbanDelayHooks. Logica vive no factory.
import { createKanbanDelayHooks, type DelayNotificationRow, type DelayJustificationRow } from './createKanbanDelayHooks';

export type VideoDelayNotification = DelayNotificationRow & {
  editor_id: string;
  editor_name: string;
};

export type VideoDelayJustification = DelayJustificationRow & {
  editor_id: string;
  editor_name: string;
};

const hooks = createKanbanDelayHooks({
  cardType: 'video',
  justificationsTable: 'video_delay_justifications',
  notificationsTable: 'video_delay_notifications',
  dismissalsTable: 'video_notification_dismissals',
  personIdCol: 'editor_id',
  personNameCol: 'editor_name',
  queryKeys: {
    delayed: 'editor-delayed-cards',
    notifications: 'video-delay-notifications',
    justifications: 'editor-justifications',
    boardCards: 'video-cards',
  },
});

export const useEditorDelayedCards          = hooks.useDelayedCards;
export const useVideoDelayNotifications     = hooks.useDelayNotifications;
export const useEditorJustifications        = hooks.useJustifications;
export const useCreateVideoJustification    = hooks.useCreateJustification;
export const useDismissVideoNotification    = hooks.useDismissNotification;
export const useCreateVideoDelayNotification = hooks.useCreateDelayNotification;
