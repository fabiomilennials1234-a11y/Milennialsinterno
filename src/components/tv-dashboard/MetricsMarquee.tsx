import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { ProfessionalStats } from "@/hooks/useTVDashboard"

interface MetricsMarqueeProps {
  professionals: ProfessionalStats[]
  title: string
  icon: React.ReactNode
  accentColor: string
  className?: string
}

const ROLE_LABELS: Record<string, string> = {
  designer: 'Designer',
  editor_video: 'Editor',
  consultor_comercial: 'Comercial',
  desenvolvedor: 'Dev',
  gestor_ads: 'Gestor de Tráfego',
  gestor_projetos: 'Gestor de Projetos',
  sucesso_cliente: 'Sucesso do Cliente',
  financeiro: 'Financeiro',
  rh: 'RH',
  produtora: 'Produtora',
  atriz: 'Atriz',
  ceo: 'CEO',
}

export function MetricsMarquee({ 
  professionals, 
  title, 
  icon, 
  accentColor,
  className 
}: MetricsMarqueeProps) {
  if (!professionals || professionals.length === 0) {
    return (
      <div className={cn("relative overflow-hidden bg-[#2a2320]/40 rounded-xl p-3", className)}>
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", accentColor)}>
            {icon}
          </div>
          <h3 className="text-xs font-bold text-[#F5F5DC]/80 uppercase tracking-wide">
            {title}
          </h3>
          <span className="text-[10px] text-[#F5F5DC]/50 ml-2">Nenhum profissional encontrado</span>
        </div>
      </div>
    )
  }

  // Duplicate items for seamless loop
  const items = [...professionals, ...professionals, ...professionals, ...professionals]

  return (
    <div className={cn("relative overflow-hidden bg-[#2a2320]/40 rounded-xl", className)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#FFD400]/10">
        <div className={cn("p-1 rounded-lg", accentColor)}>
          {icon}
        </div>
        <h3 className="text-xs font-bold text-[#F5F5DC]/80 uppercase tracking-wide">
          {title}
        </h3>
        <Badge className={cn("ml-auto text-[9px] h-4", accentColor)}>
          {professionals.length} profissionais
        </Badge>
      </div>
      
      <div className="relative overflow-hidden py-2 px-2">
        <div className="flex gap-3 animate-marquee-slow">
          {items.map((professional, index) => (
            <MetricCard 
              key={`${professional.id}-${index}`}
              professional={professional}
              accentColor={accentColor}
            />
          ))}
        </div>
      </div>
      
      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#2a2320] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#2a2320] to-transparent z-10" />
    </div>
  )
}

interface MetricCardProps {
  professional: ProfessionalStats
  accentColor: string
}

function MetricCard({ professional, accentColor }: MetricCardProps) {
  const roleLabel = ROLE_LABELS[professional.role] || professional.role
  const hasClientCounts = professional.role === 'gestor_ads' && professional.clientCounts

  return (
    <div className={cn(
      "relative flex items-center gap-2 rounded-xl p-2 shrink-0",
      hasClientCounts ? "min-w-[280px]" : "min-w-[180px]",
      "bg-[#1a1614]/60 border border-[#FFD400]/10",
      "hover:border-[#FFD400]/30 transition-all duration-300"
    )}>
      <Avatar className="h-8 w-8 border border-[#FFD400]/20 shrink-0">
        <AvatarImage src={professional.avatar || undefined} alt={professional.name} />
        <AvatarFallback className={cn("text-[10px] font-bold", accentColor)}>
          {professional.name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="text-[#F5F5DC] font-semibold text-[11px] truncate">
          {professional.name}
        </p>
        <p className="text-[8px] text-[#F5F5DC]/50 uppercase tracking-wide">
          {roleLabel}
        </p>
      </div>
      
      {/* Client counts for gestor_ads */}
      {hasClientCounts && professional.clientCounts && (
        <div className="flex items-center gap-1 shrink-0 mr-1">
          <div className="flex flex-col items-center px-1 py-0.5 rounded bg-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-400">{professional.clientCounts.otimo}</span>
            <span className="text-[5px] text-emerald-400/70 uppercase">Ótimo</span>
          </div>
          <div className="flex flex-col items-center px-1 py-0.5 rounded bg-blue-500/20">
            <span className="text-[10px] font-bold text-blue-400">{professional.clientCounts.bom}</span>
            <span className="text-[5px] text-blue-400/70 uppercase">Bom</span>
          </div>
          <div className="flex flex-col items-center px-1 py-0.5 rounded bg-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400">{professional.clientCounts.medio}</span>
            <span className="text-[5px] text-amber-400/70 uppercase">Médio</span>
          </div>
          <div className="flex flex-col items-center px-1 py-0.5 rounded bg-red-500/20">
            <span className="text-[10px] font-bold text-red-400">{professional.clientCounts.ruim}</span>
            <span className="text-[5px] text-red-400/70 uppercase">Ruim</span>
          </div>
          <div className="flex flex-col items-center px-1 py-0.5 rounded bg-purple-500/20">
            <span className="text-[10px] font-bold text-purple-400">{professional.clientCounts.onboarding}</span>
            <span className="text-[5px] text-purple-400/70 uppercase">Onb</span>
          </div>
        </div>
      )}
      
      {/* Task counts */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-amber-500/10">
          <span className="text-sm font-bold text-amber-400">{professional.pendingTasks}</span>
          <span className="text-[6px] text-amber-400/70 uppercase">Pend</span>
        </div>
        <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-emerald-500/10">
          <span className="text-sm font-bold text-emerald-400">{professional.completedToday}</span>
          <span className="text-[6px] text-emerald-400/70 uppercase">Hoje</span>
        </div>
        {professional.delayedTasks > 0 && (
          <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-red-500/10">
            <span className="text-sm font-bold text-red-400">{professional.delayedTasks}</span>
            <span className="text-[6px] text-red-400/70 uppercase">Atr</span>
          </div>
        )}
      </div>
    </div>
  )
}
