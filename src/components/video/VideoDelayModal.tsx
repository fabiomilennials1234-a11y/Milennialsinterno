// Wrapper fino sobre KanbanDelayModal genérico.
import KanbanDelayModal from '@/components/kanban/KanbanDelayModal';
import { useCreateVideoJustification } from '@/hooks/useVideoDelayNotifications';

interface DelayedCard {
  id: string;
  title: string;
  due_date: string;
}

interface VideoDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  delayedCards: DelayedCard[];
}

export default function VideoDelayModal(props: VideoDelayModalProps) {
  return (
    <KanbanDelayModal
      {...props}
      useCreateJustification={useCreateVideoJustification}
      title="Demanda de Vídeo Atrasada"
    />
  );
}
