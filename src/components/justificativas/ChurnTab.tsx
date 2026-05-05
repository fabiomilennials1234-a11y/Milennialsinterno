import { useState } from 'react';
import { AlertTriangle, Calculator, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useChurnNotifications, useDismissChurnNotification, type ChurnNotification } from '@/hooks/useChurnNotifications';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function generateMathProblem() {
  const operations = ['+', '-'] as const;
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

function ChurnCard({ notification }: { notification: ChurnNotification }) {
  const dismissMutation = useDismissChurnNotification();
  const [mathProblem] = useState(() => generateMathProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(userAnswer, 10);

    if (isNaN(parsed)) {
      setError('Digite um numero valido');
      return;
    }

    if (parsed !== mathProblem.answer) {
      setError('Resposta incorreta. Tente novamente.');
      setUserAnswer('');
      return;
    }

    await dismissMutation.mutateAsync({
      notificationId: notification.id,
      mathAnswer: userAnswer,
    });
    setDismissed(true);
  };

  if (dismissed) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
            <Check size={16} className="text-success" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{notification.client_name}</p>
            <p className="text-xs text-muted-foreground">Confirmado</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-danger/50 bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-danger/15 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} className="text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{notification.client_name}</p>
          <p className="text-xs text-muted-foreground">
            Churn em {format(new Date(notification.notification_date), "dd 'de' MMM 'as' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calculator size={14} />
          <span>Resolva para confirmar que voce viu:</span>
        </div>

        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <p className="text-xl font-bold text-foreground">{mathProblem.question} = ?</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="number"
            placeholder="Resposta"
            value={userAnswer}
            onChange={(e) => {
              setUserAnswer(e.target.value);
              setError('');
            }}
            className={cn(
              'text-center font-medium flex-1',
              error && 'border-danger focus-visible:ring-danger',
            )}
          />
          <Button
            type="submit"
            size="sm"
            disabled={dismissMutation.isPending || !userAnswer}
          >
            {dismissMutation.isPending ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </form>

        {error && <p className="text-xs text-danger text-center">{error}</p>}
      </div>
    </div>
  );
}

export default function ChurnTab() {
  const { data: notifications = [], isLoading } = useChurnNotifications();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Nenhum alerta de churn pendente.</p>
        <p className="text-sm">Todos os alertas foram confirmados.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {notifications.map((n) => (
        <li key={n.id}>
          <ChurnCard notification={n} />
        </li>
      ))}
    </ul>
  );
}
