import { FileText, Archive, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useComercialJustifications, 
  useArchiveComercialJustification,
  NOTIFICATION_TYPE_LABELS,
} from '@/hooks/useComercialDelayNotifications';

export default function ComercialJustificativaSection() {
  const { isCEO } = useAuth();
  const { data: justifications = [], isLoading } = useComercialJustifications();
  const archiveJustification = useArchiveComercialJustification();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (justifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto mb-2 opacity-50" size={32} />
        <p className="text-sm font-medium">Nenhuma justificativa</p>
        <p className="text-xs mt-1">Justificativas de atraso aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {justifications.map((justification) => (
        <div 
          key={justification.id}
          className="p-4 rounded-xl border border-subtle bg-card"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="font-medium text-sm">{justification.user_name}</span>
              </div>
              <Badge variant="secondary" className="text-xs mb-2">
                {NOTIFICATION_TYPE_LABELS[justification.notification_type] || justification.notification_type}
              </Badge>
              {justification.client_name && (
                <p className="text-xs text-muted-foreground mb-2">
                  Cliente: {justification.client_name}
                </p>
              )}
            </div>
            {isCEO && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => archiveJustification.mutate(justification.id)}
                disabled={archiveJustification.isPending}
              >
                <Archive size={14} />
              </Button>
            )}
          </div>

          <div className="mt-2 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">{justification.justification}</p>
          </div>

          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={10} />
            <span>
              {format(new Date(justification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
