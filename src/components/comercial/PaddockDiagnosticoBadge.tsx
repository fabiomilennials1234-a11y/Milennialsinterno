import { Clock, AlertTriangle, ClipboardList, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePaddockDiagnosticoStatus } from '@/hooks/usePaddockDiagnosticoStatus';

interface Props {
  clientId: string;
  className?: string;
}

export default function PaddockDiagnosticoBadge({ clientId, className }: Props) {
  const { daysLeft, daysSince, status, isLoading } = usePaddockDiagnosticoStatus(clientId);

  if (isLoading) return null;

  if (status === 'pending') {
    return (
      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground ${className || ''}`}>
        <FileQuestion size={10} />
        Diagnóstico comercial pendente
      </Badge>
    );
  }

  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className={`text-[10px] px-2 py-0.5 gap-1 ${className || ''}`}>
        <AlertTriangle size={10} />
        Diagnóstico vencido (+{daysSince - 30}d)
      </Badge>
    );
  }

  if (status === 'alert') {
    return (
      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 border-warning text-warning ${className || ''}`}>
        <Clock size={10} />
        Diagnóstico em {daysLeft}d
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground ${className || ''}`}>
      <ClipboardList size={10} />
      Diagnóstico em {daysLeft}d
    </Badge>
  );
}
