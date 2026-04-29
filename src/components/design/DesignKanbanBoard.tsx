// Wrapper fino sobre SpecializedKanbanBoard.
// Ver docs/operations/plan-consolidate-specialized-boards.md.

import SpecializedKanbanBoard from '@/components/kanban/SpecializedKanbanBoard';
import CreateDesignCardModal from '@/components/kanban/CreateDesignCardModal';
import DesignDelayModal from '@/components/design/DesignDelayModal';
import {
  useDesignerDelayedCards,
  useDesignerJustifications,
} from '@/hooks/useDesignDelayNotifications';
import {
  useMultipleCardsCreators,
  useCreateCompletionNotification,
} from '@/hooks/useDesignCompletionNotifications';

const DESIGN_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-orange-500' },
  { id: 'arrumar', label: 'ARRUMAR', color: 'bg-red-500' },
  { id: 'para_aprovacao', label: 'PARA APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovado', label: 'APROVADO', color: 'bg-green-500' },
] as const;

const DESIGN_PRIORITY_MAP: Record<string, string> = {
  normal: 'medium',
  urgent: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export default function DesignKanbanBoard() {
  return (
    <SpecializedKanbanBoard
      config={{
        boardSlugLike: '%design%',
        boardQueryKeyPrefix: 'design',
        cardType: 'design',
        fallbackStatus: 'a_fazer',
        statuses: DESIGN_STATUSES,
        personsRole: 'design',
        personsEmptyMessage:
          'Nenhum designer cadastrado neste squad. Crie um usuário com cargo "Designer" para começar.',
        columnDotClass: 'bg-primary',
        useCardCreators: useMultipleCardsCreators,
        delay: {
          useDelayedCards: useDesignerDelayedCards,
          useJustifications: useDesignerJustifications,
          DelayModal: DesignDelayModal,
          showModalForRole: 'design',
        },
        afterMoveNotification: {
          targetStatus: 'para_aprovacao',
          useCreateNotification: useCreateCompletionNotification,
        },
        CreateCardModal: CreateDesignCardModal,
        createModalColumnPropName: 'designerColumns',
        createSuccessMessage: 'Demanda de design criada com sucesso',
        cardDetailFlags: { isDesignBoard: true },
        briefing: {
          tableName: 'design_briefings',
          briefingType: 'design',
          fields: [
            'description',
            'references_url',
            'identity_url',
            'client_instagram',
            'script_url',
          ],
        },
        mapPriority: (p) => DESIGN_PRIORITY_MAP[p || 'normal'] || 'medium',
        labels: { noBoardMessage: 'Nenhum quadro de design encontrado' },
      }}
    />
  );
}
