import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3,
  Star,
  Lightbulb,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import {
  useAllNPSTeamResponses,
  useLatestTeamSummary,
  useGenerateTeamSummary,
  calculateTeamStats,
} from '@/hooks/useNPSSurveys';

const EXPERIENCE_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Boa',
  5: 'Excelente',
};

const EFFICIENCY_ICONS: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  sim: { icon: CheckCircle2, color: 'text-green-600' },
  parcialmente: { icon: AlertCircle, color: 'text-yellow-600' },
  nao: { icon: XCircle, color: 'text-red-600' },
};

export default function NPSTeamOKRSection() {
  const { data: responses, isLoading: responsesLoading } = useAllNPSTeamResponses();
  const { data: latestSummary, isLoading: summaryLoading } = useLatestTeamSummary();
  const generateSummary = useGenerateTeamSummary();
  const [showAllResponses, setShowAllResponses] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const stats = calculateTeamStats(responses || []);

  const getExperienceColor = (avg: number) => {
    if (avg >= 4) return 'text-green-600';
    if (avg >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleGenerateSummary = () => {
    generateSummary.mutate();
    setShowSummary(true);
  };

  if (responsesLoading) {
    return (
      <section className="card-apple p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  return (
    <section className="card-apple p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-500" />
          NPS TIME + Baú de Ideias
          {stats.totalResponses > 0 && (
            <Badge variant="secondary">{stats.totalResponses} respostas</Badge>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSummary}
          disabled={generateSummary.isPending || stats.totalResponses === 0}
        >
          {generateSummary.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Resumo inteligente
        </Button>
      </div>

      {stats.totalResponses === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma resposta de equipe disponível</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="text-center bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-center gap-1">
                <Star className={`h-5 w-5 ${getExperienceColor(stats.averageExperience)} fill-current`} />
                <span className={`text-3xl font-bold ${getExperienceColor(stats.averageExperience)}`}>
                  {stats.averageExperience}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Média Experiência</p>
            </div>
            <div className="text-center bg-muted/50 rounded-lg p-4">
              <span className="text-3xl font-bold">{stats.totalResponses}</span>
              <p className="text-xs text-muted-foreground mt-1">Total Respostas</p>
            </div>
            <div className="text-center bg-green-500/10 rounded-lg p-4">
              <span className="text-3xl font-bold text-green-600">{stats.efficiencyBreakdown.sim}</span>
              <p className="text-xs text-muted-foreground mt-1">Eficiente (Sim)</p>
            </div>
            <div className="text-center bg-yellow-500/10 rounded-lg p-4">
              <span className="text-3xl font-bold text-yellow-600">
                {stats.efficiencyBreakdown.parcialmente + stats.efficiencyBreakdown.nao}
              </span>
              <p className="text-xs text-muted-foreground mt-1">Parcial + Não</p>
            </div>
          </div>

          {/* AI Summary */}
          {(showSummary || latestSummary) && (
            <div className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border border-purple-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">Resumo Inteligente</h3>
                {latestSummary && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Gerado em {new Date(latestSummary.generated_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              {generateSummary.isPending ? (
                <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Gerando resumo...</span>
                </div>
              ) : latestSummary ? (
                <div className="text-sm whitespace-pre-line leading-relaxed">
                  {latestSummary.summary_content}
                </div>
              ) : generateSummary.data ? (
                <div className="text-sm whitespace-pre-line leading-relaxed">
                  {generateSummary.data.summary}
                </div>
              ) : null}
            </div>
          )}

          {/* Anonymous responses */}
          <div>
            <button
              onClick={() => setShowAllResponses(!showAllResponses)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllResponses ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Ver todas as respostas (anônimas)
            </button>

            {showAllResponses && responses && (
              <ScrollArea className="h-[400px] mt-3">
                <div className="space-y-3 pr-4">
                  {responses.map((response) => {
                    const getColor = (rating: number) => {
                      if (rating >= 4) return 'bg-green-500';
                      if (rating >= 3) return 'bg-yellow-500';
                      return 'bg-red-500';
                    };

                    const eff = EFFICIENCY_ICONS[response.efficiency_assessment];
                    const EffIcon = eff.icon;

                    return (
                      <Card key={response.id} className="border-subtle">
                        <CardContent className="p-4 space-y-2">
                          {/* Rating + Efficiency */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full ${getColor(response.experience_rating)} text-white flex items-center justify-center font-bold text-xs`}>
                                {response.experience_rating}
                              </div>
                              <span className="text-sm font-medium">
                                {EXPERIENCE_LABELS[response.experience_rating]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <EffIcon className={`h-3.5 w-3.5 ${eff.color}`} />
                              <span className={`text-xs ${eff.color}`}>
                                {response.efficiency_assessment === 'sim' ? 'Eficiente' :
                                 response.efficiency_assessment === 'parcialmente' ? 'Parcial' : 'Ineficiente'}
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          {response.positive_highlight && (
                            <div className="text-xs">
                              <span className="text-green-600 dark:text-green-400 font-medium">Positivo: </span>
                              {response.positive_highlight}
                            </div>
                          )}
                          {response.improvement_area && (
                            <div className="text-xs">
                              <span className="text-yellow-600 dark:text-yellow-400 font-medium">Melhorar: </span>
                              {response.improvement_area}
                            </div>
                          )}
                          {response.ideas_suggestions && (
                            <div className="text-xs flex items-start gap-1">
                              <Lightbulb className="h-3 w-3 text-purple-500 mt-0.5 shrink-0" />
                              <span>{response.ideas_suggestions}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </>
      )}
    </section>
  );
}
