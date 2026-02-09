 import { useProductMetrics } from '@/hooks/useProductMetrics';
 import { 
   TrendingUp, 
   TrendingDown, 
   Users, 
   UserPlus, 
   UserMinus, 
   DollarSign,
   BarChart3,
   Star,
   Loader2,
   Wallet,
   Target,
   Heart,
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface ProductMetricsSectionProps {
   productSlug: string;
   productName: string;
   productColor: string;
   showCosts?: boolean;
 }
 
 const formatCurrency = (value: number) => {
   return new Intl.NumberFormat('pt-BR', {
     style: 'currency',
     currency: 'BRL',
     minimumFractionDigits: 0,
     maximumFractionDigits: 0,
   }).format(value);
 };
 
 const formatPercent = (value: number) => {
   const sign = value >= 0 ? '+' : '';
   return `${sign}${value.toFixed(1)}%`;
 };
 
 export function ProductMetricsSection({ 
   productSlug, 
   productName, 
   productColor,
   showCosts = false 
 }: ProductMetricsSectionProps) {
   const { data: metrics, isLoading } = useProductMetrics(productSlug);
 
   if (isLoading) {
     return (
       <div className="card-apple p-6">
         <div className="flex items-center justify-center py-8">
           <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
         </div>
       </div>
     );
   }
 
   if (!metrics) return null;
 
   const isPositiveGrowth = metrics.crescimentoMRR >= 0;
 
   return (
     <div className="card-apple p-6 space-y-5">
       {/* Header */}
       <div className="flex items-center gap-3">
         <div 
           className="w-3 h-8 rounded-full"
           style={{ backgroundColor: productColor }}
         />
         <h3 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
           {productName}
         </h3>
       </div>
 
       {/* Main MRR and Growth */}
       <div className="grid grid-cols-2 gap-4">
         <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
           <div className="flex items-center gap-2 mb-2">
             <DollarSign size={16} className="text-primary" />
             <span className="text-xs text-muted-foreground font-medium">MRR Ativo</span>
           </div>
           <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.mrrAtivo)}</p>
         </div>
 
         <div className={cn(
           "p-4 rounded-xl border",
           isPositiveGrowth 
             ? "bg-success/10 border-success/20" 
             : "bg-destructive/10 border-destructive/20"
         )}>
           <div className="flex items-center gap-2 mb-2">
             {isPositiveGrowth ? (
               <TrendingUp size={16} className="text-success" />
             ) : (
               <TrendingDown size={16} className="text-destructive" />
             )}
             <span className="text-xs text-muted-foreground font-medium">Crescimento MRR</span>
           </div>
           <p className={cn(
             "text-2xl font-bold",
             isPositiveGrowth ? "text-success" : "text-destructive"
           )}>
             {formatCurrency(metrics.crescimentoMRR)}
           </p>
           <p className={cn(
             "text-xs mt-1",
             isPositiveGrowth ? "text-success" : "text-destructive"
           )}>
             {formatPercent(metrics.crescimentoMRRPercent)}
           </p>
         </div>
       </div>
 
       {/* Metrics Grid */}
       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
         {/* Clientes Ativos */}
         <div className="p-3 rounded-lg bg-muted/50 text-center">
           <Users size={18} className="mx-auto mb-1 text-info" />
           <p className="text-xl font-bold text-foreground">{metrics.clientesAtivos}</p>
           <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Clientes Ativos</p>
         </div>
 
         {/* Novos Clientes */}
         <div className="p-3 rounded-lg bg-muted/50 text-center">
           <UserPlus size={18} className="mx-auto mb-1 text-success" />
           <p className="text-xl font-bold text-foreground">{metrics.novosClientesMes}</p>
           <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Novos no Mês</p>
         </div>
 
         {/* Clientes que saíram */}
         <div className="p-3 rounded-lg bg-muted/50 text-center">
           <UserMinus size={18} className="mx-auto mb-1 text-destructive" />
           <p className="text-xl font-bold text-foreground">{metrics.clientesSairamMes}</p>
           <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saíram no Mês</p>
         </div>
 
         {/* Churn */}
         <div className="p-3 rounded-lg bg-muted/50 text-center">
           <TrendingDown size={18} className="mx-auto mb-1 text-warning" />
           <p className="text-xl font-bold text-foreground">{metrics.churnMes}</p>
           <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Churn do Mês</p>
         </div>
 
         {/* Ticket Médio */}
         <div className="p-3 rounded-lg bg-muted/50 text-center">
           <BarChart3 size={18} className="mx-auto mb-1 text-primary" />
           <p className="text-xl font-bold text-foreground">{formatCurrency(metrics.ticketMedio)}</p>
           <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ticket Médio</p>
         </div>
       </div>
 
       {/* Secondary Metrics */}
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
         {/* LTV Médio */}
         <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
           <div className="flex items-center gap-2 mb-1">
             <Target size={14} className="text-primary" />
            <span className="text-xs text-muted-foreground">Tempo Médio (LTV)</span>
           </div>
          <p className="text-lg font-bold text-foreground">{metrics.tempoMedioVidaMeses} <span className="text-xs font-normal text-muted-foreground">meses</span></p>
         </div>
 
         {/* NPS Geral */}
         <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
           <div className="flex items-center gap-2 mb-1">
             <Star size={14} className="text-warning" />
             <span className="text-xs text-muted-foreground">NPS Geral</span>
           </div>
           <p className={cn(
             "text-lg font-bold",
             metrics.npsGeral >= 50 ? "text-success" : 
             metrics.npsGeral >= 0 ? "text-warning" : "text-destructive"
           )}>
             {metrics.npsGeral}
           </p>
         </div>
 
         {/* Churn Valor */}
         <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
           <div className="flex items-center gap-2 mb-1">
             <TrendingDown size={14} className="text-destructive" />
             <span className="text-xs text-muted-foreground">Valor Churn</span>
           </div>
           <p className="text-lg font-bold text-destructive">{formatCurrency(metrics.churnValor)}</p>
         </div>
 
         {/* Custos (apenas para Growth) */}
         {showCosts && (
           <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
             <div className="flex items-center gap-2 mb-1">
               <Wallet size={14} className="text-warning" />
               <span className="text-xs text-muted-foreground">Custos Growth</span>
             </div>
             <p className="text-lg font-bold text-foreground">{formatCurrency(metrics.custosProduto)}</p>
           </div>
         )}
 
         {!showCosts && (
           <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
             <div className="flex items-center gap-2 mb-1">
               <Heart size={14} className="text-info" />
               <span className="text-xs text-muted-foreground">MRR Expansion</span>
             </div>
             <p className="text-lg font-bold text-success">{formatCurrency(metrics.mrrExpansion)}</p>
           </div>
         )}
       </div>
 
       {/* MRR Breakdown */}
       <div className="pt-3 border-t border-border/50">
         <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Composição MRR do Mês</p>
         <div className="flex flex-wrap gap-3 text-xs">
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-muted-foreground" />
             <span className="text-muted-foreground">Inicial:</span>
             <span className="font-medium">{formatCurrency(metrics.mrrInicial)}</span>
           </div>
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-success" />
             <span className="text-muted-foreground">Vendido:</span>
             <span className="font-medium text-success">+{formatCurrency(metrics.mrrVendido)}</span>
           </div>
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-info" />
             <span className="text-muted-foreground">Expansion:</span>
             <span className="font-medium text-info">+{formatCurrency(metrics.mrrExpansion)}</span>
           </div>
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-destructive" />
             <span className="text-muted-foreground">Depreciation:</span>
             <span className="font-medium text-destructive">-{formatCurrency(metrics.mrrDepreciation)}</span>
           </div>
         </div>
       </div>
     </div>
   );
 }