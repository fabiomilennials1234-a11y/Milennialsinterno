import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { useAdsTaskDelayNotifications, useSaveDelayJustification, AdsTaskDelayNotification } from '@/hooks/useAdsTaskDelayNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdsTaskDelayModal() {
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useAdsTaskDelayNotifications();
  const saveMutation = useSaveDelayJustification();
  
  const [currentNotificationId, setCurrentNotificationId] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [justifiedIds, setJustifiedIds] = useState<Set<string>>(new Set());

  // Get current notification from the list
  const currentNotification = notifications.find(n => n.id === currentNotificationId) || null;

  // Filter out already-justified notifications
  const pendingNotifications = notifications.filter(n => !justifiedIds.has(n.id));

  // Set current notification when notifications change
  useEffect(() => {
    if (pendingNotifications.length > 0 && !currentNotificationId && !isProcessing) {
      setCurrentNotificationId(pendingNotifications[0].id);
      setJustification('');
    } else if (pendingNotifications.length === 0) {
      setCurrentNotificationId(null);
    }
  }, [pendingNotifications.length, currentNotificationId, isProcessing]);

  // justifiedIds persist for the entire session to prevent re-showing
  // On page refresh they reset, and the query will have fresh data by then

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentNotification || isProcessing || !justification.trim()) return;

    setIsProcessing(true);
    try {
      await saveMutation.mutateAsync({
        notificationId: currentNotification.id,
        justification: justification.trim(),
      });

      setJustifiedIds(prev => new Set(prev).add(currentNotification.id));
      setCurrentNotificationId(null);
      setJustification('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gerar mensagem baseada no cargo
  const getMessage = () => {
    if (!currentNotification || !user?.role) return '';

    if (user.role === 'gestor_ads') {
      return 'Você tem uma tarefa atrasada. Justifique o porquê tem uma tarefa atrasada.';
    } else {
      return `Seu gestor de ADS (${currentNotification.ads_manager_name}) tem uma tarefa atrasada. Justifique o porquê tem uma tarefa atrasada.`;
    }
  };

  if (isLoading || !currentNotification) {
    return null;
  }

  return (
    <Dialog open={!!currentNotification} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg border-danger/50 bg-card"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 text-danger">
            <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center animate-pulse">
              <AlertTriangle size={28} />
            </div>
            <div>
              <DialogTitle className="text-xl text-danger">Urgente: Tarefa Atrasada</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Ação necessária imediatamente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mensagem principal */}
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg">
            <p className="text-foreground font-medium">
              {getMessage()}
            </p>
          </div>

          {/* Info da tarefa */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-danger" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{currentNotification.task_title}</p>
                <p className="text-sm text-danger font-medium">
                  Prazo: {format(new Date(currentNotification.task_due_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>

            {user?.role !== 'gestor_ads' && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <User size={14} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Gestor: <span className="font-medium text-foreground">{currentNotification.ads_manager_name}</span>
                </span>
              </div>
            )}
          </div>

          {/* Campo de justificativa */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Sua justificativa <span className="text-danger">*</span>
              </label>
              <Textarea
                placeholder="Explique detalhadamente o motivo do atraso..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className={cn(
                  "min-h-[120px] resize-none",
                  !justification.trim() && "border-danger/50"
                )}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-right">
                {justification.length}/500 caracteres
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-danger hover:bg-danger/90 text-white"
              disabled={saveMutation.isPending || !justification.trim()}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Enviar Justificativa'}
            </Button>
          </form>

          {/* Notificações restantes */}
          {pendingNotifications.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              +{pendingNotifications.length - 1} outra{pendingNotifications.length > 2 ? 's' : ''} tarefa{pendingNotifications.length > 2 ? 's' : ''} atrasada{pendingNotifications.length > 2 ? 's' : ''}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
