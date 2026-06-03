import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  daysRemaining: number;
  totalDays: number;
  className?: string;
}

type Severity = 'green' | 'yellow' | 'orange' | 'red';

function getSeverity(daysRemaining: number, totalDays: number): Severity {
  if (daysRemaining <= 0) return 'red';
  const pct = daysRemaining / totalDays;
  if (pct >= 0.50) return 'green';
  if (pct >= 0.25) return 'yellow';
  return 'orange';
}

const SEVERITY_STYLES: Record<Severity, string> = {
  green:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  red:    'bg-destructive/10 text-destructive border-destructive/30',
};

export default function CycleReportCountdownBadge({ daysRemaining, totalDays, className }: Props) {
  const severity = getSeverity(daysRemaining, totalDays);
  const overdueDays = Math.abs(daysRemaining);

  const label = daysRemaining <= 0
    ? `Relatorio vencido (+${overdueDays}d)`
    : `Relatorio em ${daysRemaining}d`;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-2 py-0.5 gap-1',
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      <BarChart3 size={10} />
      {label}
    </Badge>
  );
}

