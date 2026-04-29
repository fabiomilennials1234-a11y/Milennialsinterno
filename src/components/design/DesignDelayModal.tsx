// Wrapper fino sobre KanbanDelayModal genérico.
import KanbanDelayModal from '@/components/kanban/KanbanDelayModal';
import { useCreateDesignJustification } from '@/hooks/useDesignDelayNotifications';

interface DelayedCard {
  id: string;
  title: string;
  due_date: string;
}

interface DesignDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  delayedCards: DelayedCard[];
}

export default function DesignDelayModal(props: DesignDelayModalProps) {
  return (
    <KanbanDelayModal
      {...props}
      useCreateJustification={useCreateDesignJustification}
      title="Demanda Atrasada"
    />
  );
}
