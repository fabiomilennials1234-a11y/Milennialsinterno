import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { useMeetingsOneOnOne, WeeklyProblem } from '@/hooks/useMeetingsOneOnOne';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklySummarySectionProps {
  problems: WeeklyProblem[];
}

// Generate summary locally from problems data
function generateLocalSummary(problems: WeeklyProblem[]): string {
  const challenges = problems.filter(p => p.problem_type === 'challenge');
  const delays = problems.filter(p => p.problem_type?.startsWith('delay_'));
  const observations = problems.filter(p => p.problem_type === 'observation');
  const clientProblems = problems.filter(p => p.problem_type === 'client_problem');
  const cases = problems.filter(p => p.problem_type === 'case');

  const lines: string[] = [];

  lines.push(`📊 Resumo da Semana — ${problems.length} problema(s) registrado(s)\n`);

  if (challenges.length > 0) {
    // Count occurrences
    const counts: Record<string, number> = {};
    challenges.forEach(c => {
      counts[c.problem_text] = (counts[c.problem_text] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    lines.push('🔴 DESAFIOS PRINCIPAIS:');
    sorted.forEach(([text, count]) => {
      lines.push(`  • ${text}${count > 1 ? ` (${count}x)` : ''}`);
    });
    lines.push('');
  }

  if (delays.length > 0) {
    const delayMap: Record<string, string[]> = {};
    delays.forEach(d => {
      const area = d.problem_type?.replace('delay_', '').toUpperCase() || 'OUTROS';
      if (!delayMap[area]) delayMap[area] = [];
      if (d.manager_name) delayMap[area].push(d.manager_name);
    });

    lines.push('⏰ ATRASOS POR ÁREA:');
    Object.entries(delayMap).forEach(([area, managers]) => {
      lines.push(`  • ${area}: ${managers.length} ocorrência(s) — ${[...new Set(managers)].join(', ')}`);
    });
    lines.push('');
  }

  if (clientProblems.length > 0) {
    lines.push('⚠️ CLIENTES COM DIFICULDADE:');
    clientProblems.forEach(cp => {
      lines.push(`  • ${cp.problem_text}`);
      if (cp.manager_name) lines.push(`    Reportado por: ${cp.manager_name}`);
    });
    lines.push('');
  }

  if (cases.length > 0) {
    lines.push('💡 CASES DA SEMANA:');
    cases.forEach(c => {
      lines.push(`  • ${c.problem_text}`);
      if (c.manager_name) lines.push(`    — ${c.manager_name}`);
    });
    lines.push('');
  }

  if (observations.length > 0) {
    lines.push('📝 OBSERVAÇÕES:');
    observations.forEach(o => {
      lines.push(`  • ${o.problem_text}`);
      if (o.manager_name) lines.push(`    — ${o.manager_name}`);
    });
    lines.push('');
  }

  if (problems.length === 0) {
    lines.push('✅ Nenhum problema registrado esta semana.');
  }

  return lines.join('\n');
}

export default function WeeklySummarySection({ problems }: WeeklySummarySectionProps) {
  const { weeklySummary, saveWeeklySummary, archiveWeeklyProblems } = useMeetingsOneOnOne();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch all past summaries (archived = those not matching current week)
  const { data: archivedSummaries = [] } = useQuery({
    queryKey: ['archived-summaries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: showArchived,
  });

  // Archive: shift week_start back by 1 day so it leaves the "current week" query
  const archiveSummary = useMutation({
    mutationFn: async () => {
      if (weeklySummary?.id) {
        const shifted = new Date(weeklySummary.week_start);
        shifted.setDate(shifted.getDate() - 1);
        await supabase
          .from('weekly_summaries')
          .update({ week_start: shifted.toISOString().split('T')[0] })
          .eq('id', weeklySummary.id);
      }
      await archiveWeeklyProblems.mutateAsync();
      setGeneratedSummary(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-summary'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-problems'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-problems-stats'] });
      queryClient.invalidateQueries({ queryKey: ['archived-summaries'] });
      toast.success('Resumo arquivado e semana reiniciada');
    },
  });

  const handleGenerateSummary = async () => {
    if (problems.length === 0) {
      toast.error('Não há problemas registrados para resumir');
      return;
    }

    setIsGenerating(true);

    try {
      const summary = generateLocalSummary(problems);
      setGeneratedSummary(summary);

      const challengeTexts = problems
        .filter(p => p.problem_type === 'challenge')
        .map(p => p.problem_text);
      const delays = problems
        .filter(p => p.problem_type?.startsWith('delay_'))
        .map(p => p.problem_text);

      await saveWeeklySummary.mutateAsync({
        summary_text: summary,
        main_challenges: challengeTexts.slice(0, 5),
        main_delays: delays.slice(0, 5),
        recommendations: [],
      });

      toast.success('Resumo gerado com sucesso');
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast.error('Erro ao gerar resumo: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const displaySummary = generatedSummary || weeklySummary?.summary_text;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Resumo Inteligente
        </h3>
        <div className="flex items-center gap-2">
          {displaySummary && (
            <Button
              onClick={() => archiveSummary.mutate()}
              disabled={archiveSummary.isPending}
              variant="outline"
              size="sm"
            >
              <Archive className="w-4 h-4 mr-2" />
              Arquivar Resumo
            </Button>
          )}
          <Button
            onClick={handleGenerateSummary}
            disabled={isGenerating || problems.length === 0}
            variant="outline"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {displaySummary ? 'Atualizar Resumo' : 'Resumir'}
              </>
            )}
          </Button>
        </div>
      </div>

      {displaySummary ? (
        <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg bg-muted/50 whitespace-pre-wrap">
          {displaySummary}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Clique em "Resumir" para gerar um resumo inteligente dos problemas da semana
          </p>
        </div>
      )}

      {weeklySummary && (
        <p className="text-xs text-muted-foreground mt-2 text-right">
          Última atualização: {new Date(weeklySummary.generated_at).toLocaleString('pt-BR')}
        </p>
      )}

      {/* Archived summaries toggle */}
      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Archive className="w-4 h-4" />
          Ver resumos arquivados
        </button>

        {showArchived && (
          <div className="mt-3 space-y-3">
            {archivedSummaries.filter(s => s.id !== weeklySummary?.id).length > 0 ? archivedSummaries.filter(s => s.id !== weeklySummary?.id).map(summary => (
              <div key={summary.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Semana de {format(new Date(summary.week_start), "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(summary.generated_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {summary.summary_text}
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                Nenhum resumo arquivado
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
