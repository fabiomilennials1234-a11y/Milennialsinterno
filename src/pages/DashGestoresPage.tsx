import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useDashGestores, useWeeklyProblemsStats } from '@/hooks/useDashGestores';
import { useOKRs, OKR, useArchiveWeeklyOKRs } from '@/hooks/useOKRs';
import { useMeetingsOneOnOne } from '@/hooks/useMeetingsOneOnOne';
import { Loader2, Users, Target, AlertTriangle, CheckCircle2, XCircle, Plus, Archive, Calendar, Edit2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import OKRCreateModal from '@/components/dash-gestores/OKRCreateModal';
import OKRProgressModal from '@/components/dash-gestores/OKRProgressModal';
import MeetingOneOnOneModal from '@/components/dash-gestores/MeetingOneOnOneModal';
import WeeklySummarySection from '@/components/dash-gestores/WeeklySummarySection';

export default function DashGestoresPage() {
  const { data: gestores, isLoading: gestoresLoading } = useDashGestores();
  const { okrs: annualOKRs, isLoading: annualLoading } = useOKRs('annual');
  const { okrs: weeklyOKRs, isLoading: weeklyLoading } = useOKRs('weekly');
  const { archiveWeeklyProblems } = useMeetingsOneOnOne();
  const archiveWeeklyOKRs = useArchiveWeeklyOKRs();
  const { data: problemsStats } = useWeeklyProblemsStats();
  
  const [showOKRModal, setShowOKRModal] = useState(false);
  const [okrType, setOKRType] = useState<'annual' | 'weekly'>('annual');
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedOKR, setSelectedOKR] = useState<OKR | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // Only block on critical data, show sections progressively
  const isInitialLoading = gestoresLoading && annualLoading && weeklyLoading;

  const handleArchiveWeek = async () => {
    if (confirm('Tem certeza que deseja reiniciar a semana? Isso arquivará os problemas e OKRs semanais.')) {
      // Arquiva problemas da semana
      archiveWeeklyProblems.mutate();
      // Arquiva OKRs semanais
      archiveWeeklyOKRs.mutate();
    }
  };

  if (isInitialLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-8 animate-fade-in bg-gradient-to-br from-background via-background to-muted/20 min-h-screen">
        {/* Header TV */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-foreground">
              OKRs MILLENNIALS
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Visão em tempo real • {new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setShowMeetingModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar 1 a 1
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success font-medium">
              <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
              Ao vivo
            </div>
          </div>
        </div>

        {/* Painel de Gestores */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gestores?.map((gestor) => (
              <div
                key={gestor.id}
                className="card-apple p-6 space-y-4 hover:scale-[1.02] transition-transform"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
                    {gestor.avatar ? (
                      <img src={gestor.avatar} alt={gestor.name} className="w-full h-full object-cover" />
                    ) : (
                      gestor.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{gestor.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {gestor.clientCounts.otimo + gestor.clientCounts.bom + gestor.clientCounts.medio + gestor.clientCounts.ruim} clientes
                    </p>
                  </div>
                </div>

                {/* Contagem de clientes por status */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-success/10">
                    <span className="text-2xl font-bold text-success">{gestor.clientCounts.otimo}</span>
                    <p className="text-[10px] text-muted-foreground uppercase">Ótimo</p>
                  </div>
                  <div className="p-2 rounded-lg bg-info/10">
                    <span className="text-2xl font-bold text-info">{gestor.clientCounts.bom}</span>
                    <p className="text-[10px] text-muted-foreground uppercase">Bom</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warning/10">
                    <span className="text-2xl font-bold text-warning">{gestor.clientCounts.medio}</span>
                    <p className="text-[10px] text-muted-foreground uppercase">Médio</p>
                  </div>
                  <div className="p-2 rounded-lg bg-danger/10">
                    <span className="text-2xl font-bold text-danger">{gestor.clientCounts.ruim}</span>
                    <p className="text-[10px] text-muted-foreground uppercase">Ruim</p>
                  </div>
                </div>

                {/* Indicadores */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger" />
                    <span className="text-sm">Churn mês: <strong>{gestor.churnCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    {gestor.documentedYesterday ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-danger" />
                    )}
                    <span className="text-xs text-muted-foreground">Doc.</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OKRs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OKRs do Ano */}
          <section className="card-apple p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                OKRs do Ano
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setOKRType('annual'); setShowOKRModal(true); }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {annualOKRs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum OKR anual cadastrado
                </p>
              ) : (
                annualOKRs.map((okr) => {
                  const progress = okr.current_value ?? 0;
                  const isOverdue = okr.end_date && new Date(okr.end_date) < new Date();
                  
                  return (
                    <div 
                      key={okr.id} 
                      className="space-y-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => { setSelectedOKR(okr); setShowProgressModal(true); }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block">{okr.title}</span>
                          {okr.end_date && (
                            <div className={cn(
                              "flex items-center gap-1 text-xs mt-1",
                              isOverdue ? "text-danger" : "text-muted-foreground"
                            )}>
                              <Clock className="w-3 h-3" />
                              {new Date(okr.end_date).toLocaleDateString('pt-BR')}
                              {isOverdue && <Badge variant="destructive" className="text-[10px] h-4 ml-1">Atrasado</Badge>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">{progress}%</span>
                          <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* OKRs da Semana */}
          <section className="card-apple p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-info" />
                OKRs da Semana
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setOKRType('weekly'); setShowOKRModal(true); }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {weeklyOKRs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum OKR semanal cadastrado
                </p>
              ) : (
                weeklyOKRs.map((okr) => {
                  const progress = okr.current_value ?? 0;
                  const isOverdue = okr.end_date && new Date(okr.end_date) < new Date();
                  
                  return (
                    <div 
                      key={okr.id} 
                      className="space-y-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => { setSelectedOKR(okr); setShowProgressModal(true); }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block">{okr.title}</span>
                          {okr.end_date && (
                            <div className={cn(
                              "flex items-center gap-1 text-xs mt-1",
                              isOverdue ? "text-danger" : "text-muted-foreground"
                            )}>
                              <Clock className="w-3 h-3" />
                              {new Date(okr.end_date).toLocaleDateString('pt-BR')}
                              {isOverdue && <Badge variant="destructive" className="text-[10px] h-4 ml-1">Atrasado</Badge>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-info">{progress}%</span>
                          <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Problemas da Semana */}
        <section className="card-apple p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Problemas da Semana
              {problemsStats && (
                <Badge variant="secondary">{problemsStats.total}</Badge>
              )}
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleArchiveWeek}
              disabled={archiveWeeklyProblems.isPending || archiveWeeklyOKRs.isPending}
            >
              <Archive className="w-4 h-4 mr-2" />
              Reiniciar Semana
            </Button>
          </div>

          {problemsStats && problemsStats.total > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ranking de Problemas */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                  Desafios Mais Recorrentes
                </h3>
                <div className="space-y-2">
                  {problemsStats.topChallenges.map((challenge, index) => (
                    <div 
                      key={challenge.text} 
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm truncate">{challenge.text}</span>
                      <Badge variant="outline">{challenge.count}x</Badge>
                    </div>
                  ))}
                  {problemsStats.topChallenges.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum desafio registrado
                    </p>
                  )}
                </div>
              </div>

              {/* Atrasos por Área */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                  Atrasos por Área
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'delay_video', label: 'Vídeo', color: 'bg-purple-500/10 text-purple-500' },
                    { key: 'delay_design', label: 'Design', color: 'bg-pink-500/10 text-pink-500' },
                    { key: 'delay_site', label: 'Site', color: 'bg-blue-500/10 text-blue-500' },
                    { key: 'delay_crm', label: 'CRM', color: 'bg-orange-500/10 text-orange-500' },
                    { key: 'delay_automation', label: 'Automação', color: 'bg-cyan-500/10 text-cyan-500' },
                  ].map(area => (
                    <div 
                      key={area.key}
                      className={cn("p-3 rounded-lg text-center", area.color)}
                    >
                      <span className="text-2xl font-bold">
                        {problemsStats.byType[area.key] || 0}
                      </span>
                      <p className="text-xs font-medium">{area.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Resumo com IA */}
          <WeeklySummarySection problems={problemsStats?.problems || []} />
        </section>

        {/* Modais */}
        <OKRCreateModal 
          open={showOKRModal} 
          onOpenChange={setShowOKRModal} 
          type={okrType} 
        />
        <OKRProgressModal
          open={showProgressModal}
          onOpenChange={setShowProgressModal}
          okr={selectedOKR}
        />
        <MeetingOneOnOneModal 
          open={showMeetingModal} 
          onOpenChange={setShowMeetingModal} 
        />
      </div>
    </MainLayout>
  );
}
