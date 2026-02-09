import React from 'react';
import { 
  Briefcase, 
  Users,
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRHVagas, useRHVagaBriefings, useRHJustificativas, RH_STATUSES, isVagaOverdue } from '@/hooks/useRH';

interface StatItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  iconBg: string;
}

function StatItem({ icon: Icon, label, value, color, iconBg }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
      <div className={`p-2 rounded-lg ${iconBg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

interface StageItemProps {
  label: string;
  count: number;
  color: string;
  hasDelay?: boolean;
}

function StageItem({ label, count, color, hasDelay }: StageItemProps) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div 
        className="w-2 h-2 rounded-full flex-shrink-0" 
        style={{ backgroundColor: color }}
      />
      <span className="text-sm flex-1 truncate">{label}</span>
      <div className="flex items-center gap-1">
        {hasDelay && (
          <AlertTriangle className="w-3 h-3 text-danger" />
        )}
        <Badge variant="secondary" className="text-xs min-w-[24px] justify-center">
          {count}
        </Badge>
      </div>
    </div>
  );
}

export default function RHDashboard() {
  const { data: vagas = [] } = useRHVagas();
  const { data: briefings = [] } = useRHVagaBriefings();
  const { data: justificativas = [] } = useRHJustificativas();

  // Calculate stats
  const vagasAbertas = vagas.filter(v => !['arquivados'].includes(v.status)).length;
  const vagasEmProcesso = vagas.filter(v => v.status === 'processo_seletivo').length;
  const vagasRegistradas = vagas.filter(v => v.status === 'vaga_registrada').length;
  const vagasSolicitadas = vagas.filter(v => v.status === 'solicitacao_vaga').length;
  const vagasFechadas = vagas.filter(v => v.status === 'arquivados').length;
  
  // Vagas atrasadas
  const vagasAtrasadas = vagas.filter(v => {
    const briefing = briefings.find(b => b.vaga_id === v.id);
    return isVagaOverdue(v, briefing);
  }).length;

  // Count by stage (simplified statuses)
  const countByStage = RH_STATUSES
    .filter(s => s.id !== 'justificativa')
    .map(status => {
      const count = vagas.filter(v => v.status === status.id).length;
      const hasDelay = vagas.some(v => {
        if (v.status !== status.id) return false;
        const briefing = briefings.find(b => b.vaga_id === v.id);
        return isVagaOverdue(v, briefing);
      });
      return { ...status, count, hasDelay };
    });

  // Calculate performance metrics
  const totalVagas = vagasAbertas + vagasFechadas;
  const taxaConversao = totalVagas > 0 ? Math.round((vagasFechadas / totalVagas) * 100) : 0;
  const taxaNoPrazo = vagasAbertas > 0 ? Math.round(((vagasAbertas - vagasAtrasadas) / vagasAbertas) * 100) : 100;

  return (
    <div className="p-4 space-y-4 bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Dashboard RH</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Visão geral do recrutamento
        </p>
      </div>

      {/* Quick Stats - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatItem
          icon={Briefcase}
          label="Vagas Abertas"
          value={vagasAbertas}
          color="text-primary"
          iconBg="bg-primary/10"
        />
        <StatItem
          icon={Users}
          label="Em Processo"
          value={vagasEmProcesso}
          color="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <StatItem
          icon={CheckCircle}
          label="Contratadas"
          value={vagasFechadas}
          color="text-blue-500"
          iconBg="bg-blue-500/10"
        />
        <StatItem
          icon={AlertTriangle}
          label="Atrasadas"
          value={vagasAtrasadas}
          color="text-danger"
          iconBg="bg-danger/10"
        />
      </div>

      {/* Performance Card */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">Taxa de Conversão</span>
              <span className="text-xs font-semibold">{taxaConversao}%</span>
            </div>
            <Progress value={taxaConversao} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">No Prazo</span>
              <span className="text-xs font-semibold text-emerald-600">{taxaNoPrazo}%</span>
            </div>
            <Progress value={taxaNoPrazo} className="h-2 [&>div]:bg-emerald-500" />
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Funil */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Resumo do Funil
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">Solicitações</span>
              <span className="text-xs font-semibold">{vagasSolicitadas}</span>
            </div>
            <Progress value={vagasAbertas > 0 ? (vagasSolicitadas / vagasAbertas) * 100 : 0} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">Registradas</span>
              <span className="text-xs font-semibold">{vagasRegistradas}</span>
            </div>
            <Progress value={vagasAbertas > 0 ? (vagasRegistradas / vagasAbertas) * 100 : 0} className="h-2 [&>div]:bg-purple-500" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">Em Processo Seletivo</span>
              <span className="text-xs font-semibold">{vagasEmProcesso}</span>
            </div>
            <Progress value={vagasAbertas > 0 ? (vagasEmProcesso / vagasAbertas) * 100 : 0} className="h-2 [&>div]:bg-emerald-500" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">Arquivadas/Contratadas</span>
              <span className="text-xs font-semibold">{vagasFechadas}</span>
            </div>
            <Progress value={totalVagas > 0 ? (vagasFechadas / totalVagas) * 100 : 0} className="h-2 [&>div]:bg-blue-500" />
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Status */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Status do Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-1">
            {countByStage.map(stage => (
              <StageItem
                key={stage.id}
                label={stage.label}
                count={stage.count}
                color={stage.color}
                hasDelay={stage.hasDelay}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Justificativas Alert */}
      {vagasAtrasadas > 0 && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">Atenção!</p>
              <p className="text-xs text-danger/80">
                {vagasAtrasadas} vaga{vagasAtrasadas > 1 ? 's' : ''} precisa{vagasAtrasadas > 1 ? 'm' : ''} de justificativa
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
