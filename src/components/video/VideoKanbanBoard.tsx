// Wrapper fino sobre SpecializedKanbanBoard.
// Ver docs/operations/plan-consolidate-specialized-boards.md.

import SpecializedKanbanBoard from '@/components/kanban/SpecializedKanbanBoard';
import CreateVideoCardModal from '@/components/kanban/CreateVideoCardModal';
import VideoDelayModal from '@/components/video/VideoDelayModal';
import {
  canCreateVideoCard,
  canArchiveVideoCard,
  canMoveVideoCard,
  VIDEO_STATUSES,
} from '@/hooks/useVideoKanban';
import {
  useEditorDelayedCards,
  useEditorJustifications,
} from '@/hooks/useVideoDelayNotifications';
import {
  useMultipleVideoCardsCreators,
  useCreateVideoCompletionNotification,
} from '@/hooks/useVideoCompletionNotifications';

export default function VideoKanbanBoard() {
  return (
    <SpecializedKanbanBoard
      config={{
        boardSlugLike: '%video%',
        boardQueryKeyPrefix: 'video',
        cardType: 'video',
        fallbackStatus: 'a_fazer',
        statuses: VIDEO_STATUSES,
        personsRole: 'editor_video',
        personsEmptyMessage:
          'Nenhum editor de vídeo cadastrado neste squad. Crie um usuário com cargo "Editor de Vídeo" para começar.',
        permissions: {
          canCreate: canCreateVideoCard,
          canMove: canMoveVideoCard,
          canArchive: canArchiveVideoCard,
        },
        columnDotClass: 'bg-purple-500',
        useCardCreators: useMultipleVideoCardsCreators,
        delay: {
          useDelayedCards: useEditorDelayedCards,
          useJustifications: useEditorJustifications,
          DelayModal: VideoDelayModal,
          showModalForRole: 'editor_video',
        },
        afterMoveNotification: {
          targetStatus: 'aguardando_aprovacao',
          useCreateNotification: useCreateVideoCompletionNotification,
        },
        CreateCardModal: CreateVideoCardModal,
        createModalColumnPropName: 'editorColumns',
        createSuccessMessage: 'Demanda de vídeo criada com sucesso',
        cardDetailFlags: { isVideoBoard: true },
        briefing: {
          tableName: 'video_briefings',
          fields: [
            'script_url',
            'observations',
            'materials_url',
            'reference_video_url',
            'identity_url',
          ],
        },
        mapPriority: (p) => p || 'normal',
        labels: { noBoardMessage: 'Nenhum quadro de vídeo encontrado' },
      }}
    />
  );
}
