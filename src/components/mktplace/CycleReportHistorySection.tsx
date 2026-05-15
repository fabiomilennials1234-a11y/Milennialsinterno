import { useCycleReports } from '@/hooks/useMktplaceCycleReports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  ExternalLink,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  clientId: string;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const datePart = dateStr.split('T')[0];
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

function formatPeriod(start: string, end: string): string {
  return `${formatDateBR(start)} — ${formatDateBR(end)}`;
}

export default function CycleReportHistorySection({ clientId }: Props) {
  const { data: reports, isLoading } = useCycleReports(clientId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <Separator className="mb-3" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Carregando historico de ciclos...</span>
        </div>
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="space-y-2 pt-2">
        <Separator className="mb-3" />
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Historico de Ciclos</span>
        </div>
        <div className="flex items-center gap-2 py-3 px-3 rounded-lg border border-dashed border-muted-foreground/20">
          <FileText className="w-4 h-4 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/60">
            Nenhum relatorio de ciclo criado ainda
          </span>
        </div>
      </div>
    );
  }

  const visibleReports = expanded ? reports : reports.slice(0, 3);
  const hasMore = reports.length > 3;

  return (
    <div className="space-y-2 pt-2">
      <Separator className="mb-3" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Historico de Ciclos
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {reports.length}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        {visibleReports.map((report) => {
          const publicUrl = report.public_token
            ? `${window.location.origin}/relatorio-ciclo/${report.public_token}`
            : null;

          return (
            <div
              key={report.id}
              className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Report number */}
                <span className="text-xs font-bold text-foreground/70 tabular-nums shrink-0">
                  #{report.report_number}
                </span>

                {/* Type badge */}
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 ${
                    report.report_type === 'gestao'
                      ? 'border-purple-500/30 text-purple-400'
                      : 'border-blue-500/30 text-blue-400'
                  }`}
                >
                  {report.report_type === 'gestao' ? 'Gestao' : 'Consultoria'}
                </Badge>

                {/* Period */}
                <span className="text-[11px] text-muted-foreground truncate">
                  {formatPeriod(report.cycle_start_date, report.cycle_end_date)}
                </span>

                {/* Published badge */}
                {report.is_published && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 shrink-0"
                  >
                    Publicado
                  </Badge>
                )}
              </div>

              {/* View button */}
              {publicUrl && report.is_published && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => window.open(publicUrl, '_blank', 'noopener')}
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-[11px] text-muted-foreground gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Ver todos ({reports.length})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
