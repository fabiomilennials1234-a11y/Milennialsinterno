import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, FileSpreadsheet, TrendingUp, TrendingDown, RefreshCw, Zap, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useFinanceiroDRE, DREData, calculateDRE } from '@/hooks/useFinanceiroDRE';
import { useDREAutomatico } from '@/hooks/useDREAutomatico';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FinanceiroDREModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesReferencia: string;
}

function CurrencyInput({ 
  value, 
  onChange, 
  label,
  className,
  autoValue,
  onSync,
}: { 
  value: number; 
  onChange: (value: number) => void; 
  label: string;
  className?: string;
  autoValue?: number;
  onSync?: () => void;
}) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    const num = parseFloat(inputValue.replace(/[^\d.-]/g, '')) || 0;
    onChange(num);
    setInputValue(num.toString());
  };

  const isDifferent = autoValue !== undefined && Math.abs(autoValue - value) > 0.01;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {autoValue !== undefined && isDifferent && onSync && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 px-1.5 text-xs gap-1 text-amber-600"
                  onClick={onSync}
                >
                  <RefreshCw size={10} />
                  Sincronizar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Valor automático: {formatCurrency(autoValue)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          className={cn(
            "pl-8 h-8 text-sm",
            isDifferent && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
          )}
        />
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function FinanceiroDREModal({
  open,
  onOpenChange,
  mesReferencia,
}: FinanceiroDREModalProps) {
  const { dreData, saveDRE, isLoading } = useFinanceiroDRE(mesReferencia);
  const { dadosAutomaticos, camposDRE } = useDREAutomatico(mesReferencia);
  
  const [formData, setFormData] = useState<Partial<DREData>>({
    receita_bruta: 0,
    deducoes_impostos: 0,
    deducoes_descontos: 0,
    outras_deducoes: 0,
    cmv_produtos: 0,
    cmv_servicos: 0,
    outros_cmv: 0,
    despesas_pessoal: 0,
    despesas_administrativas: 0,
    despesas_comerciais: 0,
    despesas_marketing: 0,
    despesas_ti: 0,
    despesas_ocupacao: 0,
    outras_despesas_operacionais: 0,
    receitas_financeiras: 0,
    despesas_financeiras: 0,
    outras_receitas: 0,
    outras_despesas: 0,
    impostos_lucro: 0,
    notas: '',
  });

  useEffect(() => {
    if (dreData) {
      setFormData({
        receita_bruta: Number(dreData.receita_bruta) || 0,
        deducoes_impostos: Number(dreData.deducoes_impostos) || 0,
        deducoes_descontos: Number(dreData.deducoes_descontos) || 0,
        outras_deducoes: Number(dreData.outras_deducoes) || 0,
        cmv_produtos: Number(dreData.cmv_produtos) || 0,
        cmv_servicos: Number(dreData.cmv_servicos) || 0,
        outros_cmv: Number(dreData.outros_cmv) || 0,
        despesas_pessoal: Number(dreData.despesas_pessoal) || 0,
        despesas_administrativas: Number(dreData.despesas_administrativas) || 0,
        despesas_comerciais: Number(dreData.despesas_comerciais) || 0,
        despesas_marketing: Number(dreData.despesas_marketing) || 0,
        despesas_ti: Number(dreData.despesas_ti) || 0,
        despesas_ocupacao: Number(dreData.despesas_ocupacao) || 0,
        outras_despesas_operacionais: Number(dreData.outras_despesas_operacionais) || 0,
        receitas_financeiras: Number(dreData.receitas_financeiras) || 0,
        despesas_financeiras: Number(dreData.despesas_financeiras) || 0,
        outras_receitas: Number(dreData.outras_receitas) || 0,
        outras_despesas: Number(dreData.outras_despesas) || 0,
        impostos_lucro: Number(dreData.impostos_lucro) || 0,
        notas: dreData.notas || '',
      });
    }
  }, [dreData]);

  const updateField = (field: keyof DREData, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const syncAllFromAuto = () => {
    setFormData(prev => ({
      ...prev,
      receita_bruta: camposDRE.receita_bruta,
      // CMV
      cmv_produtos: camposDRE.cmv_produtos,
      cmv_servicos: camposDRE.cmv_servicos,
      outros_cmv: camposDRE.outros_cmv,
      // Despesas Operacionais
      despesas_pessoal: camposDRE.despesas_pessoal,
      despesas_ti: camposDRE.despesas_ti,
      despesas_ocupacao: camposDRE.despesas_ocupacao,
      despesas_administrativas: camposDRE.despesas_administrativas,
      despesas_marketing: camposDRE.despesas_marketing,
    }));
  };

  const calculations = calculateDRE(formData);

  const handleSave = () => {
    saveDRE.mutate(formData, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const isPositive = (value: number) => value >= 0;

  const [year, month] = mesReferencia.split('-');
  const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold capitalize">
                  DRE - {monthName}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Demonstrativo do Resultado do Exercício
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={syncAllFromAuto}
            >
              <Zap size={14} />
              Sincronizar Tudo
            </Button>
          </div>
        </DialogHeader>

        {/* Auto Data Summary */}
        <div className="px-6 py-3 bg-muted/30 border-b shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Dados automáticos de Contas a Pagar/Receber
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200 dark:border-emerald-800">
              <span className="text-emerald-600 dark:text-emerald-400">Receita</span>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(dadosAutomaticos.receitaBruta)}
              </p>
              <span className="text-emerald-500">{dadosAutomaticos.totalClientes} clientes</span>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded border border-orange-200 dark:border-orange-800">
              <span className="text-orange-600 dark:text-orange-400">Custos</span>
              <p className="font-bold text-orange-700 dark:text-orange-300">
                {formatCurrency(dadosAutomaticos.totalCustos)}
              </p>
              <span className="text-orange-500">
                {formatCurrency(dadosAutomaticos.custosPagos)} pagos
              </span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
              <span className="text-blue-600 dark:text-blue-400">Margem</span>
              <p className={cn(
                "font-bold",
                dadosAutomaticos.margemBruta >= 0 ? "text-emerald-600" : "text-destructive"
              )}>
                {formatCurrency(dadosAutomaticos.margemBruta)}
              </p>
              <span className="text-blue-500">{dadosAutomaticos.margemPercentual.toFixed(1)}%</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800">
              <span className="text-amber-600 dark:text-amber-400">Pendente</span>
              <p className="font-bold text-amber-700 dark:text-amber-300">
                {formatCurrency(dadosAutomaticos.custosPendentes)}
              </p>
              {dadosAutomaticos.custosAtrasados > 0 && (
                <span className="text-red-500">
                  {formatCurrency(dadosAutomaticos.custosAtrasados)} atrasado
                </span>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* RECEITAS */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-600" />
                Receitas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput
                  label="Receita Bruta"
                  value={formData.receita_bruta || 0}
                  onChange={(v) => updateField('receita_bruta', v)}
                  autoValue={camposDRE.receita_bruta}
                  onSync={() => updateField('receita_bruta', camposDRE.receita_bruta)}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <CurrencyInput
                  label="(-) Impostos s/ Vendas"
                  value={formData.deducoes_impostos || 0}
                  onChange={(v) => updateField('deducoes_impostos', v)}
                />
                <CurrencyInput
                  label="(-) Descontos"
                  value={formData.deducoes_descontos || 0}
                  onChange={(v) => updateField('deducoes_descontos', v)}
                />
                <CurrencyInput
                  label="(-) Outras Deduções"
                  value={formData.outras_deducoes || 0}
                  onChange={(v) => updateField('outras_deducoes', v)}
                />
              </div>
              <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span className="text-sm font-medium">(=) Receita Líquida</span>
                <span className="text-sm font-bold text-emerald-600">
                  {formatCurrency(calculations.receitaLiquida)}
                </span>
              </div>
            </div>

            <Separator />

            {/* CMV */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingDown size={14} className="text-orange-600" />
                  Custo das Mercadorias/Serviços Vendidos
                </h3>
                <Badge variant="outline" className="text-xs gap-1">
                  <Zap size={10} />
                  Auto: {formatCurrency(
                    camposDRE.cmv_produtos + 
                    camposDRE.cmv_servicos + 
                    camposDRE.outros_cmv
                  )}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <CurrencyInput
                  label="CMV - Produtos"
                  value={formData.cmv_produtos || 0}
                  onChange={(v) => updateField('cmv_produtos', v)}
                  autoValue={camposDRE.cmv_produtos}
                  onSync={() => updateField('cmv_produtos', camposDRE.cmv_produtos)}
                />
                <CurrencyInput
                  label="CMV - Serviços"
                  value={formData.cmv_servicos || 0}
                  onChange={(v) => updateField('cmv_servicos', v)}
                  autoValue={camposDRE.cmv_servicos}
                  onSync={() => updateField('cmv_servicos', camposDRE.cmv_servicos)}
                />
                <CurrencyInput
                  label="Outros CMV (Mercadoria)"
                  value={formData.outros_cmv || 0}
                  onChange={(v) => updateField('outros_cmv', v)}
                  autoValue={camposDRE.outros_cmv}
                  onSync={() => updateField('outros_cmv', camposDRE.outros_cmv)}
                />
              </div>
              <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span className="text-sm font-medium">(=) Lucro Bruto</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-bold",
                    isPositive(calculations.lucroBruto) ? "text-emerald-600" : "text-destructive"
                  )}>
                    {formatCurrency(calculations.lucroBruto)}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {calculations.margemBruta.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* DESPESAS OPERACIONAIS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingDown size={14} className="text-red-600" />
                  Despesas Operacionais
                </h3>
                <Badge variant="outline" className="text-xs gap-1">
                  <Zap size={10} />
                  Auto: {formatCurrency(
                    camposDRE.despesas_pessoal + 
                    camposDRE.despesas_ti + 
                    camposDRE.despesas_ocupacao + 
                    camposDRE.despesas_administrativas + 
                    camposDRE.despesas_marketing
                  )}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput
                  label="Pessoal (Equipe + Freelas)"
                  value={formData.despesas_pessoal || 0}
                  onChange={(v) => updateField('despesas_pessoal', v)}
                  autoValue={camposDRE.despesas_pessoal}
                  onSync={() => updateField('despesas_pessoal', camposDRE.despesas_pessoal)}
                />
                <CurrencyInput
                  label="Administrativas (Extras)"
                  value={formData.despesas_administrativas || 0}
                  onChange={(v) => updateField('despesas_administrativas', v)}
                  autoValue={camposDRE.despesas_administrativas}
                  onSync={() => updateField('despesas_administrativas', camposDRE.despesas_administrativas)}
                />
                <CurrencyInput
                  label="Comerciais"
                  value={formData.despesas_comerciais || 0}
                  onChange={(v) => updateField('despesas_comerciais', v)}
                />
                <CurrencyInput
                  label="Marketing (Investimento)"
                  value={formData.despesas_marketing || 0}
                  onChange={(v) => updateField('despesas_marketing', v)}
                  autoValue={camposDRE.despesas_marketing}
                  onSync={() => updateField('despesas_marketing', camposDRE.despesas_marketing)}
                />
                <CurrencyInput
                  label="TI/Sistemas (Cartão/Software)"
                  value={formData.despesas_ti || 0}
                  onChange={(v) => updateField('despesas_ti', v)}
                  autoValue={camposDRE.despesas_ti}
                  onSync={() => updateField('despesas_ti', camposDRE.despesas_ti)}
                />
                <CurrencyInput
                  label="Ocupação (Escritório)"
                  value={formData.despesas_ocupacao || 0}
                  onChange={(v) => updateField('despesas_ocupacao', v)}
                  autoValue={camposDRE.despesas_ocupacao}
                  onSync={() => updateField('despesas_ocupacao', camposDRE.despesas_ocupacao)}
                />
              </div>
              <CurrencyInput
                label="Outras Despesas Operacionais"
                value={formData.outras_despesas_operacionais || 0}
                onChange={(v) => updateField('outras_despesas_operacionais', v)}
              />
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">EBITDA</span>
                <span className={cn(
                  "text-base font-bold",
                  isPositive(calculations.ebitda) ? "text-emerald-600" : "text-destructive"
                )}>
                  {formatCurrency(calculations.ebitda)}
                </span>
              </div>
            </div>

            <Separator />

            {/* RESULTADO FINANCEIRO */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Resultado Financeiro e Outros</h3>
              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput
                  label="(+) Receitas Financeiras"
                  value={formData.receitas_financeiras || 0}
                  onChange={(v) => updateField('receitas_financeiras', v)}
                />
                <CurrencyInput
                  label="(-) Despesas Financeiras"
                  value={formData.despesas_financeiras || 0}
                  onChange={(v) => updateField('despesas_financeiras', v)}
                />
                <CurrencyInput
                  label="(+) Outras Receitas"
                  value={formData.outras_receitas || 0}
                  onChange={(v) => updateField('outras_receitas', v)}
                />
                <CurrencyInput
                  label="(-) Outras Despesas"
                  value={formData.outras_despesas || 0}
                  onChange={(v) => updateField('outras_despesas', v)}
                />
              </div>
            </div>

            <Separator />

            {/* IMPOSTOS E LUCRO LÍQUIDO */}
            <div className="space-y-3">
              <CurrencyInput
                label="(-) Impostos sobre Lucro (IR/CSLL)"
                value={formData.impostos_lucro || 0}
                onChange={(v) => updateField('impostos_lucro', v)}
              />
              <div className="flex justify-between items-center bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <span className="text-base font-bold">LUCRO LÍQUIDO</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xl font-bold",
                    isPositive(calculations.lucroLiquido) ? "text-emerald-600" : "text-destructive"
                  )}>
                    {formatCurrency(calculations.lucroLiquido)}
                  </span>
                  <Badge 
                    className={cn(
                      isPositive(calculations.margemLiquida) 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50" 
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {calculations.margemLiquida.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* NOTAS */}
            <div className="space-y-2">
              <Label>Notas/Observações</Label>
              <Textarea
                value={formData.notas || ''}
                onChange={(e) => updateField('notas', e.target.value)}
                placeholder="Anotações sobre este mês..."
                className="min-h-[80px]"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveDRE.isPending}>
            {saveDRE.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar DRE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
