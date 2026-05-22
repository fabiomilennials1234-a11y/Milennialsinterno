import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNPSClientGrowthResponses,
  calculateClientGrowthStats,
  NPSSurvey,
  NPSClientGrowthResponse,
} from '@/hooks/useNPSSurveys';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  Building2,
  Target,
  MessageSquare,
  Users,
} from 'lucide-react';

interface ClientGrowthResponsesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: NPSSurvey;
}

const EVOLUTION_LABELS: Record<string, string> = {
  muito_abaixo: 'Muito abaixo do esperado',
  abaixo: 'Abaixo do esperado',
  dentro: 'Dentro do esperado',
  acima: 'Acima do esperado',
  muito_acima: 'Muito acima do esperado',
};

const EVOLUTION_COLORS: Record<string, string> = {
  muito_abaixo: 'text-red-600',
  abaixo: 'text-orange-600',
  dentro: 'text-yellow-600',
  acima: 'text-green-600',
  muito_acima: 'text-emerald-600',
};

const ALIGNMENT_LABELS: Record<string, string> = {
  totalmente: 'Totalmente alinhada',
  parcialmente: 'Parcialmente alinhada',
  pouco: 'Pouco alinhada',
  nao: 'Não alinhada',
};

const ALIGNMENT_COLORS: Record<string, string> = {
  totalmente: 'text-green-600',
  parcialmente: 'text-yellow-600',
  pouco: 'text-orange-600',
  nao: 'text-red-600',
};

function getNPSColor(score: number) {
  if (score >= 9) return 'text-green-600';
  if (score >= 7) return 'text-yellow-600';
  return 'text-red-600';
}

function ResponseCard({ response }: { response: NPSClientGrowthResponse }) {
  return (
    <Card className="border-subtle">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{response.company_name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">Evolução</p>
            <p className={`font-medium ${EVOLUTION_COLORS[response.results_evolution]}`}>
              {EVOLUTION_LABELS[response.results_evolution]}
            </p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">Alinhamento</p>
            <p className={`font-medium ${ALIGNMENT_COLORS[response.alignment_assessment]}`}>
              {ALIGNMENT_LABELS[response.alignment_assessment]}
            </p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">NPS</p>
            <p className={`font-bold text-lg ${getNPSColor(response.nps_score)}`}>
              {response.nps_score}
            </p>
          </div>
        </div>

        {response.biggest_challenges.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Desafios:</p>
            <div className="flex flex-wrap gap-1">
              {response.biggest_challenges.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
              ))}
              {response.challenges_other && (
                <Badge variant="outline" className="text-xs">{response.challenges_other}</Badge>
              )}
            </div>
          </div>
        )}

        {response.strengthen_areas.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Manter/Fortalecer:</p>
            <div className="flex flex-wrap gap-1">
              {response.strengthen_areas.map((a) => (
                <Badge key={a} variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700">{a}</Badge>
              ))}
              {response.strengthen_other && (
                <Badge variant="outline" className="text-xs">{response.strengthen_other}</Badge>
              )}
            </div>
          </div>
        )}

        {response.improvement_suggestions && (
          <div className="flex gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{response.improvement_suggestions}</p>
          </div>
        )}

        {response.next_months_goal && (
          <div className="flex gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs"><span className="text-muted-foreground">Objetivo:</span> {response.next_months_goal}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClientGrowthResponsesModal({ open, onOpenChange, survey }: ClientGrowthResponsesModalProps) {
  const { data: responses, isLoading } = useNPSClientGrowthResponses(survey.id);
  const stats = calculateClientGrowthStats(responses || []);

  const getEvolutionColor = (avg: number) => {
    if (avg >= 4) return 'text-green-600';
    if (avg >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <DialogTitle>{survey.title}</DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xl font-bold">{stats.totalResponses}</span>
                </div>
                <p className="text-xs text-muted-foreground">Respostas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <span className={`text-xl font-bold ${getNPSColor(stats.averageNPS)}`}>
                  {stats.averageNPS || '-'}
                </span>
                <p className="text-xs text-muted-foreground">NPS Médio</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <span className={`text-xl font-bold ${getEvolutionColor(stats.averageEvolution)}`}>
                  {stats.averageEvolution || '-'}
                </span>
                <p className="text-xs text-muted-foreground">Evolução Média</p>
              </div>
            </div>

            {/* Responses List */}
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3 pr-4">
                {responses && responses.length > 0 ? (
                  responses.map((r) => <ResponseCard key={r.id} response={r} />)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhuma resposta ainda</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
