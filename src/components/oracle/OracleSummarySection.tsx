import { useState } from 'react';
import { Loader2, Sparkles, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useOracleSummary } from '@/hooks/useOracleSummary';

interface OracleSummarySectionProps {
  type: 'group' | 'individual';
  groupId?: string | null;
  userId?: string | null;
}

function formatReferenceDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTimestamp(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Renderiza o conteúdo do resumo oráculo.
 * O LLM retorna texto limpo com títulos em MAIÚSCULAS e listas com "•".
 * Parseamos em blocos visuais para UX consistente.
 */
function OracleContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
    } else if (/^[A-ZÁÀÃÉÊÍÓÔÚÇ\s]{4,}[:]?$/.test(trimmed) || /^\d+\.\s+[A-ZÁÀÃÉÊÍÓÔÚÇ]/.test(trimmed)) {
      // Section header — all caps or numbered section
      elements.push(
        <h4
          key={i}
          className="text-xs font-semibold text-foreground tracking-wide mt-3 mb-1 first:mt-0"
        >
          {trimmed.replace(/^\d+\.\s*/, '')}
        </h4>
      );
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      // Bullet point
      elements.push(
        <p key={i} className="text-xs text-muted-foreground pl-2 py-0.5 leading-relaxed">
          <span className="text-primary/60 mr-1.5">{'•'}</span>
          {trimmed.replace(/^[•\-*]\s*/, '')}
        </p>
      );
    } else {
      // Regular paragraph
      elements.push(
        <p key={i} className="text-xs text-muted-foreground leading-relaxed py-0.5">
          {trimmed}
        </p>
      );
    }
  });

  return <div>{elements}</div>;
}

export default function OracleSummarySection({
  type,
  groupId,
  userId,
}: OracleSummarySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const { data: summary, isLoading, isError } = useOracleSummary(type, groupId, userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Sparkles className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground text-center">
          Nenhum resumo disponível ainda.
          <br />
          O Oráculo gera resumos diariamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary card */}
      <div className="rounded-lg border border-subtle bg-muted/20 overflow-hidden">
        {/* Card header — clickable to expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">
              Resumo — {formatReferenceDate(summary.reference_date)}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Expandable content */}
        {expanded && (
          <div className="px-3 pb-3 border-t border-subtle/50">
            <div className="pt-2">
              <OracleContent content={summary.summary_content} />
            </div>

            {/* Footer: timestamp */}
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-subtle/30">
              <Clock className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50">
                Gerado em {formatTimestamp(summary.created_at)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
