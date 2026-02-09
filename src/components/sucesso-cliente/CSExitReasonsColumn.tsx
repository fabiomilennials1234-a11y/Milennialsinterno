import { useState } from 'react';
import { useSubmittedExitReasons, CSExitReason } from '@/hooks/useCSExitReasons';
import CSColumnScroll from './CSColumnScroll';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  DoorOpen, 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const REASON_LABELS: Record<string, string> = {
  preco: 'Preço muito alto',
  resultados: 'Resultados abaixo do esperado',
  atendimento: 'Atendimento insatisfatório',
  comunicacao: 'Problemas de comunicação',
  mudanca_estrategia: 'Mudança de estratégia',
  orcamento: 'Corte de orçamento',
  concorrente: 'Migração para concorrente',
  outro: 'Outro motivo',
};

function getSatisfactionColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score <= 2) return 'text-destructive';
  if (score === 3) return 'text-warning';
  return 'text-success';
}

function getSatisfactionBg(score: number | null): string {
  if (!score) return 'bg-muted';
  if (score <= 2) return 'bg-destructive/10';
  if (score === 3) return 'bg-warning/10';
  return 'bg-success/10';
}

export default function CSExitReasonsColumn() {
  const { data: exitReasons = [], isLoading } = useSubmittedExitReasons();
  const [selectedReason, setSelectedReason] = useState<CSExitReason | null>(null);

  // Calculate stats
  const totalResponses = exitReasons.length;
  const avgSatisfaction = exitReasons.length > 0
    ? exitReasons.reduce((sum, r) => sum + (r.satisfaction_score || 0), 0) / exitReasons.length
    : 0;
  const wouldRecommendCount = exitReasons.filter(r => r.would_recommend).length;

  // Group by main reason for insights
  const reasonCounts = exitReasons.reduce((acc, r) => {
    const reason = r.main_reason || 'outro';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const renderExitReasonCard = (reason: CSExitReason) => (
    <Card 
      key={reason.id} 
      className="bg-card border-subtle hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => setSelectedReason(reason)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{reason.client_name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {REASON_LABELS[reason.main_reason || 'outro'] || reason.main_reason}
            </p>
          </div>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            getSatisfactionBg(reason.satisfaction_score),
            getSatisfactionColor(reason.satisfaction_score)
          )}>
            {reason.satisfaction_score || '-'}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {reason.would_recommend ? (
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                <ThumbsUp className="h-3 w-3 mr-1" />
                Recomendaria
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                <ThumbsDown className="h-3 w-3 mr-1" />
                Não recomendaria
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {reason.submitted_at && formatDistanceToNow(new Date(reason.submitted_at), { locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className="section-header section-header-danger">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <DoorOpen size={18} className="text-white" />
            <h2 className="font-semibold text-white">Motivos de Saída</h2>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {totalResponses}
          </Badge>
        </div>
      </div>

      {/* Stats Summary */}
      {totalResponses > 0 && (
        <div className="px-4 py-3 border-b border-subtle bg-muted/30">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{avgSatisfaction.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Satisfação média</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{Math.round((wouldRecommendCount / totalResponses) * 100)}%</p>
              <p className="text-xs text-muted-foreground">Recomendariam</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{totalResponses}</p>
              <p className="text-xs text-muted-foreground">Respostas</p>
            </div>
          </div>

          {/* Top Reasons */}
          {topReasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-subtle">
              <p className="text-xs font-medium text-muted-foreground mb-2">Principais motivos:</p>
              <div className="space-y-1">
                {topReasons.map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate">{REASON_LABELS[reason] || reason}</span>
                    <span className="text-muted-foreground font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <CSColumnScroll contentClassName="p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Carregando...</p>
            </div>
          ) : exitReasons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DoorOpen className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">Nenhuma resposta ainda</p>
              <p className="text-xs mt-1">As respostas dos formulários de saída aparecerão aqui</p>
            </div>
          ) : (
            exitReasons.map(renderExitReasonCard)
          )}
      </CSColumnScroll>

      {/* Detail Dialog */}
      <Dialog open={!!selectedReason} onOpenChange={() => setSelectedReason(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-destructive" />
              Feedback de Saída - {selectedReason?.client_name}
            </DialogTitle>
          </DialogHeader>

          {selectedReason && (
            <div className="space-y-4">
              {/* Satisfaction Score */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold",
                  getSatisfactionBg(selectedReason.satisfaction_score),
                  getSatisfactionColor(selectedReason.satisfaction_score)
                )}>
                  {selectedReason.satisfaction_score || '-'}
                </div>
                <div>
                  <p className="font-medium">Satisfação</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedReason.satisfaction_score && selectedReason.satisfaction_score <= 2 && 'Insatisfeito'}
                    {selectedReason.satisfaction_score === 3 && 'Neutro'}
                    {selectedReason.satisfaction_score && selectedReason.satisfaction_score >= 4 && 'Satisfeito'}
                  </p>
                </div>
              </div>

              {/* Main Reason */}
              <div>
                <Label className="text-xs text-muted-foreground">Principal motivo</Label>
                <p className="font-medium">
                  {REASON_LABELS[selectedReason.main_reason || 'outro'] || selectedReason.main_reason}
                </p>
              </div>

              {/* Would Recommend */}
              <div className="flex items-center gap-2">
                {selectedReason.would_recommend ? (
                  <Badge className="bg-success/10 text-success border-success/20">
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Recomendaria
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    Não recomendaria
                  </Badge>
                )}
              </div>

              {/* What could improve */}
              {selectedReason.what_could_improve && (
                <div>
                  <Label className="text-xs text-muted-foreground">O que poderia melhorar</Label>
                  <p className="text-sm mt-1 p-3 bg-muted/30 rounded-lg">
                    {selectedReason.what_could_improve}
                  </p>
                </div>
              )}

              {/* Additional Feedback */}
              {selectedReason.additional_feedback && (
                <div>
                  <Label className="text-xs text-muted-foreground">Comentário adicional</Label>
                  <p className="text-sm mt-1 p-3 bg-muted/30 rounded-lg">
                    {selectedReason.additional_feedback}
                  </p>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground text-right">
                Respondido em {selectedReason.submitted_at && format(new Date(selectedReason.submitted_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm font-medium", className)}>{children}</p>;
}
