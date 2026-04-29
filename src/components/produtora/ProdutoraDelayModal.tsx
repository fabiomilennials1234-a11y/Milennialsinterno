// Wrapper fino sobre KanbanDelayModal genérico.
import KanbanDelayModal from '@/components/kanban/KanbanDelayModal';
import { useCreateProdutoraJustification } from '@/hooks/useProdutoraDelayNotifications';

interface DelayedCard {
  id: string;
  title: string;
  due_date: string;
}

interface ProdutoraDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  delayedCards: DelayedCard[];
}

export default function ProdutoraDelayModal(props: ProdutoraDelayModalProps) {
  return (
    <KanbanDelayModal
      {...props}
      useCreateJustification={useCreateProdutoraJustification}
      title="Demanda Atrasada"
    />
  );
}
