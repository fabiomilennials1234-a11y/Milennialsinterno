// Wrapper fino sobre KanbanDelayModal genérico.
import KanbanDelayModal from '@/components/kanban/KanbanDelayModal';
import { useCreateDevJustification } from '@/hooks/useDevsDelayNotifications';

interface DelayedCard {
  id: string;
  title: string;
  due_date: string;
}

interface DevsDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  delayedCards: DelayedCard[];
}

export default function DevsDelayModal(props: DevsDelayModalProps) {
  return (
    <KanbanDelayModal
      {...props}
      useCreateJustification={useCreateDevJustification}
      title="Demanda de Desenvolvimento Atrasada"
    />
  );
}
