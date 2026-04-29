// Wrapper fino sobre SpecializedKanbanBoard.
// Atrizes é o outlier: não tem delay/justificativas como os outros 4 e usa
// uma notificação custom com payload estendido (completedBy + name).
// Ver docs/operations/plan-consolidate-specialized-boards.md.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import SpecializedKanbanBoard from '@/components/kanban/SpecializedKanbanBoard';
import CreateAtrizesCardModal from '@/components/kanban/CreateAtrizesCardModal';
import { ATRIZES_STATUSES } from '@/hooks/useAtrizesKanban';
import { useAtrizesCompletionNotifications } from '@/hooks/useAtrizesCompletionNotifications';

// Hook local: busca criadores por cardId. Mesma assinatura dos outros boards
// — permite usar a config genérica de SpecializedKanbanBoard.
function useAtrizesCardCreators(cardIds: string[]) {
  return useQuery({
    queryKey: ['atrizes-card-creators', cardIds.join(',')],
    queryFn: async () => {
      if (cardIds.length === 0) return {};
      const { data: cardsData } = await supabase
        .from('kanban_cards')
        .select('id, created_by')
        .in('id', cardIds);
      const creatorIds = [
        ...new Set((cardsData || []).map(c => c.created_by).filter(Boolean)),
      ] as string[];
      if (creatorIds.length === 0) return {};
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', creatorIds);
      const result: Record<string, { user_id: string; name: string }> = {};
      (cardsData || []).forEach(card => {
        if (card.created_by) {
          const profile = profiles?.find(p => p.user_id === card.created_by);
          if (profile) result[card.id] = { user_id: profile.user_id, name: profile.name };
        }
      });
      return result;
    },
    enabled: cardIds.length > 0,
  });
}

// Hook local: retorna função que dispara a notificação com o payload
// estendido exigido pela tabela atrizes_completion_notifications.
function useAtrizesAfterMove() {
  const { user } = useAuth();
  const { createNotification } = useAtrizesCompletionNotifications();

  return useMemo(
    () =>
      async ({
        card,
        sourceStatus,
        destStatus,
        creator,
      }: {
        card: { id: string; title: string };
        sourceStatus: string;
        destStatus: string;
        creator: { user_id: string; name: string } | undefined;
      }) => {
        const isMovingToApproval =
          destStatus === 'aguardando_aprovacao' && sourceStatus !== 'aguardando_aprovacao';
        if (!isMovingToApproval || !creator || !user) return;

        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle();

        createNotification({
          cardId: card.id,
          cardTitle: card.title,
          completedBy: user.id,
          completedByName: currentUserProfile?.name || 'Atriz',
          requesterId: creator.user_id,
          requesterName: creator.name,
        });
      },
    [user, createNotification]
  );
}

export default function AtrizesKanbanBoard() {
  return (
    <SpecializedKanbanBoard
      config={{
        boardSlugLike: '%atrizes%',
        boardQueryKeyPrefix: 'atrizes',
        cardType: 'atrizes',
        fallbackStatus: 'a_fazer',
        statuses: ATRIZES_STATUSES,
        personsRole: 'atrizes_gravacao',
        personsEmptyMessage:
          'Nenhuma atriz de gravação cadastrada. Crie um usuário com cargo "Atrizes de Gravação" para começar.',
        columnDotClass: 'bg-primary',
        useCardCreators: useAtrizesCardCreators,
        // Atrizes não tem delay/justification — opcional fica omisso.
        useCustomAfterMove: useAtrizesAfterMove,
        CreateCardModal: CreateAtrizesCardModal,
        createModalColumnPropName: 'atrizColumns',
        createSuccessMessage: 'Demanda de gravação criada com sucesso',
        cardDetailFlags: {},
        briefing: {
          tableName: 'atrizes_briefings',
          briefingType: 'atrizes',
          fields: ['client_instagram', 'script_url', 'drive_upload_url'],
          untyped: true,
        },
        mapPriority: (p) => (p === 'urgent' ? 'urgent' : 'medium'),
        labels: { noBoardMessage: 'Nenhum quadro de atrizes encontrado' },
      }}
    />
  );
}
