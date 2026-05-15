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
  useNPSResponses,
  useNPSTeamResponses,
  calculateNPSStats,
  calculateTeamStats,
  NPSSurvey,
  NPSResponse,
  NPSTeamResponse,
} from '@/hooks/useNPSSurveys';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Star,
  Lightbulb,
} from 'lucide-react';

interface NPSResponsesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: NPSSurvey;
}

// ---------- Client NPS Response Card ----------

const STRATEGIES_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  sim: { label: 'Sim', icon: CheckCircle2, color: 'text-green-600' },
  parcialmente: { label: 'Parcialmente', icon: AlertCircle, color: 'text-yellow-600' },
  nao: { label: 'Não', icon: XCircle, color: 'text-red-600' },
};

const RATING_LABELS: Record<string, { label: string; color: string }> = {
  excelente: { label: 'Excelente', color: 'bg-green-100 text-green-700' },
  bom: { label: 'Bom', color: 'bg-blue-100 text-blue-700' },
  regular: { label: 'Regular', color: 'bg-yellow-100 text-yellow-700' },
  ruim: { label: 'Ruim', color: 'bg-red-100 text-red-700' },
  outro: { label: 'Outro', color: 'bg-gray-100 text-gray-700' },
};

const BRAND_LABELS: Record<string, { label: string; color: string }> = {
  sim_totalmente: { label: 'Sim, totalmente', color: 'bg-green-100 text-green-700' },
  parcialmente: { label: 'Parcialmente', color: 'bg-yellow-100 text-yellow-700' },
  nao: { label: 'Não', color: 'bg-red-100 text-red-700' },
};

const EFFICIENCY_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  sim: { label: 'Sim', icon: CheckCircle2, color: 'text-green-600' },
  parcialmente: { label: 'Parcialmente', icon: AlertCircle, color: 'text-yellow-600' },
  nao: { label: 'Não', icon: XCircle, color: 'text-red-600' },
};

const EXPERIENCE_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Boa',
  5: 'Excelente',
};

function ClientResponseCard({ response }: { response: NPSResponse }) {
  const getScoreColor = (score: number) => {
    if (score >= 9) return 'bg-green-500';
    if (score >= 7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return 'Promotor';
    if (score >= 7) return 'Neutro';
    return 'Detrator';
  };

  const strategies = STRATEGIES_LABELS[response.strategies_aligned];
  const StrategiesIcon = strategies.icon;

  return (
    <Card className="border-subtle">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{response.company_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${getScoreColor(response.nps_score)} text-white flex items-center justify-center font-bold text-sm`}>
              {response.nps_score}
            </div>
            <Badge variant="outline" className="text-xs">
              {getScoreLabel(response.nps_score)}
            </Badge>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Motivo da nota:</p>
          <p className="text-sm">{response.score_reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estratégias alinhadas:</p>
            <div className="flex items-center gap-1.5">
              <StrategiesIcon className={`h-4 w-4 ${strategies.color}`} />
              <span className={strategies.color}>{strategies.label}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Comunicação:</p>
            <Badge className={RATING_LABELS[response.communication_rating].color}>
              {RATING_LABELS[response.communication_rating].label}
            </Badge>
            {response.communication_other && (
              <p className="text-xs text-muted-foreground mt-1">"{response.communication_other}"</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Criativos:</p>
            <Badge className={RATING_LABELS[response.creatives_rating].color}>
              {RATING_LABELS[response.creatives_rating].label}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Representam a marca:</p>
            <Badge className={BRAND_LABELS[response.creatives_represent_brand].color}>
              {BRAND_LABELS[response.creatives_represent_brand].label}
            </Badge>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Sugestões de melhoria:</p>
          <p className="text-sm">{response.improvement_suggestions}</p>
        </div>

        <p className="text-xs text-muted-foreground text-right">
          Enviado em {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Team NPS Response Card ----------

function TeamResponseCard({ response }: { response: NPSTeamResponse }) {
  const getExperienceColor = (rating: number) => {
    if (rating >= 4) return 'bg-green-500';
    if (rating >= 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const efficiency = EFFICIENCY_LABELS[response.efficiency_assessment];
  const EfficiencyIcon = efficiency.icon;

  return (
    <Card className="border-subtle">
      <CardContent className="p-4 space-y-3">
        {/* Header: rating + efficiency */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${getExperienceColor(response.experience_rating)} text-white flex items-center justify-center font-bold text-sm`}>
              {response.experience_rating}
            </div>
            <div>
              <span className="text-sm font-medium">{EXPERIENCE_LABELS[response.experience_rating]}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: response.experience_rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <EfficiencyIcon className={`h-4 w-4 ${efficiency.color}`} />
            <span className={`text-xs font-medium ${efficiency.color}`}>{efficiency.label}</span>
          </div>
        </div>

        {/* Positive highlight */}
        {response.positive_highlight && (
          <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
            <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">Ponto positivo:</p>
            <p className="text-sm">{response.positive_highlight}</p>
          </div>
        )}

        {/* Improvement area */}
        {response.improvement_area && (
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-3">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 font-medium">O que melhorar:</p>
            <p className="text-sm">{response.improvement_area}</p>
          </div>
        )}

        {/* Ideas */}
        {response.ideas_suggestions && (
          <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb className="h-3.5 w-3.5 text-purple-500" />
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Ideia / Sugestão:</p>
            </div>
            <p className="text-sm">{response.ideas_suggestions}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">
          Enviado em {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Main Modal ----------

export default function NPSResponsesModal({ open, onOpenChange, survey }: NPSResponsesModalProps) {
  const isTeamSurvey = survey.survey_type === 'team';

  const { data: clientResponses, isLoading: clientLoading } = useNPSResponses(
    isTeamSurvey ? '' : survey.id
  );
  const { data: teamResponses, isLoading: teamLoading } = useNPSTeamResponses(
    isTeamSurvey ? survey.id : ''
  );

  const isLoading = isTeamSurvey ? teamLoading : clientLoading;

  const clientStats = calculateNPSStats(clientResponses || []);
  const teamStats = calculateTeamStats(teamResponses || []);

  const getNPSColor = (score: number) => {
    if (score >= 50) return 'text-green-600';
    if (score >= 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getExperienceColor = (avg: number) => {
    if (avg >= 4) return 'text-green-600';
    if (avg >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            Respostas: {survey.title}
          </DialogTitle>
        </DialogHeader>

        {isTeamSurvey ? (
          <>
            {/* Team Stats Summary */}
            <div className="grid grid-cols-3 gap-3 py-2">
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{teamStats.totalResponses}</p>
                <p className="text-xs text-muted-foreground">Respostas</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <p className={`text-2xl font-bold ${getExperienceColor(teamStats.averageExperience)}`}>
                  {teamStats.averageExperience}
                </p>
                <p className="text-xs text-muted-foreground">Média Exp.</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-green-600 font-medium">{teamStats.efficiencyBreakdown.sim}S</span>
                  <span className="text-yellow-600 font-medium">{teamStats.efficiencyBreakdown.parcialmente}P</span>
                  <span className="text-red-600 font-medium">{teamStats.efficiencyBreakdown.nao}N</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Eficiência</p>
              </div>
            </div>

            {/* Team Responses List */}
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : teamResponses && teamResponses.length > 0 ? (
                <div className="space-y-3">
                  {teamResponses.map(response => (
                    <TeamResponseCard key={response.id} response={response} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma resposta ainda</p>
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            {/* Client Stats Summary */}
            <div className="grid grid-cols-4 gap-3 py-2">
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{clientStats.totalResponses}</p>
                <p className="text-xs text-muted-foreground">Respostas</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-center gap-1">
                  {clientStats.npsScore >= 0 ? (
                    <TrendingUp className={`h-4 w-4 ${getNPSColor(clientStats.npsScore)}`} />
                  ) : (
                    <TrendingDown className={`h-4 w-4 ${getNPSColor(clientStats.npsScore)}`} />
                  )}
                  <span className={`text-2xl font-bold ${getNPSColor(clientStats.npsScore)}`}>
                    {clientStats.npsScore}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">NPS Score</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{clientStats.averageScore}</p>
                <p className="text-xs text-muted-foreground">Média</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-green-600 font-medium">{clientStats.promoters}P</span>
                  <span className="text-yellow-600 font-medium">{clientStats.passives}N</span>
                  <span className="text-red-600 font-medium">{clientStats.detractors}D</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Distribuição</p>
              </div>
            </div>

            {/* Client Responses List */}
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : clientResponses && clientResponses.length > 0 ? (
                <div className="space-y-3">
                  {clientResponses.map(response => (
                    <ClientResponseCard key={response.id} response={response} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma resposta ainda</p>
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
