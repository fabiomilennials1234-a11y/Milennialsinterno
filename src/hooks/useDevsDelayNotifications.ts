// Wrapper fino sobre createKanbanDelayHooks. Logica vive no factory.
import { createKanbanDelayHooks, type DelayNotificationRow, type DelayJustificationRow } from './createKanbanDelayHooks';

export type DevDelayNotification = DelayNotificationRow & {
  dev_id: string;
  dev_name: string;
};

export type DevDelayJustification = DelayJustificationRow & {
  dev_id: string;
  dev_name: string;
};

const hooks = createKanbanDelayHooks({
  cardType: 'dev',
  justificationsTable: 'dev_delay_justifications',
  notificationsTable: 'dev_delay_notifications',
  dismissalsTable: 'dev_notification_dismissals',
  personIdCol: 'dev_id',
  personNameCol: 'dev_name',
  queryKeys: {
    delayed: 'dev-delayed-cards',
    notifications: 'dev-delay-notifications',
    justifications: 'dev-justifications',
    boardCards: 'dev-cards',
  },
});

export const useDevDelayedCards            = hooks.useDelayedCards;
export const useDevDelayNotifications      = hooks.useDelayNotifications;
export const useDevJustifications          = hooks.useJustifications;
export const useCreateDevJustification     = hooks.useCreateJustification;
export const useDismissDevNotification     = hooks.useDismissNotification;
export const useCreateDevDelayNotification = hooks.useCreateDelayNotification;
