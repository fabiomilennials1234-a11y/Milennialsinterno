import { Clock, AlertTriangle, BarChart3, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMktplaceRelatorioStatus, type RelatorioStatusColor } from '@/hooks/useMktplaceRelatorioStatus';

interface Props {
  clientId: string;
  trackingType: 'consultoria' | 'gestao';
  className?: string;
  alwaysShow?: boolean;
}

const BAND_STYLES: Record<RelatorioStatusColor, { border: string; text: string; bg: string; pulse: boolean }> = {
  green:   { border: 'border-green-500/30',  text: 'text-green-400',  bg: '',                     pulse: false },
  yellow:  { border: 'border-yellow-500/40', text: 'text-yellow-400', bg: '',                     pulse: false },
  orange:  { border: 'border-orange-500/50', text: 'text-orange-400', bg: 'bg-orange-500/[0.08]', pulse: false },
  red:     { border: 'border-red-500/50',    text: 'text-red-400',    bg: 'bg-red-500/10',        pulse: true  },
  overdue: { border: 'border-red-500/50',    text: 'text-red-500',    bg: 'bg-red-500/10',        pulse: true  },
};

export default function MktplaceRelatorioCountdownBadge({ clientId, trackingType, className, alwaysShow }: Props) {
  const { daysLeft, daysSince, cycleDays, status, statusColor, isLoading } = useMktplaceRelatorioStatus(clientId, trackingType);

  if (isLoading) return null;

  if (status === 'pending') {
    if (!alwaysShow) return null;
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

  if (!alwaysShow && (statusColor === 'green' || statusColor === 'yellow')) return null;

  const band = BAND_STYLES[statusColor];
  const isOverdue = statusColor === 'overdue';
  const Icon = statusColor === 'red' || statusColor === 'orange' || isOverdue ? AlertTriangle
    : statusColor === 'green' && alwaysShow ? BarChart3
    : Clock;

  const label = isOverdue
    ? `Relatório vencido! (+${daysSince - cycleDays}d)`
    : `Relatório em ${daysLeft}d`;

  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-0.5 gap-1 ${band.border} ${band.text} ${band.bg} ${band.pulse ? 'animate-pulse' : ''} ${className || ''}`}
    >
      <Icon size={10} />
      {label}
    </Badge>
  );
}
