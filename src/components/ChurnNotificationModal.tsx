import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Calculator } from 'lucide-react';
import { useChurnNotifications, useDismissChurnNotification, ChurnNotification } from '@/hooks/useChurnNotifications';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function generateMathProblem() {
  const operations = ['+', '-'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let a: number, b: number, answer: number;
  
  if (operation === '+') {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
  } else {
    a = Math.floor(Math.random() * 50) + 20;
    b = Math.floor(Math.random() * a) + 1;
    answer = a - b;
  }
  
  return { question: `${a} ${operation} ${b}`, answer };
}

export default function ChurnNotificationModal() {
  const { data: notifications = [], isLoading, isFetching } = useChurnNotifications();
  const dismissMutation = useDismissChurnNotification();
  
  const [currentNotificationId, setCurrentNotificationId] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState('');
  const [mathProblem, setMathProblem] = useState(() => generateMathProblem());
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current notification from the list
  const currentNotification = notifications.find(n => n.id === currentNotificationId) || null;

  // Set current notification when notifications change and there's no current one
  useEffect(() => {
    if (notifications.length > 0 && !currentNotificationId && !isProcessing) {
      setCurrentNotificationId(notifications[0].id);
      setMathProblem(generateMathProblem());
      setUserAnswer('');
      setError('');
    } else if (notifications.length === 0) {
      setCurrentNotificationId(null);
    }
  }, [notifications, currentNotificationId, isProcessing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentNotification || isProcessing) return;

    const parsedAnswer = parseInt(userAnswer, 10);
    
    if (isNaN(parsedAnswer)) {
      setError('Digite um número válido');
      return;
    }
    
    if (parsedAnswer !== mathProblem.answer) {
      setError('Resposta incorreta. Tente novamente.');
      setUserAnswer('');
      // Keep the same math problem, don't regenerate
      return;
    }

    // Correct answer - dismiss notification
    setIsProcessing(true);
    try {
      await dismissMutation.mutateAsync({
        notificationId: currentNotification.id,
        mathAnswer: userAnswer,
      });

      // Clear current notification to allow useEffect to pick the next one
      setCurrentNotificationId(null);
      setUserAnswer('');
      setError('');
      setMathProblem(generateMathProblem());
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !currentNotification) {
    return null;
  }

  return (
    <Dialog open={!!currentNotification} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md border-danger/50 bg-card"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 text-danger">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <DialogTitle className="text-lg">Alerta de Churn</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Um cliente encerrou contrato
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Info */}
          <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg">
            <p className="font-semibold text-foreground text-lg">
              {currentNotification.client_name}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Churn registrado em {format(new Date(currentNotification.notification_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Math Challenge */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calculator size={16} />
              <span>Para confirmar que você viu esta notificação, resolva:</span>
            </div>
            
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {mathProblem.question} = ?
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="number"
                placeholder="Digite sua resposta"
                value={userAnswer}
                onChange={(e) => {
                  setUserAnswer(e.target.value);
                  setError('');
                }}
                className={cn(
                  "text-center text-lg font-medium",
                  error && "border-danger focus-visible:ring-danger"
                )}
                autoFocus
              />
              
              {error && (
                <p className="text-sm text-danger text-center">{error}</p>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={dismissMutation.isPending || !userAnswer}
              >
                {dismissMutation.isPending ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </form>
          </div>

          {/* Remaining notifications */}
          {notifications.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              +{notifications.length - 1} outra{notifications.length > 2 ? 's' : ''} notificação{notifications.length > 2 ? 'ões' : ''} pendente{notifications.length > 2 ? 's' : ''}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
