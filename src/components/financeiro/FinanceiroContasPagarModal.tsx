import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreditCard, Check, AlertTriangle, Clock, Pencil, X, CalendarDays, Plus, Trash2, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFinanceiroProdutos } from '@/hooks/useFinanceiroDRE';

interface ContaPagar {
  id: string;
  fornecedor: string;
  valor: number;
  categoria: string;
  status: 'pago' | 'pendente' | 'atrasado';
  produtos_vinculados: string[];
  area: string | null;
}

// Business areas for cost allocation
const AREAS = ['Financeiro', 'RH', 'Comercial', 'Operacional', 'Marketing interno'] as const;

// Generate month options (current + next 11 months)
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  
  // Include last 6 months and next 6 months
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    });
  }
  
  // Sort by date descending for display (most recent first)
  return options.sort((a, b) => b.value.localeCompare(a.value));
};

// Dados iniciais baseados nas imagens
const INITIAL_CONTAS: Omit<ContaPagar, 'id'>[] = [
  // Cartão
  { fornecedor: 'Open AI', valor: 224.59, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Hostinger', valor: 122.78, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Trello', valor: 685.93, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Linkedin', valor: 76.00, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Marketing interno' },
  { fornecedor: 'IOF Internacional', valor: 48.30, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Financeiro' },
  { fornecedor: 'Zap Sign', valor: 89.90, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Comercial' },
  { fornecedor: 'ElevenLabs', valor: 122.31, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Ranking de vendas', valor: 297.00, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Comercial' },
  { fornecedor: 'Reportei', valor: 659.90, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Adobe', valor: 275.00, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Make', valor: 105.72, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Google One', valor: 49.99, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Vturb', valor: 97.00, categoria: 'Cartão', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Opus Clip', valor: 50.18, categoria: 'Cartão', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'MeisterLab', valor: 235.70, categoria: 'Cartão', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Calendly', valor: 67.78, categoria: 'Cartão', status: 'pendente', produtos_vinculados: [], area: 'Comercial' },
  // Extras
  { fornecedor: 'Imposto', valor: 3500.00, categoria: 'Extras', status: 'pendente', produtos_vinculados: [], area: 'Financeiro' },
  { fornecedor: 'Contabilidade', valor: 450.00, categoria: 'Extras', status: 'pago', produtos_vinculados: [], area: 'Financeiro' },
  { fornecedor: 'INSS', valor: 333.96, categoria: 'Extras', status: 'pago', produtos_vinculados: [], area: 'Financeiro' },
  { fornecedor: 'Associacao Aemflo', valor: 49.50, categoria: 'Extras', status: 'pago', produtos_vinculados: [], area: 'Financeiro' },
  // Equipe
  { fornecedor: 'Augusto', valor: 4500.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Andrew (DEV)', valor: 4350.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Gabriel', valor: 4200.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Borginho (head de design)', valor: 8080.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Joel', valor: 2300.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Weder', valor: 8000.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Frank (Designer)', valor: 2350.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Wallacy', valor: 5000.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Assessoria Jurídica', valor: 2000.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Financeiro' },
  { fornecedor: 'Elisa (aux admn)', valor: 3600.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Financeiro' },
  { fornecedor: 'João', valor: 2350.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Guilherme', valor: 4640.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Maria Claria (Estágio)', valor: 1800.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Diego (Gestor de tráfego)', valor: 4810.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Alif', valor: 1950.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Jean', valor: 1860.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Fraga', valor: 4100.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Ian', valor: 1500.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Daniel', valor: 4740.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Lucca', valor: 900.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Pedro', valor: 300.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Nicoli', valor: 2200.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Comercial' },
  { fornecedor: 'Caio', valor: 4200.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Gabriel Gipp', valor: 3500.00, categoria: 'Equipe', status: 'pendente', produtos_vinculados: [], area: 'Operacional' },
  // Investimento
  { fornecedor: 'Ads Milennials', valor: 10000.00, categoria: 'Investimento', status: 'pago', produtos_vinculados: [], area: 'Marketing interno' },
  // Escritório
  { fornecedor: 'Aluguel', valor: 7000.00, categoria: 'Escritório', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Luz', valor: 500.00, categoria: 'Escritório', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Faxina', valor: 500.00, categoria: 'Escritório', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Compras escritorio', valor: 500.00, categoria: 'Escritório', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Claro', valor: 149.90, categoria: 'Escritório', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
  { fornecedor: 'Sim Digital', valor: 379.00, categoria: 'Escritório', status: 'pago', produtos_vinculados: [], area: 'Operacional' },
];

const CATEGORIAS = ['Freelas', 'Cartão', 'Extras', 'Equipe', 'Investimento', 'Escritório', 'CMV Mercadoria', 'CMV Serviços', 'CMV Produtos'];

const CATEGORIA_COLORS: Record<string, string> = {
  'Freelas': 'bg-purple-50 dark:bg-purple-900/30',
  'Cartão': 'bg-green-50 dark:bg-green-900/30',
  'Extras': 'bg-amber-50 dark:bg-amber-900/30',
  'Equipe': 'bg-green-100 dark:bg-green-900/40',
  'Investimento': 'bg-blue-50 dark:bg-blue-900/30',
  'Escritório': 'bg-amber-50 dark:bg-amber-900/30',
  'CMV Mercadoria': 'bg-orange-50 dark:bg-orange-900/30',
  'CMV Serviços': 'bg-rose-50 dark:bg-rose-900/30',
  'CMV Produtos': 'bg-red-50 dark:bg-red-900/30',
};

const CATEGORIA_HEADER_COLORS: Record<string, string> = {
  'Freelas': 'bg-purple-200 dark:bg-purple-800/60 text-purple-900 dark:text-purple-100',
  'Cartão': 'bg-green-300 dark:bg-green-700/60 text-green-900 dark:text-green-100',
  'Extras': 'bg-amber-300 dark:bg-amber-700/60 text-amber-900 dark:text-amber-100',
  'Equipe': 'bg-green-400 dark:bg-green-600/60 text-green-900 dark:text-green-100',
  'Investimento': 'bg-blue-300 dark:bg-blue-700/60 text-blue-900 dark:text-blue-100',
  'Escritório': 'bg-amber-400 dark:bg-amber-600/60 text-amber-900 dark:text-amber-100',
  'CMV Mercadoria': 'bg-orange-400 dark:bg-orange-600/60 text-orange-900 dark:text-orange-100',
  'CMV Serviços': 'bg-rose-400 dark:bg-rose-600/60 text-rose-900 dark:text-rose-100',
  'CMV Produtos': 'bg-red-400 dark:bg-red-600/60 text-red-900 dark:text-red-100',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Component for product selector with multi-select
function ProductSelector({ 
  selectedProducts, 
  onProductsChange,
  produtos,
}: { 
  selectedProducts: string[]; 
  onProductsChange: (products: string[]) => void;
  produtos: { id: string; nome: string; slug: string; cor: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleProduct = (slug: string) => {
    if (selectedProducts.includes(slug)) {
      onProductsChange(selectedProducts.filter(p => p !== slug));
    } else {
      onProductsChange([...selectedProducts, slug]);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 gap-1 text-xs"
        >
          <Package size={12} />
          {selectedProducts.length > 0 ? (
            <span>{selectedProducts.length} produto(s)</span>
          ) : (
            <span className="text-muted-foreground">Vincular</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
          Selecione os produtos
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {produtos.map(produto => (
            <label
              key={produto.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
            >
              <Checkbox
                checked={selectedProducts.includes(produto.slug)}
                onCheckedChange={() => toggleProduct(produto.slug)}
              />
              <div 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: produto.cor }} 
              />
              <span className="text-sm truncate">{produto.nome}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function FinanceiroContasPagarModal({ open, onOpenChange }: Props) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState({ fornecedor: '', valor: '', categoria: 'Cartão', produtos_vinculados: [] as string[], area: 'Operacional' });
  const queryClient = useQueryClient();
  
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const { data: produtos = [] } = useFinanceiroProdutos();

  // Fetch contas for the selected month from database
  const { data: contas = [], isLoading, refetch } = useQuery({
    queryKey: ['financeiro-contas-pagar', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_pagar')
        .select('*')
        .eq('mes_referencia', selectedMonth)
        .order('categoria', { ascending: true })
        .order('fornecedor', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        fornecedor: item.fornecedor,
        valor: Number(item.valor),
        categoria: item.categoria,
        status: item.status as 'pago' | 'pendente' | 'atrasado',
        produtos_vinculados: (item.produtos_vinculados as string[]) || [],
        area: item.area || null,
      }));
    },
    enabled: open,
  });

  // Initialize data for current month if empty
  const initializeMonthMutation = useMutation({
    mutationFn: async (month: string) => {
      // Check if month already has data
      const { data: existing } = await supabase
        .from('financeiro_contas_pagar')
        .select('id')
        .eq('mes_referencia', month)
        .limit(1);

      if (existing && existing.length > 0) return; // Already has data

      // Check if there's a previous month to copy from
      const prevMonthDate = new Date(month + '-01');
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonth = format(prevMonthDate, 'yyyy-MM');

      const { data: prevData } = await supabase
        .from('financeiro_contas_pagar')
        .select('fornecedor, valor, categoria, status, produtos_vinculados, area')
        .eq('mes_referencia', prevMonth);

      // If previous month has data, copy it (with status reset to pendente for future months)
      // Otherwise use initial data
      const isCurrentOrPast = month <= currentMonth;
      const dataToInsert = prevData && prevData.length > 0
        ? prevData.map(item => ({
            fornecedor: item.fornecedor,
            valor: item.valor,
            categoria: item.categoria,
            status: isCurrentOrPast ? item.status : 'pendente',
            produtos_vinculados: item.produtos_vinculados || [],
            area: item.area || null,
            mes_referencia: month,
          }))
        : INITIAL_CONTAS.map(item => ({
            fornecedor: item.fornecedor,
            valor: item.valor,
            categoria: item.categoria,
            status: isCurrentOrPast ? item.status : 'pendente',
            produtos_vinculados: item.produtos_vinculados || [],
            area: item.area || null,
            mes_referencia: month,
          }));

      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .insert(dataToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Initialize month when selected
  useEffect(() => {
    if (open && selectedMonth) {
      initializeMonthMutation.mutate(selectedMonth);
    }
  }, [open, selectedMonth]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar', selectedMonth] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Update value mutation
  const updateValueMutation = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .update({ valor })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar', selectedMonth] });
      toast.success('Valor atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar valor');
    },
  });

  // Update products mutation
  const updateProductsMutation = useMutation({
    mutationFn: async ({ id, produtos_vinculados }: { id: string; produtos_vinculados: string[] }) => {
      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .update({ produtos_vinculados })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-custos-auto'] });
      toast.success('Produtos atualizados!');
    },
    onError: () => {
      toast.error('Erro ao atualizar produtos');
    },
  });

  // Update area mutation
  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, area }: { id: string; area: string }) => {
      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .update({ area })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar-dre'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar área');
    },
  });

  // Add new conta mutation
  const addContaMutation = useMutation({
    mutationFn: async (newConta: { fornecedor: string; valor: number; categoria: string; produtos_vinculados: string[]; area: string }) => {
      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .insert({
          fornecedor: newConta.fornecedor,
          valor: newConta.valor,
          categoria: newConta.categoria,
          produtos_vinculados: newConta.produtos_vinculados,
          area: newConta.area,
          status: 'pendente',
          mes_referencia: selectedMonth,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar', selectedMonth] });
      toast.success('Conta adicionada!');
      setIsAddingNew(false);
      setNewItem({ fornecedor: '', valor: '', categoria: 'Cartão', produtos_vinculados: [], area: 'Operacional' });
    },
    onError: () => {
      toast.error('Erro ao adicionar conta');
    },
  });

  // Delete conta mutation
  const deleteContaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financeiro_contas_pagar')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar', selectedMonth] });
      toast.success('Conta removida!');
    },
    onError: () => {
      toast.error('Erro ao remover conta');
    },
  });

  const startEditing = (id: string, currentValue: number) => {
    setEditingId(id);
    setEditValue(currentValue.toFixed(2).replace('.', ','));
  };

  const saveValue = (id: string) => {
    const numericValue = parseFloat(editValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numericValue) && numericValue >= 0) {
      updateValueMutation.mutate({ id, valor: numericValue });
    }
    setEditingId(null);
    setEditValue('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleAddNew = () => {
    const valor = parseFloat(newItem.valor.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!newItem.fornecedor.trim()) {
      toast.error('Informe o nome do fornecedor');
      return;
    }
    if (isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    addContaMutation.mutate({ 
      fornecedor: newItem.fornecedor, 
      valor, 
      categoria: newItem.categoria,
      produtos_vinculados: newItem.produtos_vinculados,
      area: newItem.area,
    });
  };

  // Agrupar por categoria
  const contasPorCategoria = CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = contas.filter(c => c.categoria === cat);
    return acc;
  }, {} as Record<string, ContaPagar[]>);

  // Totais
  const totalGeral = contas.reduce((sum, c) => sum + c.valor, 0);
  const totalPago = contas.filter(c => c.status === 'pago').reduce((sum, c) => sum + c.valor, 0);
  const totalPendente = contas.filter(c => c.status === 'pendente').reduce((sum, c) => sum + c.valor, 0);
  const totalAtrasado = contas.filter(c => c.status === 'atrasado').reduce((sum, c) => sum + c.valor, 0);

  // Subtotais por categoria
  const subtotalPorCategoria = CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = contasPorCategoria[cat].reduce((sum, c) => sum + c.valor, 0);
    return acc;
  }, {} as Record<string, number>);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'pendente':
        return 'bg-amber-400 text-amber-900 hover:bg-amber-500';
      case 'atrasado':
        return 'bg-red-500 text-white hover:bg-red-600';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <CreditCard className="text-red-600 dark:text-red-400" size={22} />
              </div>
              <div>
                <DialogTitle className="text-xl">Contas a Pagar</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Gestão de fornecedores, equipe e despesas
                </p>
              </div>
            </div>
            
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 px-6 pb-4 shrink-0">
          <div className="rounded-xl bg-muted/50 p-3 border border-border">
            <p className="text-xs text-muted-foreground">Total Geral</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalGeral)}</p>
          </div>
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400">Pago</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(totalPago)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalPendente)}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">Atrasado</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(totalAtrasado)}</p>
          </div>
        </div>

        {/* Add New Button */}
        <div className="px-6 pb-3 shrink-0">
          {!isAddingNew ? (
            <Button 
              onClick={() => setIsAddingNew(true)} 
              variant="outline" 
              className="w-full gap-2"
            >
              <Plus size={16} />
              Adicionar Nova Conta
            </Button>
          ) : (
            <div className="flex gap-2 items-end p-3 rounded-xl border border-border bg-muted/30 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground">Fornecedor</label>
                <Input
                  placeholder="Nome do fornecedor"
                  value={newItem.fornecedor}
                  onChange={(e) => setNewItem(prev => ({ ...prev, fornecedor: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-muted-foreground">Valor</label>
                <Input
                  placeholder="0,00"
                  value={newItem.valor}
                  onChange={(e) => setNewItem(prev => ({ ...prev, valor: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div className="w-32">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Select value={newItem.categoria} onValueChange={(v) => setNewItem(prev => ({ ...prev, categoria: v }))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <label className="text-xs text-muted-foreground">Área</label>
                <Select value={newItem.area} onValueChange={(v) => setNewItem(prev => ({ ...prev, area: v }))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map(area => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Produtos</label>
                <ProductSelector 
                  selectedProducts={newItem.produtos_vinculados}
                  onProductsChange={(p) => setNewItem(prev => ({ ...prev, produtos_vinculados: p }))}
                  produtos={produtos}
                />
              </div>
              <Button size="sm" onClick={handleAddNew} disabled={addContaMutation.isPending}>
                <Check size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAddingNew(false)}>
                <X size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Table Container with proper scroll */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="h-full rounded-xl border border-border overflow-hidden flex flex-col">
            {/* Table Header - Fixed */}
            <div className="shrink-0 grid grid-cols-[1fr_100px_90px_100px_100px_40px] gap-2 px-4 py-3 bg-red-600 text-white font-semibold text-sm">
              <span>Fornecedor</span>
              <span className="text-right">Valor</span>
              <span className="text-center">Área</span>
              <span className="text-center">Produtos</span>
              <span className="text-center">Status</span>
              <span></span>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Carregando...
              </div>
            )}

            {/* Scrollable Content */}
            {!isLoading && (
              <div className="flex-1 overflow-y-auto">
                {CATEGORIAS.map(categoria => {
                  const items = contasPorCategoria[categoria];
                  const showEmpty = categoria === 'Freelas' && items.length === 0;
                  if (items.length === 0 && !showEmpty) return null;

                  return (
                    <div key={categoria}>
                      {/* Category Header */}
                      <div className={`grid grid-cols-[1fr_100px_90px_100px_100px_40px] gap-2 px-4 py-2.5 ${CATEGORIA_HEADER_COLORS[categoria] || 'bg-muted'} font-semibold text-sm sticky top-0 z-10`}>
                        <span>{categoria}</span>
                        <span className="text-right">{formatCurrency(subtotalPorCategoria[categoria])}</span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>

                      {/* Category Items */}
                      {items.map((conta, idx) => (
                        <div
                          key={conta.id}
                          className={`grid grid-cols-[1fr_100px_90px_100px_100px_40px] gap-2 px-4 py-2.5 ${CATEGORIA_COLORS[categoria] || 'bg-muted/30'} border-b border-border/30 items-center group ${idx % 2 === 1 ? 'opacity-90' : ''}`}
                        >
                          <span className="font-medium text-foreground text-sm truncate">{conta.fornecedor}</span>
                          
                          {/* Editable Value */}
                          <div className="flex items-center justify-end gap-1">
                            {editingId === conta.id ? (
                              <>
                                <span className="text-xs text-muted-foreground">R$</span>
                                <Input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-20 h-7 text-sm px-2 text-right"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveValue(conta.id);
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => saveValue(conta.id)}
                                >
                                  <Check size={14} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={cancelEditing}
                                >
                                  <X size={14} />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-foreground text-sm">
                                  {formatCurrency(conta.valor)}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                                  onClick={() => startEditing(conta.id, conta.valor)}
                                >
                                  <Pencil size={12} />
                                </Button>
                              </>
                            )}
                          </div>
                          {/* Area Selector */}
                          <div className="flex justify-center">
                            <Select
                              value={conta.area || ''}
                              onValueChange={(value) =>
                                updateAreaMutation.mutate({ id: conta.id, area: value })
                              }
                            >
                              <SelectTrigger className="w-full h-7 text-[10px] font-medium border-0 bg-white/50 dark:bg-gray-800/50">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {AREAS.map(area => (
                                  <SelectItem key={area} value={area} className="text-xs">
                                    {area}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Products */}
                          <div className="flex justify-center">
                            <ProductSelector
                              selectedProducts={conta.produtos_vinculados}
                              onProductsChange={(p) => updateProductsMutation.mutate({ id: conta.id, produtos_vinculados: p })}
                              produtos={produtos}
                            />
                          </div>

                          {/* Status */}
                          <div className="flex justify-center">
                            <Select
                              value={conta.status}
                              onValueChange={(value: 'pago' | 'pendente' | 'atrasado') =>
                                updateStatusMutation.mutate({ id: conta.id, status: value })
                              }
                            >
                              <SelectTrigger 
                                className={`w-24 h-7 text-xs font-semibold border-0 ${getStatusStyle(conta.status)}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pago">
                                  <div className="flex items-center gap-2">
                                    <Check size={14} className="text-green-600" />
                                    Pago
                                  </div>
                                </SelectItem>
                                <SelectItem value="pendente">
                                  <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-amber-600" />
                                    Pendente
                                  </div>
                                </SelectItem>
                                <SelectItem value="atrasado">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-red-600" />
                                    Atrasado
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Delete Button */}
                          <div className="flex justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                              onClick={() => {
                                if (confirm('Remover esta conta?')) {
                                  deleteContaMutation.mutate(conta.id);
                                }
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Empty category */}
                      {showEmpty && (
                        <div className={`px-4 py-4 text-center text-sm text-muted-foreground ${CATEGORIA_COLORS[categoria]}`}>
                          Nenhuma conta cadastrada
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
