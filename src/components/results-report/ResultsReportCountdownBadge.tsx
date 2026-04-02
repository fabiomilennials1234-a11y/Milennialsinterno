import { Clock, AlertTriangle, BarChart3, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useResultsReportStatus } from '@/hooks/useClientResultsReports';

interface Props {
  clientId: string;
  className?: string;
  /** When true, always shows the badge (for kanban cards). When false, only shows when urgent/overdue. */
  alwaysShow?: boolean;
}

export default function ResultsReportCountdownBadge({ clientId, className, alwaysShow }: Props) {
  const { daysLeft, daysSince, status, isLoading } = useResultsReportStatus(clientId);

  if (isLoading) return null;
  if (!alwaysShow && (status === 'normal' || status === 'pending')) return null;

  // Sem contrato assinado — não exibir prazo, mostrar status pendente
  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] px-2 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground ${className || ''}`}
      >
        <FileQuestion size={10} />
        Relatório pendente
      </Badge>
    );
  }

  if (status === 'overdue') {
    return (
      <Badge
        variant="destructive"
        className={`text-[10px] px-2 py-0.5 gap-1 ${className || ''}`}
      >
        <AlertTriangle size={10} />
        Relatório vencido (+{daysSince - 30}d)
      </Badge>
    );
  }

  if (status === 'alert') {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] px-2 py-0.5 gap-1 border-warning text-warning ${className || ''}`}
      >
        <Clock size={10} />
        Relatório em {daysLeft}d
      </Badge>
    );
  }

  // Normal state (only shown when alwaysShow)
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground ${className || ''}`}
    >
      <BarChart3 size={10} />
      Relatório em {daysLeft}d
    </Badge>
  );
}
