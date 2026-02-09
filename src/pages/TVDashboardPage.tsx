import { useState, useEffect } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useDashGestores, useWeeklyProblemsStats } from '@/hooks/useDashGestores';
import { useOKRs } from '@/hooks/useOKRs';
import { useTVDashboardStats } from '@/hooks/useTVDashboard';
import { 
  Loader2, Target, AlertTriangle, CheckCircle2, XCircle, 
  Clock, Palette, Video, ShoppingCart, Code,
  TrendingUp, Zap, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GlowCard, GlowCardHeader, GlowCardContent } from '@/components/tv-dashboard/GlowCard';
import { MetricsMarquee } from '@/components/tv-dashboard/MetricsMarquee';
import { motion } from 'framer-motion';

export default function TVDashboardPage() {
  const { data: gestores, isLoading: gestoresLoading } = useDashGestores();
  const { okrs: annualOKRs, isLoading: annualLoading } = useOKRs('annual');
  const { okrs: weeklyOKRs, isLoading: weeklyLoading } = useOKRs('weekly');
  const { data: problemsStats } = useWeeklyProblemsStats();
  const { data: professionalStats } = useTVDashboardStats();
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = gestoresLoading && annualLoading && weeklyLoading;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen bg-[#1a1614]">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFD400]" />
        </div>
      </MainLayout>
    );
  }

  const allProfessionals = professionalStats?.all || [];

  return (
    <MainLayout>
      <div className="h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] bg-gradient-to-br from-[#1a1614] via-[#2a2320] to-[#1a1614] p-2 overflow-hidden flex flex-col">
        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-64 h-64 bg-[#FFD400]/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-64 h-64 bg-[#FFD400]/5 rounded-full blur-3xl" />
        </div>

        {/* Header - Ultra Compact */}
        <div className="relative flex items-center justify-between mb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFD400] to-[#FFA000] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#1a1614]" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#F5F5DC] tracking-tight">
                MILLENNIALS <span className="text-[#FFD400]">LIVE</span>
              </h1>
              <p className="text-[#F5F5DC]/60 text-[10px]">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} • {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AO VIVO
          </div>
        </div>

        {/* Metrics Marquee - Compact */}
        <div className="relative mb-1.5 shrink-0">
          <MetricsMarquee
            professionals={allProfessionals}
            title="Equipe"
            icon={<Users className="w-3 h-3 text-[#FFD400]" />}
            accentColor="bg-[#FFD400]/20 text-[#FFD400]"
          />
        </div>

        {/* Main Content Grid */}
        <div className="relative grid grid-cols-12 gap-2 flex-1 min-h-0">
          {/* Left Column - Gestores */}
          <div className="col-span-5 min-h-0">
            <GlowCard className="h-full flex flex-col">
              <GlowCardHeader 
                icon={<Target className="w-3 h-3" />} 
                title="Gestores"
                badge={
                  <Badge className="bg-[#FFD400]/20 text-[#FFD400] border-[#FFD400]/30 text-[8px] px-1 py-0 h-4">
                    {gestores?.length || 0}
                  </Badge>
                }
              />
              <GlowCardContent className="flex-1 overflow-auto scrollbar-apple p-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  {gestores?.map((gestor) => (
                    <div 
                      key={gestor.id}
                      className="bg-[#1a1614]/60 rounded-md p-1.5 border border-[#FFD400]/5"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FFD400]/30 to-[#FFD400]/10 flex items-center justify-center text-[9px] font-bold text-[#FFD400] overflow-hidden border border-[#FFD400]/20 shrink-0">
                          {gestor.avatar ? (
                            <img src={gestor.avatar} alt={gestor.name} className="w-full h-full object-cover" />
                          ) : (
                            gestor.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#F5F5DC] font-semibold text-[10px] truncate">{gestor.name}</p>
                          <p className="text-[7px] text-[#F5F5DC]/50">
                            {gestor.clientCounts.otimo + gestor.clientCounts.bom + gestor.clientCounts.medio + gestor.clientCounts.ruim} clientes
                          </p>
                        </div>
                        {gestor.documentedYesterday ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-0.5 text-center">
                        <div className="py-0.5 rounded bg-emerald-500/20">
                          <span className="text-[10px] font-bold text-emerald-400">{gestor.clientCounts.otimo}</span>
                        </div>
                        <div className="py-0.5 rounded bg-blue-500/20">
                          <span className="text-[10px] font-bold text-blue-400">{gestor.clientCounts.bom}</span>
                        </div>
                        <div className="py-0.5 rounded bg-amber-500/20">
                          <span className="text-[10px] font-bold text-amber-400">{gestor.clientCounts.medio}</span>
                        </div>
                        <div className="py-0.5 rounded bg-red-500/20">
                          <span className="text-[10px] font-bold text-red-400">{gestor.clientCounts.ruim}</span>
                        </div>
                      </div>
                      {gestor.churnCount > 0 && (
                        <div className="mt-1 flex items-center gap-0.5 text-red-400 bg-red-500/10 rounded px-1 py-0.5">
                          <AlertTriangle className="w-2 h-2" />
                          <span className="text-[7px] font-medium">{gestor.churnCount} churn</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </GlowCardContent>
            </GlowCard>
          </div>

          {/* Middle Column - OKRs */}
          <div className="col-span-4 flex flex-col gap-2 min-h-0">
            {/* OKRs Anuais */}
            <GlowCard className="flex-1 flex flex-col min-h-0">
              <GlowCardHeader 
                icon={<TrendingUp className="w-3 h-3" />} 
                title="OKRs Ano"
              />
              <GlowCardContent className="flex-1 overflow-auto scrollbar-apple p-1.5">
                <div className="space-y-1.5">
                  {annualOKRs.slice(0, 4).map((okr) => {
                    const progress = okr.current_value ?? 0;
                    return (
                      <div key={okr.id} className="space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-[#F5F5DC] truncate flex-1 font-medium">{okr.title}</span>
                          <span className={cn(
                            "text-xs font-bold ml-1",
                            progress >= 75 ? "text-emerald-400" : progress >= 50 ? "text-amber-400" : "text-[#FFD400]"
                          )}>
                            {progress}%
                          </span>
                        </div>
                        <div className="relative h-1.5 bg-[#1a1614] rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={cn(
                              "h-full rounded-full",
                              progress >= 75 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : 
                              progress >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" : 
                              "bg-gradient-to-r from-[#FFD400] to-[#FFA000]"
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {annualOKRs.length === 0 && (
                    <p className="text-[#F5F5DC]/50 text-[10px] text-center py-1">Nenhum OKR anual</p>
                  )}
                </div>
              </GlowCardContent>
            </GlowCard>

            {/* OKRs Semanais */}
            <GlowCard className="flex-1 flex flex-col min-h-0">
              <GlowCardHeader 
                icon={<Clock className="w-3 h-3" />} 
                title="OKRs Semana"
                color="text-cyan-400"
              />
              <GlowCardContent className="flex-1 overflow-auto scrollbar-apple p-1.5">
                <div className="space-y-1.5">
                  {weeklyOKRs.slice(0, 3).map((okr) => {
                    const progress = okr.current_value ?? 0;
                    return (
                      <div key={okr.id} className="space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-[#F5F5DC] truncate flex-1 font-medium">{okr.title}</span>
                          <span className="text-xs font-bold text-cyan-400 ml-1">{progress}%</span>
                        </div>
                        <div className="relative h-1.5 bg-[#1a1614] rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {weeklyOKRs.length === 0 && (
                    <p className="text-[#F5F5DC]/50 text-[10px] text-center py-1">Nenhum OKR semanal</p>
                  )}
                </div>
              </GlowCardContent>
            </GlowCard>
          </div>

          {/* Right Column - Problems */}
          <div className="col-span-3 min-h-0">
            <GlowCard className="h-full flex flex-col">
              <GlowCardHeader 
                icon={<AlertTriangle className="w-3 h-3" />} 
                title="Problemas"
                color="text-amber-400"
                badge={problemsStats && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[8px] px-1 py-0 h-4">
                    {problemsStats.total}
                  </Badge>
                )}
              />
              <GlowCardContent className="flex-1 overflow-auto scrollbar-apple p-1.5">
                {problemsStats && problemsStats.total > 0 ? (
                  <div className="space-y-2">
                    {/* Top Challenges */}
                    <div>
                      <h4 className="text-[7px] font-bold text-[#F5F5DC]/50 uppercase tracking-wider mb-1">
                        Mais Recorrentes
                      </h4>
                      <div className="space-y-1">
                        {problemsStats.topChallenges.slice(0, 3).map((challenge, index) => (
                          <div 
                            key={challenge.text}
                            className="flex items-center gap-1 p-1 rounded bg-[#1a1614]/60 border border-amber-500/10"
                          >
                            <span className="w-3 h-3 rounded-full bg-amber-500/20 text-amber-400 text-[8px] font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <span className="flex-1 text-[8px] text-[#F5F5DC] truncate">{challenge.text}</span>
                            <Badge variant="outline" className="text-[7px] border-amber-500/30 text-amber-400 shrink-0 px-0.5 py-0 h-3">
                              {challenge.count}x
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delays by Area */}
                    <div>
                      <h4 className="text-[7px] font-bold text-[#F5F5DC]/50 uppercase tracking-wider mb-1">
                        Atrasos
                      </h4>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { key: 'delay_video', label: 'Vídeo', icon: Video, color: 'bg-purple-500/20 text-purple-400' },
                          { key: 'delay_design', label: 'Design', icon: Palette, color: 'bg-pink-500/20 text-pink-400' },
                          { key: 'delay_site', label: 'Site', icon: Code, color: 'bg-blue-500/20 text-blue-400' },
                          { key: 'delay_crm', label: 'CRM', icon: ShoppingCart, color: 'bg-orange-500/20 text-orange-400' },
                        ].map(area => (
                          <div 
                            key={area.key}
                            className={cn("p-1 rounded text-center", area.color)}
                          >
                            <area.icon className="w-2.5 h-2.5 mx-auto mb-0.5 opacity-80" />
                            <span className="text-sm font-bold block">
                              {problemsStats.byType[area.key] || 0}
                            </span>
                            <p className="text-[6px] font-medium opacity-80">{area.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 text-[#F5F5DC]/50">
                    <CheckCircle2 className="w-6 h-6 mb-0.5 text-emerald-400" />
                    <p className="text-[10px] font-medium">Sem problemas</p>
                  </div>
                )}
              </GlowCardContent>
            </GlowCard>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
