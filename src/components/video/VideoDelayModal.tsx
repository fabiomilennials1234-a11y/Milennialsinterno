import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCreateVideoJustification } from '@/hooks/useVideoDelayNotifications';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function VideoDelayModal({
  isOpen,
  onClose,
  delayedCards,
}: VideoDelayModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [justification, setJustification] = useState('');
  const createJustification = useCreateVideoJustification();

  const currentCard = delayedCards[currentIndex];
  const remainingCount = delayedCards.length - currentIndex;

  const handleSubmit = async () => {
    if (!justification.trim()) {
      toast.error('Digite uma justificativa');
      return;
    }

    if (!currentCard) return;

    try {
      await createJustification.mutateAsync({
        cardId: currentCard.id,
        justification: justification.trim(),
      });

      toast.success('Justificativa enviada!');
      setJustification('');

      // Move to next card or close
      if (currentIndex < delayedCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
        setCurrentIndex(0);
      }
    } catch (error) {
      toast.error('Erro ao enviar justificativa');
    }
  };

  if (!isOpen || !currentCard) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-fade-in" />
      
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border-2 border-danger overflow-hidden">
        {/* Header */}
        <div className="bg-danger/10 border-b border-danger/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-danger/20">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-danger uppercase tracking-wide">
                Demanda de Vídeo Atrasada
              </h2>
              <p className="text-sm text-muted-foreground">
                {remainingCount > 1 ? `${remainingCount} demandas pendentes` : '1 demanda pendente'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Card Info */}
          <div className="p-4 bg-danger/5 rounded-xl border border-danger/20">
            <p className="text-xs text-muted-foreground mb-1">Demanda:</p>
            <p className="font-semibold text-foreground">{currentCard.title}</p>
            <p className="text-xs text-danger mt-2">
              Prazo: {format(new Date(currentCard.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* Justification Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Por que essa demanda atrasou? *
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva o motivo do atraso..."
              rows={4}
              className="input-apple resize-none"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={createJustification.isPending || !justification.trim()}
              className="px-6 py-2.5 rounded-xl bg-danger text-white font-display font-semibold uppercase text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {createJustification.isPending && <Loader2 size={16} className="animate-spin" />}
              Enviar Justificativa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
