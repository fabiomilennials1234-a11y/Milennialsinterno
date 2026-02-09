import { useEffect, useState } from 'react';
import { useClientTracking } from '@/hooks/useAdsManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Users } from 'lucide-react';
const TIME_ZONE = 'America/Sao_Paulo';
function getDateKeyInTZ(date: Date, timeZone = TIME_ZONE) {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
interface Props {
  forceShow?: boolean; // Para teste
  onClose?: () => void;
}
export default function AdsMovimentacaoNotification({
  forceShow,
  onClose
}: Props) {
  const {
    data: tracking = []
  } = useClientTracking();
  const [isOpen, setIsOpen] = useState(false);
  const [unmoveTodayCount, setUnmoveTodayCount] = useState(0);
  useEffect(() => {
    // Se forceShow é true, mostra imediatamente para teste
    if (forceShow) {
      setUnmoveTodayCount(tracking.length || 5); // Simula 5 clientes para teste
      setIsOpen(true);
      return;
    }

    // Verifica a cada minuto
    const checkTime = () => {
      const now = new Date();
      const today = getDateKeyInTZ(now);

      // Conta clientes que NÃO foram movidos HOJE (no fuso BR)
      // Um cliente está pendente se last_moved_at não é de hoje
      const notMovedToday = tracking.filter(t => {
        const movedDate = getDateKeyInTZ(new Date(t.last_moved_at));
        return movedDate !== today;
      });
      setUnmoveTodayCount(notMovedToday.length);
      if (notMovedToday.length > 0) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // Verifica imediatamente e depois a cada minuto
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [tracking, forceShow]);
  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };
  return <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Atenção: Movimentação Pendente
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Icon and main message */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Users className="w-8 h-8 text-amber-500" />
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">Você deve movimentar todos os seus clientes antes de finalizar o dia. </p>
              
              <p className="text-sm text-muted-foreground">
                Não esqueça, é <span className="font-bold text-amber-500">obrigatória</span> a movimentação para a realização da documentação do dia.
              </p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {unmoveTodayCount} cliente{unmoveTodayCount > 1 ? 's' : ''} ainda não foi movimentado{unmoveTodayCount > 1 ? ' foram movimentados' : ''} hoje
            </span>
          </div>
          
          {/* Action button */}
          <Button onClick={handleClose} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            Entendi, vou movimentar agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
}