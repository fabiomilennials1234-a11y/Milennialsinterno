import { Clock, AlertTriangle, BarChart3, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMktplaceRelatorioStatus } from '@/hooks/useMktplaceRelatorioStatus';

interface Props {
  clientId: string;
  trackingType: 'consultoria' | 'gestao';
  className?: string;
  alwaysShow?: boolean;
}

export default function MktplaceRelatorioCountdownBadge({ clientId, trackingType, className, alwaysShow }: Props) {
  const { daysLeft, daysSince, cycleDays, status, isLoading } = useMktplaceRelatorioStatus(clientId, trackingType);

  if (isLoading) return null;
  if (!alwaysShow && (status === 'normal' || status === 'pending')) return null;

  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] px-2 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground ${className || ''}`}
      >
        <FileQuestion size={10} />
        Relatorio pendente
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
        Relatorio vencido (+{daysSince - cycleDays}d)
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
        Relatorio em {daysLeft}d
      </Badge>
    );
  }

  // Normal (only shown when alwaysShow)
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground ${className || ''}`}
    >
      <BarChart3 size={10} />
      Relatorio em {daysLeft}d
    </Badge>
  );
}
