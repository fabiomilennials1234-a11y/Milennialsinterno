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
import { Receipt, Check, AlertTriangle, Search, Pencil, X, CalendarDays, Plus, Trash2, Clock, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClienteReceber {
  id: string;
  client_id: string;
  name: string;
  razao_social?: string;
  valor: number;
  status: 'em_dia' | 'pendente' | 'inadimplente';
  produto_slug?: string;
  produtos: string[];
}

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FinanceiroContasReceberModal({ open, onOpenChange }: Props) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newValor, setNewValor] = useState('');
  const queryClient = useQueryClient();
  
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Fetch all clients for the dropdown
  const { data: allClients = [] } = useQuery({
    queryKey: ['all-clients-for-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, expected_investment')
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch contas a receber for the selected month
  const { data: clientes = [], isLoading, refetch } = useQuery({
    queryKey: ['financeiro-contas-receber', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_receber')
        .select(`
          id,
          client_id,
          valor,
          status,
          produto_slug,
          client:clients(id, name, razao_social, contracted_products)
        `)
        .eq('mes_referencia', selectedMonth);

      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        client_id: item.client_id,
        name: item.client?.name || 'Cliente',
        razao_social: item.client?.razao_social,
        valor: Number(item.valor),
        status: item.status as 'em_dia' | 'pendente' | 'inadimplente',
        produto_slug: item.produto_slug,
        produtos: (item.client?.contracted_products as string[]) || [],
      }));
    },
    enabled: open,
  });

  // Initialize month with active clients if empty
  const initializeMonthMutation = useMutation({
    mutationFn: async (month: string) => {
      // Check if month already has data
      const { data: existing } = await supabase
        .from('financeiro_contas_receber')
        .select('id')
        .eq('mes_referencia', month)
        .limit(1);

      if (existing && existing.length > 0) return;

      // Check previous month for data to copy
      const prevMonthDate = new Date(month + '-01');
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonth = format(prevMonthDate, 'yyyy-MM');

      const { data: prevData } = await supabase
        .from('financeiro_contas_receber')
        .select('client_id, valor, status')
        .eq('mes_referencia', prevMonth);

      if (prevData && prevData.length > 0) {
        // Copy from previous month (reset status for future months)
        const isCurrentOrPast = month <= currentMonth;
        const dataToInsert = prevData.map(item => ({
          client_id: item.client_id,
          valor: item.valor,
          status: isCurrentOrPast ? item.status : 'pendente',
          mes_referencia: month,
        }));

        const { error } = await supabase
          .from('financeiro_contas_receber')
          .insert(dataToInsert);

        if (error) throw error;
      } else {
        // Initialize from financeiro_active_clients
        const { data: activeClients } = await supabase
          .from('financeiro_active_clients')
          .select('client_id, monthly_value, invoice_status');

        if (activeClients && activeClients.length > 0) {
          const dataToInsert = activeClients.map(item => ({
            client_id: item.client_id,
            valor: item.monthly_value || 0,
            status: item.invoice_status === 'inadimplente' ? 'inadimplente' : 'em_dia',
            mes_referencia: month,
          }));

          const { error } = await supabase
            .from('financeiro_contas_receber')
            .insert(dataToInsert);

          if (error) throw error;
        }
      }
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
        .from('financeiro_contas_receber')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Update value mutation - syncs across all systems
  const updateValueMutation = useMutation({
    mutationFn: async ({ id, clientId, newValue }: { id: string; clientId: string; newValue: number }) => {
      // Update financeiro_contas_receber for this month
      const { error: receberError } = await supabase
        .from('financeiro_contas_receber')
        .update({ valor: newValue })
        .eq('id', id);
      if (receberError) throw receberError;

      // Also update financeiro_active_clients
      await supabase
        .from('financeiro_active_clients')
        .update({ monthly_value: newValue })
        .eq('client_id', clientId);

      // Also update expected_investment in clients table
      await supabase
        .from('clients')
        .update({ expected_investment: newValue })
        .eq('id', clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Valor atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar valor');
    },
  });

  // Add new client mutation
  const addClientMutation = useMutation({
    mutationFn: async ({ clientId, valor }: { clientId: string; valor: number }) => {
      const { error } = await supabase
        .from('financeiro_contas_receber')
        .insert({
          client_id: clientId,
          valor,
          status: 'pendente',
          mes_referencia: selectedMonth,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
      toast.success('Cliente adicionado!');
      setIsAddingNew(false);
      setSelectedClientId('');
      setNewValor('');
    },
    onError: (error: any) => {
      if (error.message?.includes('unique') || error.code === '23505') {
        toast.error('Este cliente já está cadastrado neste mês');
      } else {
        toast.error('Erro ao adicionar cliente');
      }
    },
  });

  // Delete client from this month mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financeiro_contas_receber')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
      toast.success('Cliente removido deste mês!');
    },
    onError: () => {
      toast.error('Erro ao remover cliente');
    },
  });

  const startEditing = (id: string, currentValue: number) => {
    setEditingId(id);
    setEditValue(currentValue.toFixed(2).replace('.', ','));
  };

  const saveValue = (id: string, clientId: string) => {
    const numericValue = parseFloat(editValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numericValue) && numericValue >= 0) {
      updateValueMutation.mutate({ id, clientId, newValue: numericValue });
    } else {
      toast.error('Valor inválido');
    }
    setEditingId(null);
    setEditValue('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleAddNew = () => {
    if (!selectedClientId) {
      toast.error('Selecione um cliente');
      return;
    }
    const valor = parseFloat(newValor.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    addClientMutation.mutate({ clientId: selectedClientId, valor });
  };

  // Filter out clients that are already in the list for this month
  const availableClients = useMemo(() => {
    const existingClientIds = new Set(clientes.map(c => c.client_id));
    return allClients.filter(c => !existingClientIds.has(c.id));
  }, [allClients, clientes]);

  // Filtered clients
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm) return clientes;
    const term = searchTerm.toLowerCase();
    return clientes.filter(
      c =>
        c.name.toLowerCase().includes(term) ||
        (c.razao_social && c.razao_social.toLowerCase().includes(term))
    );
  }, [clientes, searchTerm]);

  // Totals
  const totalReceber = clientes.reduce((sum, c) => sum + c.valor, 0);
  const totalEmDia = clientes
    .filter(c => c.status === 'em_dia')
    .reduce((sum, c) => sum + c.valor, 0);
  const totalPendente = clientes
    .filter(c => c.status === 'pendente')
    .reduce((sum, c) => sum + c.valor, 0);
  const totalInadimplente = clientes
    .filter(c => c.status === 'inadimplente')
    .reduce((sum, c) => sum + c.valor, 0);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'em_dia':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'pendente':
        return 'bg-amber-400 text-amber-900 hover:bg-amber-500';
      case 'inadimplente':
        return 'bg-red-500 text-white hover:bg-red-600';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Receipt className="text-green-600 dark:text-green-400" size={22} />
              </div>
              <div>
                <DialogTitle className="text-xl">Contas a Receber</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Faturamento mensal de clientes ativos
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
            <p className="text-xs text-muted-foreground">Total a Receber</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalReceber)}</p>
            <p className="text-xs text-muted-foreground">{clientes.length} clientes</p>
          </div>
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400">Em Dia</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(totalEmDia)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalPendente)}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">Inadimplentes</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(totalInadimplente)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative px-6 shrink-0">
          <Search className="absolute left-9 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Add New Client Button */}
        <div className="px-6 py-3 shrink-0">
          {!isAddingNew ? (
            <Button 
              onClick={() => setIsAddingNew(true)} 
              variant="outline" 
              className="w-full gap-2"
              disabled={availableClients.length === 0}
            >
              <Plus size={16} />
              Adicionar Cliente
            </Button>
          ) : (
            <div className="flex gap-2 items-end p-3 rounded-xl border border-border bg-muted/30">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Cliente</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <label className="text-xs text-muted-foreground">Valor</label>
                <Input
                  placeholder="0,00"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  className="h-8"
                />
              </div>
              <Button size="sm" onClick={handleAddNew} disabled={addClientMutation.isPending}>
                <Check size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAddingNew(false)}>
                <X size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="h-full rounded-xl border border-border overflow-hidden flex flex-col">
            {/* Table Header */}
            <div className="shrink-0 grid grid-cols-[1fr_120px_140px_140px_40px] gap-3 px-4 py-3 bg-green-600 text-white font-semibold text-sm">
              <span>Cliente</span>
              <span>Produtos</span>
              <span className="text-right">Valor Mensal</span>
              <span className="text-center">Status</span>
              <span></span>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Loading state */}
              {isLoading && (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando clientes...
                </div>
              )}

              {/* Empty state */}
              {!isLoading && clientesFiltrados.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado neste mês'}
                </div>
              )}

              {/* Client rows */}
              {clientesFiltrados.map((cliente, idx) => (
                <div
                  key={cliente.id}
                  className={`grid grid-cols-[1fr_120px_140px_140px_40px] gap-3 px-4 py-3 border-b border-border/50 items-center group ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                  }`}
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">{cliente.name}</p>
                    {cliente.razao_social && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {cliente.razao_social}
                      </p>
                    )}
                  </div>

                  {/* Produtos contratados */}
                  <div className="flex flex-wrap gap-1">
                    {(cliente.produtos?.length ?? 0) > 0 ? (
                      cliente.produtos.slice(0, 2).map((prod, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0 h-5 capitalize"
                        >
                          {prod.replace(/-/g, ' ').replace('millennials ', '')}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                    {(cliente.produtos?.length ?? 0) > 2 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                        +{cliente.produtos.length - 2}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Editable Value */}
                  <div className="flex items-center justify-end gap-1">
                    {editingId === cliente.id ? (
                      <>
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 h-7 text-sm px-2 text-right"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveValue(cliente.id, cliente.client_id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => saveValue(cliente.id, cliente.client_id)}
                          disabled={updateValueMutation.isPending}
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
                        <span className="font-semibold text-foreground">
                          {formatCurrency(cliente.valor)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                          onClick={() => startEditing(cliente.id, cliente.valor)}
                        >
                          <Pencil size={12} />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <Select
                      value={cliente.status}
                      onValueChange={(value: 'em_dia' | 'pendente' | 'inadimplente') =>
                        updateStatusMutation.mutate({ id: cliente.id, status: value })
                      }
                    >
                      <SelectTrigger 
                        className={`w-32 h-7 text-xs font-semibold border-0 ${getStatusStyle(cliente.status)}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="em_dia">
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
                        <SelectItem value="inadimplente">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-red-600" />
                            Inadimplente
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
                        if (confirm('Remover este cliente deste mês?')) {
                          deleteClientMutation.mutate(cliente.id);
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
