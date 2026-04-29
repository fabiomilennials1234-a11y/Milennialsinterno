// Wrapper fino sobre createKanbanDelayHooks. Logica vive no factory.
import { createKanbanDelayHooks, type DelayNotificationRow, type DelayJustificationRow } from './createKanbanDelayHooks';

export type ProdutoraDelayNotification = DelayNotificationRow & {
  produtora_id: string;
  produtora_name: string;
};

export type ProdutoraDelayJustification = DelayJustificationRow & {
  produtora_id: string;
  produtora_name: string;
};

const hooks = createKanbanDelayHooks({
  cardType: 'produtora',
  justificationsTable: 'produtora_delay_justifications',
  notificationsTable: 'produtora_delay_notifications',
  dismissalsTable: 'produtora_notification_dismissals',
  personIdCol: 'produtora_id',
  personNameCol: 'produtora_name',
  queryKeys: {
    delayed: 'produtora-delayed-cards',
    notifications: 'produtora-delay-notifications',
    justifications: 'produtora-justifications',
    boardCards: 'produtora-cards',
  },
});

export const useProdutoraDelayedCards            = hooks.useDelayedCards;
export const useProdutoraDelayNotifications      = hooks.useDelayNotifications;
export const useProdutoraJustifications          = hooks.useJustifications;
export const useCreateProdutoraJustification     = hooks.useCreateJustification;
export const useDismissProdutoraNotification     = hooks.useDismissNotification;
export const useCreateProdutoraDelayNotification = hooks.useCreateDelayNotification;
