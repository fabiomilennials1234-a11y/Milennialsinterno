import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useMeetingsOneOnOne, WeeklyProblem } from '@/hooks/useMeetingsOneOnOne';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WeeklySummarySectionProps {
  problems: WeeklyProblem[];
}

export default function WeeklySummarySection({ problems }: WeeklySummarySectionProps) {
  const { weeklySummary, saveWeeklySummary } = useMeetingsOneOnOne();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    if (problems.length === 0) {
      toast.error('Não há problemas registrados para resumir');
      return;
    }

    setIsGenerating(true);

    try {
      // Preparar os dados para enviar ao AI
      const challengeTexts = problems
        .filter(p => p.problem_type === 'challenge')
        .map(p => p.problem_text);
      
      const delays = problems
        .filter(p => p.problem_type?.startsWith('delay_'))
        .map(p => p.problem_text);
      
      const observations = problems
        .filter(p => p.problem_type === 'observation')
        .map(p => p.problem_text);

      const response = await supabase.functions.invoke('summarize-weekly-problems', {
        body: {
          challenges: challengeTexts,
          delays,
          observations,
          totalProblems: problems.length,
        }
      });

      if (response.error) throw new Error(response.error.message);

      const summary = response.data?.summary;
      if (summary) {
        setGeneratedSummary(summary);
        
        // Salvar o resumo
        await saveWeeklySummary.mutateAsync({
          summary_text: summary,
          main_challenges: challengeTexts.slice(0, 5),
          main_delays: delays.slice(0, 5),
          recommendations: [],
        });
      }
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
    </div>
  );
}
