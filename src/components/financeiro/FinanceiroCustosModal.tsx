import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Package, DollarSign, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  useFinanceiroProdutos, 
  useFinanceiroCustosProduto, 
  useFinanceiroReceitaProduto,
  useMargensProduto,
  Produto,
} from '@/hooks/useFinanceiroDRE';
import { useClientsByProduct } from '@/hooks/useClientsByProduct';
import ProductClientMarginList from './ProductClientMarginList';

interface FinanceiroCustosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesReferencia: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function CurrencyInput({ 
  value, 
  onChange, 
  label,
  small = false,
}: { 
  value: number; 
  onChange: (value: number) => void; 
  label: string;
  small?: boolean;
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

  return (
    <div className="space-y-1">
      <Label className={cn("text-muted-foreground", small ? "text-[10px]" : "text-xs")}>{label}</Label>
      <div className="relative">
        <span className={cn("absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground", small ? "text-[10px]" : "text-xs")}>R$</span>
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          className={cn("pl-7", small ? "h-7 text-xs" : "h-8 text-sm")}
        />
      </div>
    </div>
  );
}

function NumberInput({ 
  value, 
  onChange, 
  label,
}: { 
  value: number; 
  onChange: (value: number) => void; 
  label: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    </div>
  );
}

interface ProdutoFormData {
  receita_recorrente: number;
  receita_avulsa: number;
  outras_receitas: number;
  clientes_ativos: number;
  custo_pessoal: number;
  custo_ferramentas: number;
  custo_terceiros: number;
  custo_marketing: number;
  outros_custos: number;
}

function ProdutoTab({ 
  produto, 
  mesReferencia,
  onSave,
  isSaving,
}: { 
  produto: Produto;
  mesReferencia: string;
  onSave: (produtoId: string, data: ProdutoFormData) => void;
  isSaving: boolean;
}) {
  const { receitas } = useFinanceiroReceitaProduto(mesReferencia);
  const { custos } = useFinanceiroCustosProduto(mesReferencia);
  
  const receitaProduto = receitas.find(r => r.produto_id === produto.id);
  const custoProduto = custos.find(c => c.produto_id === produto.id && !c.departamento_id);

  const [formData, setFormData] = useState<ProdutoFormData>({
    receita_recorrente: 0,
    receita_avulsa: 0,
    outras_receitas: 0,
    clientes_ativos: 0,
    custo_pessoal: 0,
    custo_ferramentas: 0,
    custo_terceiros: 0,
    custo_marketing: 0,
    outros_custos: 0,
  });

  useEffect(() => {
    setFormData({
      receita_recorrente: Number(receitaProduto?.receita_recorrente) || 0,
      receita_avulsa: Number(receitaProduto?.receita_avulsa) || 0,
      outras_receitas: Number(receitaProduto?.outras_receitas) || 0,
      clientes_ativos: receitaProduto?.clientes_ativos || 0,
      custo_pessoal: Number(custoProduto?.custo_pessoal) || 0,
      custo_ferramentas: Number(custoProduto?.custo_ferramentas) || 0,
      custo_terceiros: Number(custoProduto?.custo_terceiros) || 0,
      custo_marketing: Number(custoProduto?.custo_marketing) || 0,
      outros_custos: Number(custoProduto?.outros_custos) || 0,
    });
  }, [receitaProduto, custoProduto]);

  const totalReceita = formData.receita_recorrente + formData.receita_avulsa + formData.outras_receitas;
  const totalCustos = formData.custo_pessoal + formData.custo_ferramentas + formData.custo_terceiros + formData.custo_marketing + formData.outros_custos;
  const margem = totalReceita - totalCustos;
  const margemPercentual = totalReceita > 0 ? (margem / totalReceita) * 100 : 0;
  const margemPorCliente = formData.clientes_ativos > 0 ? margem / formData.clientes_ativos : 0;

  const updateField = (field: keyof ProdutoFormData, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Receitas */}
      <Card className="border-subtle">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-600" />
            <CardTitle className="text-sm font-semibold">Receitas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Receita Recorrente (MRR)"
              value={formData.receita_recorrente}
              onChange={(v) => updateField('receita_recorrente', v)}
            />
            <CurrencyInput
              label="Receita Avulsa"
              value={formData.receita_avulsa}
              onChange={(v) => updateField('receita_avulsa', v)}
            />
            <CurrencyInput
              label="Outras Receitas"
              value={formData.outras_receitas}
              onChange={(v) => updateField('outras_receitas', v)}
            />
            <NumberInput
              label="Clientes Ativos"
              value={formData.clientes_ativos}
              onChange={(v) => updateField('clientes_ativos', v)}
            />
          </div>
          <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
            <span className="text-xs font-medium">Total Receita</span>
            <span className="text-sm font-bold text-emerald-600">
              {formatCurrency(totalReceita)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Custos */}
      <Card className="border-subtle">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-orange-600" />
            <CardTitle className="text-sm font-semibold">Custos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Pessoal (Salários + Benefícios)"
              value={formData.custo_pessoal}
              onChange={(v) => updateField('custo_pessoal', v)}
            />
            <CurrencyInput
              label="Ferramentas (Software)"
              value={formData.custo_ferramentas}
              onChange={(v) => updateField('custo_ferramentas', v)}
            />
            <CurrencyInput
              label="Terceiros (Freelancers)"
              value={formData.custo_terceiros}
              onChange={(v) => updateField('custo_terceiros', v)}
            />
            <CurrencyInput
              label="Marketing"
              value={formData.custo_marketing}
              onChange={(v) => updateField('custo_marketing', v)}
            />
          </div>
          <CurrencyInput
            label="Outros Custos"
            value={formData.outros_custos}
            onChange={(v) => updateField('outros_custos', v)}
          />
          <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-950/30 p-2 rounded">
            <span className="text-xs font-medium">Total Custos</span>
            <span className="text-sm font-bold text-orange-600">
              {formatCurrency(totalCustos)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Margens Calculadas */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Margens Calculadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Margem do Produto</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-base font-bold",
                margem >= 0 ? "text-emerald-600" : "text-destructive"
              )}>
                {formatCurrency(margem)}
              </span>
              <Badge className={cn(
                "text-xs",
                margemPercentual >= 0 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50" 
                  : "bg-destructive/10 text-destructive"
              )}>
                {margemPercentual.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Margem por Cliente</span>
            <span className={cn(
              "text-sm font-semibold",
              margemPorCliente >= 0 ? "text-emerald-600" : "text-destructive"
            )}>
              {formatCurrency(margemPorCliente)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button 
        className="w-full" 
        onClick={() => onSave(produto.id, formData)}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar {produto.nome}
      </Button>
    </div>
  );
}

export default function FinanceiroCustosModal({
  open,
  onOpenChange,
  mesReferencia,
}: FinanceiroCustosModalProps) {
  const { data: produtos = [], isLoading } = useFinanceiroProdutos();
  const { saveCusto, custos } = useFinanceiroCustosProduto(mesReferencia);
  const { saveReceita } = useFinanceiroReceitaProduto(mesReferencia);
  const { margens, totais } = useMargensProduto(mesReferencia);
  const { data: clientsByProduct = {} } = useClientsByProduct();
  const [isSaving, setIsSaving] = useState(false);
  const [mainTab, setMainTab] = useState<'produtos' | 'clientes'>('produtos');

  const [year, month] = mesReferencia.split('-');
  const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: ptBR });

  // Calculate costs per product slug
  const custosPorProdutoSlug = useMemo(() => {
    const result: Record<string, number> = {};
    
    // Map product IDs to their slugs
    const productIdToSlug: Record<string, string> = {};
    produtos.forEach(p => {
      productIdToSlug[p.id] = p.slug;
    });
    
    // Aggregate costs by product slug
    custos.forEach(c => {
      const slug = productIdToSlug[c.produto_id];
      if (slug) {
        const totalCusto = 
          (Number(c.custo_pessoal) || 0) + 
          (Number(c.custo_ferramentas) || 0) + 
          (Number(c.custo_terceiros) || 0) + 
          (Number(c.custo_marketing) || 0) + 
          (Number(c.outros_custos) || 0);
        result[slug] = (result[slug] || 0) + totalCusto;
      }
    });
    
    return result;
  }, [custos, produtos]);

  // Calculate client margins per product
  const productsWithClientMargins = useMemo(() => {
    return Object.entries(clientsByProduct).map(([slug, clients]) => {
      const totalReceita = clients.reduce((sum, c) => sum + c.monthlyValue, 0);
      const totalCustos = custosPorProdutoSlug[slug] || 0;
      
      // Get product color from produtos list
      const produto = produtos.find(p => p.slug === slug);
      const productColor = produto?.cor || '#6366f1';
      const productName = clients[0]?.productName || slug;
      
      const clientsWithMargin = clients.map(client => {
        const revenueShare = totalReceita > 0 ? client.monthlyValue / totalReceita : 0;
        const estimatedCost = totalCustos * revenueShare;
        const margin = client.monthlyValue - estimatedCost;
        const marginPercent = client.monthlyValue > 0 ? (margin / client.monthlyValue) * 100 : 0;

        return {
          clientId: client.clientId,
          clientName: client.clientName,
          razaoSocial: client.razaoSocial,
          monthlyValue: client.monthlyValue,
          estimatedCost,
          margin,
          marginPercent,
        };
      });

      return {
        productSlug: slug,
        productName,
        productColor,
        clients: clientsWithMargin.sort((a, b) => b.margin - a.margin),
        totalReceita,
        totalCustos,
        totalMargem: totalReceita - totalCustos,
        margemPercent: totalReceita > 0 ? ((totalReceita - totalCustos) / totalReceita) * 100 : 0,
      };
    }).sort((a, b) => b.totalMargem - a.totalMargem);
  }, [clientsByProduct, custosPorProdutoSlug, produtos]);

  const handleSave = async (produtoId: string, data: ProdutoFormData) => {
    setIsSaving(true);
    try {
      // Save receita
      await saveReceita.mutateAsync({
        produto_id: produtoId,
        receita_recorrente: data.receita_recorrente,
        receita_avulsa: data.receita_avulsa,
        outras_receitas: data.outras_receitas,
        clientes_ativos: data.clientes_ativos,
      });

      // Save custos
      await saveCusto.mutateAsync({
        produto_id: produtoId,
        departamento_id: null,
        custo_pessoal: data.custo_pessoal,
        custo_ferramentas: data.custo_ferramentas,
        custo_terceiros: data.custo_terceiros,
        custo_marketing: data.custo_marketing,
        outros_custos: data.outros_custos,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isPositive = (value: number) => value >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold capitalize">
                  Margem por Produto - {monthName}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Gerencie receitas, custos e veja a margem por cliente
                </p>
              </div>
            </div>
            
            {/* Main tab switcher */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button 
                size="sm" 
                variant={mainTab === 'produtos' ? 'default' : 'ghost'}
                onClick={() => setMainTab('produtos')}
                className="text-xs h-7"
              >
                <Package size={12} className="mr-1" />
                Produtos
              </Button>
              <Button 
                size="sm" 
                variant={mainTab === 'clientes' ? 'default' : 'ghost'}
                onClick={() => setMainTab('clientes')}
                className="text-xs h-7"
              >
                <Users size={12} className="mr-1" />
                Por Cliente
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Overview Stats */}
        <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className="text-sm font-bold text-emerald-600">{formatCurrency(totais.receita)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Custos Total</p>
              <p className="text-sm font-bold text-orange-600">{formatCurrency(totais.custos)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Margem Total</p>
              <p className={cn("text-sm font-bold", isPositive(totais.margem) ? "text-emerald-600" : "text-destructive")}>
                {formatCurrency(totais.margem)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              <p className="text-sm font-bold text-blue-600">{totais.clientesAtivos}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted/50 rounded animate-pulse" />
              ))}
            </div>
          ) : mainTab === 'produtos' ? (
            /* Produtos Tab Content */
            produtos.length === 0 ? (
              <div className="p-6 text-center">
                <Package size={48} className="mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum produto configurado</p>
              </div>
            ) : (
              <Tabs defaultValue={produtos[0]?.id} className="h-full flex flex-col">
                <TabsList className="mx-6 mt-4 flex-wrap h-auto gap-1 justify-start shrink-0">
                  {produtos.map(p => (
                    <TabsTrigger 
                      key={p.id} 
                      value={p.id}
                      className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-1.5" 
                        style={{ backgroundColor: p.cor }} 
                      />
                      {p.nome}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollArea className="flex-1 px-6 pb-6">
                  {produtos.map(p => (
                    <TabsContent key={p.id} value={p.id} className="mt-4">
                      <ProdutoTab 
                        produto={p} 
                        mesReferencia={mesReferencia}
                        onSave={handleSave}
                        isSaving={isSaving}
                      />
                    </TabsContent>
                  ))}
                </ScrollArea>
              </Tabs>
            )
          ) : (
            /* Clientes Tab Content */
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                {productsWithClientMargins.length === 0 ? (
                  <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente com produto cadastrado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cadastre valores por produto na tela de registro de clientes
                    </p>
                  </div>
                ) : (
                  productsWithClientMargins.map(product => (
                    <ProductClientMarginList
                      key={product.productSlug}
                      productName={product.productName}
                      productColor={product.productColor}
                      clients={product.clients}
                      totalReceita={product.totalReceita}
                      totalCustos={product.totalCustos}
                      totalMargem={product.totalMargem}
                      margemPercent={product.margemPercent}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
