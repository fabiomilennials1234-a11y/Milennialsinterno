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
import { useTaskDelayNotifications, useSaveTaskDelayJustification, TaskDelayNotification, ROLE_LABELS } from '@/hooks/useTaskDelayNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TaskDelayModal() {
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useTaskDelayNotifications();
  const saveMutation = useSaveTaskDelayJustification();
  
  const [currentNotificationId, setCurrentNotificationId] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current notification from the list
  const currentNotification = notifications.find(n => n.id === currentNotificationId) || null;

  // Set current notification when notifications change
  useEffect(() => {
    if (notifications.length > 0 && !currentNotificationId && !isProcessing) {
      setCurrentNotificationId(notifications[0].id);
      setJustification('');
    } else if (notifications.length === 0) {
      setCurrentNotificationId(null);
    }
  }, [notifications, currentNotificationId, isProcessing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentNotification || isProcessing || !justification.trim()) return;

    setIsProcessing(true);
    try {
      await saveMutation.mutateAsync({
        notificationId: currentNotification.id,
        justification: justification.trim(),
      });

      // Clear current notification to allow useEffect to pick the next one
      setCurrentNotificationId(null);
      setJustification('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Verificar se é notificação de onboarding
  const isOnboardingDelay = currentNotification?.task_table === 'client_onboarding';
  
  // Extrair nome do cliente do título do onboarding (formato: "Onboarding: Nome do Cliente (Marco X)")
  const getClientNameFromTitle = (title: string) => {
    const match = title.match(/Onboarding:\s*(.+?)\s*\(Marco/);
    return match ? match[1] : title;
  };

  // Gerar mensagem baseada no contexto
  const getMessage = () => {
    if (!currentNotification || !user?.role) return '';

    const taskOwnerRole = currentNotification.task_owner_role;
    const taskOwnerName = currentNotification.task_owner_name;
    const roleName = ROLE_LABELS[taskOwnerRole] || taskOwnerRole;

    // Mensagens específicas para ONBOARDING atrasado
    if (isOnboardingDelay) {
      const clientName = getClientNameFromTitle(currentNotification.task_title);
      
      // Gestor de ADS (dono do onboarding)
      if (currentNotification.task_owner_id === user.id) {
        return `Seu onboarding do ${clientName} está atrasado, justifique o motivo real abaixo.`;
      }
      
      // Sucesso do Cliente ou Gestor de Projetos
      return `Seu gestor de ADS (${taskOwnerName}) tem um onboarding atrasado, justifique o motivo real abaixo.`;
    }

    // Mensagens para TAREFAS atrasadas (não onboarding)
    // Se o usuário é o dono da tarefa
    if (currentNotification.task_owner_id === user.id) {
      return 'Você tem uma tarefa atrasada. Justifique o porquê tem uma tarefa atrasada.';
    }

    // Se a tarefa é de um gestor_ads e o usuário é sucesso_cliente ou gestor_projetos
    if (taskOwnerRole === 'gestor_ads') {
      return `Seu gestor de ADS (${taskOwnerName}) tem uma tarefa atrasada. Justifique o porquê tem uma tarefa atrasada.`;
    }

    // Para outros casos (gestor_projetos vendo atraso de outros cargos)
    return `${taskOwnerName} (${roleName}) tem uma tarefa atrasada. Justifique junto com ele o porquê tem uma tarefa atrasada.`;
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
              <DialogTitle className="text-xl text-danger">
                {isOnboardingDelay ? 'Urgente: Onboarding Atrasado' : 'Urgente: Tarefa Atrasada'}
              </DialogTitle>
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

            {currentNotification.task_owner_id !== user?.id && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <User size={14} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Responsável: <span className="font-medium text-foreground">{currentNotification.task_owner_name}</span>
                  <span className="text-muted-foreground"> ({ROLE_LABELS[currentNotification.task_owner_role] || currentNotification.task_owner_role})</span>
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
          {notifications.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              +{notifications.length - 1} outra{notifications.length > 2 ? 's' : ''} tarefa{notifications.length > 2 ? 's' : ''} atrasada{notifications.length > 2 ? 's' : ''}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
