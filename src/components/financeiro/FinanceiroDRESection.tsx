import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useFinanceiroDRE } from '@/hooks/useFinanceiroDRE';
import { useMargemPorProdutoAuto } from '@/hooks/useMargemProdutoAuto';
import { useDREAutomatico } from '@/hooks/useDREAutomatico';
import FinanceiroDREModal from './FinanceiroDREModal';
import FinanceiroCustosModal from './FinanceiroCustosModal';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

export default function FinanceiroDRESection() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDREModalOpen, setIsDREModalOpen] = useState(false);
  const [isCustosModalOpen, setIsCustosModalOpen] = useState(false);

  const mesReferencia = format(selectedDate, 'yyyy-MM');
  const { dreData, calculations, isLoading } = useFinanceiroDRE(mesReferencia);
  const { margens, totais } = useMargemPorProdutoAuto(mesReferencia);
  const { dadosAutomaticos } = useDREAutomatico(mesReferencia);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const isPositive = (value: number) => value >= 0;

  return (
    <div className="h-full overflow-y-auto scrollbar-apple pr-2">
      <div className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')} className="h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
          <span className="font-semibold text-sm capitalize">
            {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')} className="h-8 w-8">
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* DRE Summary Card */}
        <Card 
          className="border-subtle hover:shadow-apple-hover transition-all cursor-pointer"
          onClick={() => setIsDREModalOpen(true)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-primary" />
                <CardTitle className="text-sm font-semibold">DRE</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  <Zap size={10} />
                  Auto
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="h-32 bg-muted/50 rounded animate-pulse" />
            ) : (
              <>
                {/* Receita Bruta */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Receita Bruta</span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(Number(dreData?.receita_bruta) || 0)}
                  </span>
                </div>

                {/* Receita Líquida */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Receita Líquida</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(calculations.receitaLiquida)}
                  </span>
                </div>

                {/* Lucro Bruto */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Lucro Bruto</span>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "text-sm font-medium",
                      isPositive(calculations.lucroBruto) ? "text-emerald-600" : "text-destructive"
                    )}>
                      {formatCurrency(calculations.lucroBruto)}
                    </span>
                    <Badge variant="secondary" className="text-xs px-1">
                      {formatPercent(calculations.margemBruta)}
                    </Badge>
                  </div>
                </div>

                {/* EBITDA */}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs font-medium">EBITDA</span>
                  <span className={cn(
                    "text-sm font-bold",
                    isPositive(calculations.ebitda) ? "text-emerald-600" : "text-destructive"
                  )}>
                    {formatCurrency(calculations.ebitda)}
                  </span>
                </div>

                {/* Lucro Líquido */}
                <div className="flex items-center justify-between bg-muted/50 -mx-4 px-4 py-2 rounded-b-lg">
                  <span className="text-xs font-semibold">Lucro Líquido</span>
                  <div className="flex items-center gap-2">
                    {isPositive(calculations.lucroLiquido) ? (
                      <ArrowUpRight size={14} className="text-emerald-600" />
                    ) : (
                      <ArrowDownRight size={14} className="text-destructive" />
                    )}
                    <span className={cn(
                      "text-base font-bold",
                      isPositive(calculations.lucroLiquido) ? "text-emerald-600" : "text-destructive"
                    )}>
                      {formatCurrency(calculations.lucroLiquido)}
                    </span>
                    <Badge 
                      className={cn(
                        "text-xs",
                        isPositive(calculations.margemLiquida) 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {formatPercent(calculations.margemLiquida)}
                    </Badge>
                  </div>
                </div>

                {/* Custos por Área */}
                <div className="border-t pt-3 mt-2 space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Custos por Área</span>
                  {[
                    { label: 'Financeiro', value: dadosAutomaticos.custosPorArea['Financeiro'] || 0, color: 'bg-blue-500' },
                    { label: 'RH', value: dadosAutomaticos.custosPorArea['RH'] || 0, color: 'bg-purple-500' },
                    { label: 'Comercial', value: dadosAutomaticos.custosPorArea['Comercial'] || 0, color: 'bg-green-500' },
                    { label: 'Operacional', value: dadosAutomaticos.custosPorArea['Operacional'] || 0, color: 'bg-orange-500' },
                    { label: 'Marketing', value: dadosAutomaticos.custosPorArea['Marketing interno'] || 0, color: 'bg-pink-500' },
                  ].filter(area => area.value > 0).map(area => (
                    <div key={area.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", area.color)} />
                        <span className="text-xs text-muted-foreground">{area.label}</span>
                      </div>
                      <span className="text-xs font-medium text-orange-600">
                        {formatCurrency(area.value)}
                      </span>
                    </div>
                  ))}
                  {Object.values(dadosAutomaticos.custosPorArea).every(v => v === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Nenhum custo por área registrado
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Custos por Produto Card */}
        <Card 
          className="border-subtle hover:shadow-apple-hover transition-all cursor-pointer"
          onClick={() => setIsCustosModalOpen(true)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-orange-500" />
                <CardTitle className="text-sm font-semibold">Margem por Produto</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">Gerenciar</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {margens.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum produto configurado
              </p>
            ) : (
              <>
                {/* Top 3 produtos */}
                {margens
                  .filter(m => m.totalReceita > 0 || m.totalCustos > 0)
                  .slice(0, 3)
                  .map(m => (
                    <div key={m.produtoSlug} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: m.produtoCor }} 
                        />
                        <span className="text-xs font-medium truncate max-w-[120px]">
                          {m.produtoNome}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-medium",
                          isPositive(m.margem) ? "text-emerald-600" : "text-destructive"
                        )}>
                          {formatCurrency(m.margem)}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs px-1",
                            isPositive(m.margemPercent) 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" 
                              : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {formatPercent(m.margemPercent)}
                        </Badge>
                      </div>
                    </div>
                  ))}

                {/* Totais */}
                <div className="flex items-center justify-between border-t pt-2 mt-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total ({totais.clientes} clientes)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-bold",
                      isPositive(totais.margem) ? "text-emerald-600" : "text-destructive"
                    )}>
                      {formatCurrency(totais.margem)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-subtle">
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Receita Total</span>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(totais.receita)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-subtle">
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Custos Total</span>
                <span className="text-sm font-bold text-orange-600">
                  {formatCurrency(totais.custos)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <FinanceiroDREModal 
        open={isDREModalOpen} 
        onOpenChange={setIsDREModalOpen}
        mesReferencia={mesReferencia}
      />
      <FinanceiroCustosModal
        open={isCustosModalOpen}
        onOpenChange={setIsCustosModalOpen}
        mesReferencia={mesReferencia}
      />
    </div>
  );
}
