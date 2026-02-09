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
import { useNPSResponses, calculateNPSStats, NPSSurvey, NPSResponse } from '@/hooks/useNPSSurveys';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';

interface NPSResponsesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: NPSSurvey;
}

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

function ResponseCard({ response }: { response: NPSResponse }) {
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
        {/* Header */}
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

        {/* Score Reason */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Motivo da nota:</p>
          <p className="text-sm">{response.score_reason}</p>
        </div>

        {/* Ratings Grid */}
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

        {/* Improvement Suggestions */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Sugestões de melhoria:</p>
          <p className="text-sm">{response.improvement_suggestions}</p>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground text-right">
          Enviado em {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </CardContent>
    </Card>
  );
}

export default function NPSResponsesModal({ open, onOpenChange, survey }: NPSResponsesModalProps) {
  const { data: responses, isLoading } = useNPSResponses(survey.id);
  const stats = calculateNPSStats(responses || []);

  const getNPSColor = (score: number) => {
    if (score >= 50) return 'text-green-600';
    if (score >= 0) return 'text-yellow-600';
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

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-3 py-2">
          <div className="text-center bg-muted/50 rounded-lg p-3">
            <p className="text-2xl font-bold">{stats.totalResponses}</p>
            <p className="text-xs text-muted-foreground">Respostas</p>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-center gap-1">
              {stats.npsScore >= 0 ? (
                <TrendingUp className={`h-4 w-4 ${getNPSColor(stats.npsScore)}`} />
              ) : (
                <TrendingDown className={`h-4 w-4 ${getNPSColor(stats.npsScore)}`} />
              )}
              <span className={`text-2xl font-bold ${getNPSColor(stats.npsScore)}`}>
                {stats.npsScore}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">NPS Score</p>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-3">
            <p className="text-2xl font-bold">{stats.averageScore}</p>
            <p className="text-xs text-muted-foreground">Média</p>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="text-green-600 font-medium">{stats.promoters}P</span>
              <span className="text-yellow-600 font-medium">{stats.passives}N</span>
              <span className="text-red-600 font-medium">{stats.detractors}D</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Distribuição</p>
          </div>
        </div>

        {/* Responses List */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : responses && responses.length > 0 ? (
            <div className="space-y-3">
              {responses.map(response => (
                <ResponseCard key={response.id} response={response} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma resposta ainda</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
