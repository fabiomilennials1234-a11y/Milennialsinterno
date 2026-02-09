import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  useComercialDelayNotifications, 
  useSaveComercialJustification,
  NOTIFICATION_TYPE_LABELS,
} from '@/hooks/useComercialDelayNotifications';
import { useCheckComercialDelays } from '@/hooks/useComercialAutomation';

export default function ComercialDelayModal() {
  const { data: notifications = [], isLoading } = useComercialDelayNotifications();
  const saveJustification = useSaveComercialJustification();
  const [currentNotificationId, setCurrentNotificationId] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Check for delays periodically
  useCheckComercialDelays();

  // Set first notification when available
  useEffect(() => {
    if (notifications.length > 0 && !currentNotificationId) {
      setCurrentNotificationId(notifications[0].id);
      setJustification('');
    }
  }, [notifications, currentNotificationId]);

  const currentNotification = notifications.find(n => n.id === currentNotificationId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!justification.trim() || !currentNotificationId || isProcessing) return;

    setIsProcessing(true);
    try {
      await saveJustification.mutateAsync({
        notificationId: currentNotificationId,
        justification: justification.trim(),
      });
      
      setCurrentNotificationId(null);
      setJustification('');
    } finally {
      setIsProcessing(false);
    }
  };

  const getMessage = () => {
    if (!currentNotification) return '';

    switch (currentNotification.notification_type) {
      case 'novo_cliente_24h':
        return `O cliente "${currentNotification.client_name}" está na fila de novos clientes há mais de 24 horas. Justifique o atraso.`;
      case 'onboarding_5d':
        return `O cliente "${currentNotification.client_name}" está em onboarding há mais de 5 dias. Justifique o atraso.`;
      case 'acompanhamento':
        return `O cliente "${currentNotification.client_name}" não foi movido hoje no acompanhamento. Justifique.`;
      default:
        return 'Você possui uma pendência que requer justificativa.';
    }
  };

  if (isLoading || !currentNotification) {
    return null;
  }

  return (
    <Dialog open={!!currentNotification} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md border-red-200 dark:border-red-800"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Justificativa Obrigatória
          </DialogTitle>
          <DialogDescription className="text-sm">
            {NOTIFICATION_TYPE_LABELS[currentNotification.notification_type] || 'Atraso detectado'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              {getMessage()}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Justificativa</label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explique o motivo do atraso..."
              className="min-h-[100px]"
              maxLength={500}
              required
            />
            <p className="text-xs text-muted-foreground text-right">
              {justification.length}/500
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={!justification.trim() || isProcessing}
          >
            {isProcessing ? 'Enviando...' : 'Enviar Justificativa'}
          </Button>

          {notifications.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">
              +{notifications.length - 1} pendência{notifications.length > 2 ? 's' : ''} restante{notifications.length > 2 ? 's' : ''}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
