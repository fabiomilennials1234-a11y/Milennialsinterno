import { useMyDelayJustifications } from '@/hooks/useAdsTaskDelayNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  compact?: boolean;
}

export default function MyDelayJustificationsSection({ compact }: Props) {
  const { user } = useAuth();
  const { data: justifications = [], isLoading } = useMyDelayJustifications();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className={cn(
          "p-3 rounded-lg text-center",
          justifications.length > 0 ? "bg-warning/20" : "bg-muted/30"
        )}>
          <p className={cn(
            "font-bold text-2xl",
            justifications.length > 0 ? "text-warning" : "text-muted-foreground"
          )}>
            {justifications.length}
          </p>
          <p className="text-xs text-muted-foreground">Justificativas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="text-xs text-muted-foreground">
        Suas justificativas para tarefas atrasadas do Gestor de Ads
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {justifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="text-success" size={20} />
            </div>
            <p className="font-medium text-sm">Nenhuma justificativa</p>
            <p className="text-xs mt-1">Você não tem justificativas de atraso</p>
          </div>
        ) : (
          justifications.map((item: any) => {
            const notification = item.notification;
            
            return (
              <div
                key={item.id}
                className="p-3 bg-card border border-warning/30 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {notification?.task_title || 'Tarefa'}
                    </p>
                    
                    {notification?.ads_manager_name && user?.role !== 'gestor_ads' && (
                      <p className="text-xs text-muted-foreground">
                        Gestor: {notification.ads_manager_name}
                      </p>
                    )}
                    
                    <div className="mt-2 p-2 bg-muted/30 rounded-md">
                      <p className="text-xs text-foreground">{item.justification}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock size={10} />
                      <span>
                        Justificado em {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
