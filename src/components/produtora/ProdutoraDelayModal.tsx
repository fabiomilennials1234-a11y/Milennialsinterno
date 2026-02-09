import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateProdutoraJustification } from '@/hooks/useProdutoraDelayNotifications';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DelayedCard {
  id: string;
  title: string;
  due_date: string | null;
}

interface ProdutoraDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  delayedCards: DelayedCard[];
}

export default function ProdutoraDelayModal({ isOpen, onClose, delayedCards }: ProdutoraDelayModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [justification, setJustification] = useState('');
  const createJustification = useCreateProdutoraJustification();

  if (!isOpen || delayedCards.length === 0) return null;

  const currentCard = delayedCards[currentIndex];
  const isLastCard = currentIndex === delayedCards.length - 1;

  const handleSubmit = async () => {
    if (!justification.trim()) {
      toast.error('Por favor, informe a justificativa');
      return;
    }

    try {
      await createJustification.mutateAsync({
        cardId: currentCard.id,
        justification: justification.trim(),
      });

      toast.success('Justificativa enviada com sucesso');
      setJustification('');

      if (isLastCard) {
        onClose();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      toast.error('Erro ao enviar justificativa');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
      />
      
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl border border-danger/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-border bg-danger/5">
          <div className="p-2 rounded-full bg-danger/10">
            <AlertTriangle className="text-danger" size={24} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Demanda Atrasada
            </h2>
            <p className="text-sm text-muted-foreground">
              {delayedCards.length > 1 
                ? `${currentIndex + 1} de ${delayedCards.length} demandas atrasadas`
                : 'Você possui uma demanda atrasada'
              }
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-danger/5 border border-danger/20">
            <p className="font-semibold text-foreground mb-1">{currentCard.title}</p>
            {currentCard.due_date && (
              <p className="text-sm text-danger">
                Prazo: {format(new Date(currentCard.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Por que esta demanda está atrasada? *
            </label>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Descreva o motivo do atraso..."
              rows={4}
              className="input-apple resize-none"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <Button
            onClick={handleSubmit}
            disabled={createJustification.isPending || !justification.trim()}
            className="bg-danger hover:bg-danger/90 text-white"
          >
            {createJustification.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Enviar Justificativa
          </Button>
        </div>
      </div>
    </div>
  );
}
