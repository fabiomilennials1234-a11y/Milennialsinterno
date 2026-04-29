// Wrapper fino sobre SpecializedKanbanBoard. Lógica vive no genérico.
// Ver docs/operations/plan-consolidate-specialized-boards.md.

import SpecializedKanbanBoard from '@/components/kanban/SpecializedKanbanBoard';
import CreateProdutoraCardModal from '@/components/produtora/CreateProdutoraCardModal';
import ProdutoraDelayModal from '@/components/produtora/ProdutoraDelayModal';
import { PRODUTORA_STATUSES } from '@/hooks/useProdutoraKanban';
import {
  useProdutoraDelayedCards,
  useProdutoraJustifications,
} from '@/hooks/useProdutoraDelayNotifications';
import {
  useMultipleProdutoraCardsCreators,
  useCreateProdutoraCompletionNotification,
} from '@/hooks/useProdutoraCompletionNotifications';

export default function ProdutoraKanbanBoard() {
  return (
    <SpecializedKanbanBoard
      config={{
        boardSlugLike: '%produtora%',
        boardQueryKeyPrefix: 'produtora',
        cardType: 'produtora',
        fallbackStatus: 'a_gravar',
        statuses: PRODUTORA_STATUSES,
        personsRole: 'produtora',
        personsEmptyMessage:
          'Nenhum usuário produtora cadastrado. Crie um usuário com cargo "Produtora" para começar.',
        columnDotClass: 'bg-primary',
        useCardCreators: useMultipleProdutoraCardsCreators,
        delay: {
          useDelayedCards: useProdutoraDelayedCards,
          useJustifications: useProdutoraJustifications,
          DelayModal: ProdutoraDelayModal,
          showModalForRole: 'produtora',
        },
        afterMoveNotification: {
          targetStatus: 'aguardando_aprovacao',
          useCreateNotification: useCreateProdutoraCompletionNotification,
        },
        CreateCardModal: CreateProdutoraCardModal,
        createModalColumnPropName: 'produtoraColumns',
        createSuccessMessage: 'Demanda de produtora criada com sucesso',
        cardDetailFlags: { isProdutoraBoard: true },
        briefing: {
          tableName: 'produtora_briefings',
          briefingType: 'produtora',
          fields: ['script_url', 'observations', 'reference_video_url'],
        },
        mapPriority: (p) => (p === 'urgent' ? 'urgent' : 'medium'),
        labels: { noBoardMessage: 'Nenhum quadro de produtora encontrado' },
      }}
    />
  );
}
