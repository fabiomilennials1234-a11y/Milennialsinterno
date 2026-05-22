import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  ExternalLink,
  Copy,
  Eye,
  TrendingUp,
  Users,
  Check,
} from 'lucide-react';
import {
  useNPSSurveys,
  useNPSClientGrowthResponses,
  calculateClientGrowthStats,
  NPSSurvey,
} from '@/hooks/useNPSSurveys';
import { toast } from 'sonner';
import ClientGrowthCreateModal from './ClientGrowthCreateModal';
import ClientGrowthResponsesModal from './ClientGrowthResponsesModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function GrowthSurveyCard({ survey }: { survey: NPSSurvey }) {
  const [showResponses, setShowResponses] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: responses = [] } = useNPSClientGrowthResponses(survey.id);
  const stats = calculateClientGrowthStats(responses);

  const publicUrl = `${window.location.origin}/nps/${survey.public_token}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getNPSColor = (score: number) => {
    if (score >= 9) return 'text-green-600';
    if (score >= 7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEvolutionColor = (avg: number) => {
    if (avg >= 4) return 'text-green-600';
    if (avg >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <>
      <Card className="border-subtle hover:shadow-apple-hover transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{survey.title}</h3>
                <Badge
                  variant={survey.is_active ? 'default' : 'secondary'}
                  className="shrink-0"
                >
                  {survey.is_active ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Criada em {format(new Date(survey.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-lg font-bold">{stats.totalResponses}</span>
              </div>
              <p className="text-xs text-muted-foreground">Respostas</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <span className={`text-lg font-bold ${stats.averageNPS ? getNPSColor(stats.averageNPS) : ''}`}>
                {stats.averageNPS || '-'}
              </span>
              <p className="text-xs text-muted-foreground">NPS</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <span className={`text-lg font-bold ${stats.averageEvolution ? getEvolutionColor(stats.averageEvolution) : ''}`}>
                {stats.averageEvolution || '-'}
              </span>
              <p className="text-xs text-muted-foreground">Evolução</p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={copyLink}>
              {copied ? (
                <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5" />
              )}
              Copiar Link
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(publicUrl, '_blank')}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setShowResponses(true)}
              disabled={stats.totalResponses === 0}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClientGrowthResponsesModal
        open={showResponses}
        onOpenChange={setShowResponses}
        survey={survey}
      />
    </>
  );
}

export default function CSClientGrowthNPSSection() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: surveys, isLoading } = useNPSSurveys('client_growth');

  return (
    <div className="flex-1 min-w-[320px] max-w-[400px]">
      <Card className="h-full bg-gradient-to-b from-emerald-500/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">Pesquisa NPS Clientes</CardTitle>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pesquisas mensais de evolução e experiência dos clientes
          </p>
        </CardHeader>

        <CardContent
          className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-4 scrollbar-apple"
          style={{ scrollbarGutter: 'stable' } as React.CSSProperties}
        >
          {isLoading ? (
            <>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          ) : surveys && surveys.length > 0 ? (
            surveys.map(survey => (
              <GrowthSurveyCard key={survey.id} survey={survey} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma pesquisa criada</p>
              <p className="text-xs mt-1">Clique em "Nova" para criar</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientGrowthCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
