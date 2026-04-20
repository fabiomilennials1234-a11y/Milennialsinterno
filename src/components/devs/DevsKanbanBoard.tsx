// Wrapper fino sobre SpecializedKanbanBoard. A lógica toda vive no genérico.
// Ver docs/operations/plan-consolidate-specialized-boards.md.

import SpecializedKanbanBoard from '@/components/kanban/SpecializedKanbanBoard';
import CreateDevCardModal from '@/components/kanban/CreateDevCardModal';
import DevsDelayModal from '@/components/devs/DevsDelayModal';
import {
  canCreateDevCard,
  canArchiveDevCard,
  canMoveDevCard,
} from '@/hooks/useDevsKanban';
import {
  useDevDelayedCards,
  useDevJustifications,
} from '@/hooks/useDevsDelayNotifications';
import {
  useMultipleDevCardsCreators,
  useCreateDevCompletionNotification,
} from '@/hooks/useDevsCompletionNotifications';

const DEV_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-orange-500' },
  { id: 'alteracao', label: 'ALTERAÇÃO', color: 'bg-red-500' },
  { id: 'aguardando_aprovacao', label: 'AGUARDANDO APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovados', label: 'APROVADOS', color: 'bg-green-500' },
] as const;

export default function DevsKanbanBoard() {
  return (
    <SpecializedKanbanBoard
      config={{
        boardSlugLike: '%dev%',
        boardQueryKeyPrefix: 'dev',
        cardType: 'dev',
        fallbackStatus: 'a_fazer',
        statuses: DEV_STATUSES,
        personsRole: 'devs',
        personsEmptyMessage:
          'Nenhum desenvolvedor cadastrado neste squad. Crie um usuário com cargo "Desenvolvedor" para começar.',
        permissions: {
          canCreate: canCreateDevCard,
          canMove: canMoveDevCard,
          canArchive: canArchiveDevCard,
        },
        columnDotClass: 'bg-info',
        useCardCreators: useMultipleDevCardsCreators,
        delay: {
          useDelayedCards: useDevDelayedCards,
          useJustifications: useDevJustifications,
          DelayModal: DevsDelayModal,
          showModalForRole: 'devs',
        },
        afterMoveNotification: {
          targetStatus: 'aguardando_aprovacao',
          useCreateNotification: useCreateDevCompletionNotification,
        },
        CreateCardModal: CreateDevCardModal,
        createModalColumnPropName: 'devColumns',
        createSuccessMessage: 'Demanda de desenvolvimento criada com sucesso',
        cardDetailFlags: { isDevBoard: true },
        attachments: {
          storageBucket: 'card-attachments',
          attachmentsTable: 'card_attachments',
          alsoCreateBriefing: {
            tableName: 'dev_briefings',
            fieldFromPayload: 'materials_url',
          },
        },
        mapPriority: (p) => p || 'normal',
        labels: { noBoardMessage: 'Nenhum quadro de desenvolvimento encontrado' },
      }}
    />
  );
}
