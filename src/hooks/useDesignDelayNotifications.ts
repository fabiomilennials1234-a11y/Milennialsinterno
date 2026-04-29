// Wrapper fino sobre createKanbanDelayHooks. Logica vive no factory.
import { createKanbanDelayHooks, type DelayNotificationRow, type DelayJustificationRow } from './createKanbanDelayHooks';

export type DesignDelayNotification = DelayNotificationRow & {
  designer_id: string;
  designer_name: string;
};

export type DesignDelayJustification = DelayJustificationRow & {
  designer_id: string;
  designer_name: string;
};

const hooks = createKanbanDelayHooks({
  cardType: 'design',
  justificationsTable: 'design_delay_justifications',
  notificationsTable: 'design_delay_notifications',
  dismissalsTable: 'design_notification_dismissals',
  personIdCol: 'designer_id',
  personNameCol: 'designer_name',
  queryKeys: {
    delayed: 'designer-delayed-cards',
    notifications: 'design-delay-notifications',
    justifications: 'designer-justifications',
    boardCards: 'design-cards',
  },
});

export const useDesignerDelayedCards         = hooks.useDelayedCards;
export const useDesignDelayNotifications     = hooks.useDelayNotifications;
export const useDesignerJustifications       = hooks.useJustifications;
export const useCreateDesignJustification    = hooks.useCreateJustification;
export const useDismissDesignNotification    = hooks.useDismissNotification;
export const useCreateDesignDelayNotification = hooks.useCreateDelayNotification;
