import { useState } from 'react';
import { Loader2, Sparkles, ChevronDown, ChevronUp, Clock, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOracleSummary } from '@/hooks/useOracleSummary';
import { supabase } from '@/integrations/supabase/client';
import { OracleContentRouter } from './OracleContentRouter';

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

export default function OracleSummarySection({
  type,
  groupId,
  userId,
}: OracleSummarySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const queryClient = useQueryClient();
  const { data: summary, isLoading, isError } = useOracleSummary(type, groupId, userId);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const body: Record<string, unknown> = { type, force: true };
      if (type === 'group') body.group_id = groupId;
      else body.user_id = userId;

      const { error } = await supabase.functions.invoke('generate-oracle-summary', { body });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['oracle-summary', type, groupId, userId] });
      toast.success('Oráculo regenerado');
    } catch (err) {
      console.error('[OracleSummarySection] Regenerate error:', err);
      toast.error('Erro ao regenerar oráculo');
    } finally {
      setRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="p-3 rounded-xl bg-muted/10">
          <Sparkles className="w-6 h-6 text-muted-foreground/20" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground/60">
            Nenhum resumo disponível ainda.
          </p>
          <p className="text-[10px] text-muted-foreground/35">
            O Oráculo gera resumos diariamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary card */}
      <div className="rounded-xl border border-subtle/60 bg-card/50 overflow-hidden shadow-apple">
        {/* Card header -- clickable to expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-foreground">
                Resumo
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {formatReferenceDate(summary.reference_date)}
              </span>
            </div>
          </div>
          <div className="p-1 rounded-md hover:bg-muted/30 transition-colors">
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
            )}
          </div>
        </button>

        {/* Expandable content */}
        {expanded && (
          <div className="px-3.5 pb-3.5 border-t border-subtle/30">
            <div className="pt-3">
              <OracleContentRouter content={summary.summary_content} type={type} />
            </div>

            {/* Footer: timestamp + regenerate */}
            <div className="flex items-center justify-between mt-4 pt-2.5 border-t border-subtle/20">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground/30" />
                <span className="text-[10px] text-muted-foreground/35">
                  {formatTimestamp(summary.created_at)}
                </span>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                title="Regenerar oráculo"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {regenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                <span>Regenerar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
