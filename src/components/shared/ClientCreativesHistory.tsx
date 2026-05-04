import { useClientCreativeUsage } from '@/hooks/useClientCreativeUsage';
import { BarChart3 } from 'lucide-react';

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const idx = parseInt(month, 10) - 1;
  return `${months[idx]} ${year}`;
}

interface Props {
  clientId: string;
  className?: string;
}

export default function ClientCreativesHistory({ clientId, className }: Props) {
  const { data, isLoading } = useClientCreativeUsage(clientId);

  if (isLoading || !data || data.history.length === 0) return null;

  // Show only historical months (skip first if it's current month with no past data)
  const historyToShow = data.history.length > 1 ? data.history.slice(1) : [];
  if (historyToShow.length === 0) return null;

  return (
    <div className={`rounded-lg border border-border p-3 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Meses anteriores
        </span>
      </div>
      <div className="space-y-1.5">
        {historyToShow.map((month) => (
          <div
            key={month.yearMonth}
            className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/30"
          >
            <span className="font-medium text-foreground">
              {formatYearMonth(month.yearMonth)}
            </span>
            <div className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
              <span>{month.video}V</span>
              <span>{month.design}D</span>
              <span className="font-semibold text-foreground">{month.total} total</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
