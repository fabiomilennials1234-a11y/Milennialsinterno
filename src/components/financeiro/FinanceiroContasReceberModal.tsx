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
import {
  Receipt, Check, AlertTriangle, Search, Pencil, X,
  CalendarDays, Plus, Trash2, Clock, ChevronDown, ChevronRight,
  CheckCircle2, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useContasReceber, getProductDisplayName, type ContaReceberEntry, type ClientGroup } from '@/hooks/useContasReceber';
import ValueEditDialog from './ValueEditDialog';

// Generate month options (current + next 11 months)
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    });
  }
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
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProductSlug, setSelectedProductSlug] = useState('');
  const [newValor, setNewValor] = useState('');
  const [newIsRecurring, setNewIsRecurring] = useState(true);

  // Value edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContaReceberEntry | null>(null);
  const [editingClientName, setEditingClientName] = useState('');

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const {
    clientGroups,
    stats,
    isLoading,
    allClients,
    getAvailableProducts,
    initializeMonth,
    updateStatus,
    updateValue,
    toggleRecurring,
    addEntry,
    deleteEntry,
    isUpdatingValue,
    isAddingEntry,
  } = useContasReceber(selectedMonth, open);

  // Initialize month when selected
  useEffect(() => {
    if (open && selectedMonth) {
      initializeMonth(selectedMonth);
    }
  }, [open, selectedMonth]);

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return clientGroups;
    const term = searchTerm.toLowerCase();
    return clientGroups.filter(
      g =>
        g.client_name.toLowerCase().includes(term) ||
        (g.razao_social && g.razao_social.toLowerCase().includes(term)) ||
        g.entries.some(e => e.product_name.toLowerCase().includes(term))
    );
  }, [clientGroups, searchTerm]);

  const toggleCollapse = (clientId: string) => {
    setCollapsedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const openEditDialog = (entry: ContaReceberEntry, clientName: string) => {
    setEditingEntry(entry);
    setEditingClientName(clientName);
    setEditDialogOpen(true);
  };

  const handleValueEditConfirm = (params: {
    newValue: number;
    scope: 'single_month' | 'all_following';
    justification: string;
  }) => {
    if (!editingEntry) return;
    updateValue({
      id: editingEntry.id,
      clientId: editingEntry.client_id,
      productSlug: editingEntry.produto_slug,
      originalValue: editingEntry.valor,
      newValue: params.newValue,
      scope: params.scope,
      justification: params.justification,
      mesReferencia: editingEntry.mes_referencia,
    });
    setEditDialogOpen(false);
    setEditingEntry(null);
  };

  const handleAddNew = () => {
    if (!selectedClientId || !selectedProductSlug) return;
    const valor = parseFloat(newValor.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) return;

    const product = getAvailableProducts(selectedClientId).find(p => p.slug === selectedProductSlug);
    addEntry({
      clientId: selectedClientId,
      productSlug: selectedProductSlug,
      productName: product?.name || getProductDisplayName(selectedProductSlug),
      valor,
      isRecurring: newIsRecurring,
    });
    setIsAddingNew(false);
    setSelectedClientId('');
    setSelectedProductSlug('');
    setNewValor('');
    setNewIsRecurring(true);
  };

  // Available products for selected client in add form
  const availableProductsForAdd = useMemo(() => {
    if (!selectedClientId) return [];
    return getAvailableProducts(selectedClientId);
  }, [selectedClientId, getAvailableProducts]);

  // Auto-fill value when product is selected
  useEffect(() => {
    if (selectedProductSlug && availableProductsForAdd.length > 0) {
      const product = availableProductsForAdd.find(p => p.slug === selectedProductSlug);
      if (product && product.value > 0) {
        setNewValor(product.value.toFixed(2).replace('.', ','));
      }
    }
  }, [selectedProductSlug, availableProductsForAdd]);

  // Clients that have products available to add
  const clientsWithAvailableProducts = useMemo(() => {
    return allClients.filter(c => getAvailableProducts(c.id).length > 0);
  }, [allClients, getAvailableProducts]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'em_dia': return 'bg-green-500 text-white hover:bg-green-600';
      case 'pago': return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'pendente': return 'bg-amber-400 text-amber-900 hover:bg-amber-500';
      case 'inadimplente': return 'bg-red-500 text-white hover:bg-red-600';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_dia': return 'Em Dia';
      case 'pago': return 'Pago';
      case 'pendente': return 'Pendente';
      case 'inadimplente': return 'Inadimplente';
      default: return status;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Receipt className="text-green-600 dark:text-green-400" size={22} />
                </div>
                <div>
                  <DialogTitle className="text-xl">Contas a Receber</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Faturamento mensal por cliente e produto
                  </p>
                </div>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o mes" />
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
          <div className="grid grid-cols-5 gap-3 px-6 pb-4 shrink-0">
            <div className="rounded-xl bg-muted/50 p-3 border border-border">
              <p className="text-xs text-muted-foreground">Total a Receber</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(stats.totalReceber)}</p>
              <p className="text-xs text-muted-foreground">{stats.uniqueClients} clientes</p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400">Pago</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(stats.totalPago)}</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400">Em Dia</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.totalEmDia)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(stats.totalPendente)}</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">Inadimplentes</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(stats.totalInadimplente)}</p>
              {stats.countInadimplente > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400">{stats.countInadimplente} entrada(s)</p>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative px-6 shrink-0">
            <Search className="absolute left-9 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Buscar cliente ou produto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Add New Entry Button */}
          <div className="px-6 py-3 shrink-0">
            {!isAddingNew ? (
              <Button
                onClick={() => setIsAddingNew(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={clientsWithAvailableProducts.length === 0}
              >
                <Plus size={16} />
                Adicionar Entrada
              </Button>
            ) : (
              <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-3">
                <div className="grid grid-cols-[1fr_1fr_120px] gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Cliente</label>
                    <Select
                      value={selectedClientId}
                      onValueChange={(v) => {
                        setSelectedClientId(v);
                        setSelectedProductSlug('');
                        setNewValor('');
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsWithAvailableProducts.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Produto</label>
                    <Select
                      value={selectedProductSlug}
                      onValueChange={setSelectedProductSlug}
                      disabled={!selectedClientId}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProductsForAdd.map(product => (
                          <SelectItem key={product.slug} value={product.slug}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Valor</label>
                    <Input
                      placeholder="0,00"
                      value={newValor}
                      onChange={(e) => setNewValor(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new-recurring"
                      checked={newIsRecurring}
                      onCheckedChange={(checked) => setNewIsRecurring(checked === true)}
                    />
                    <label htmlFor="new-recurring" className="text-xs text-muted-foreground cursor-pointer">
                      Recorrente (aparece todo mes)
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddNew} disabled={isAddingEntry || !selectedClientId || !selectedProductSlug}>
                      <Check size={14} className="mr-1" /> Adicionar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setIsAddingNew(false);
                      setSelectedClientId('');
                      setSelectedProductSlug('');
                      setNewValor('');
                    }}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <div className="h-full rounded-xl border border-border overflow-hidden flex flex-col">
              {/* Table Header */}
              <div className="shrink-0 grid grid-cols-[1fr_90px_130px_130px_70px_40px] gap-2 px-4 py-3 bg-green-600 text-white font-semibold text-sm">
                <span>Cliente / Produto</span>
                <span className="text-center">Recorrente</span>
                <span className="text-right">Valor Mensal</span>
                <span className="text-center">Status</span>
                <span className="text-center">Inadimpl.</span>
                <span></span>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                {isLoading && (
                  <div className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </div>
                )}

                {!isLoading && filteredGroups.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhuma entrada neste mes'}
                  </div>
                )}

                {filteredGroups.map((group) => {
                  const isCollapsed = collapsedClients.has(group.client_id);
                  return (
                    <div key={group.client_id}>
                      {/* Client Header */}
                      <div
                        className="grid grid-cols-[1fr_90px_130px_130px_70px_40px] gap-2 px-4 py-2.5 bg-muted/60 border-b border-border cursor-pointer hover:bg-muted/80 items-center"
                        onClick={() => toggleCollapse(group.client_id)}
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">
                              {group.client_name}
                            </p>
                            {group.razao_social && (
                              <p className="text-xs text-muted-foreground truncate">
                                {group.razao_social}
                              </p>
                            )}
                          </div>
                          {group.payment_due_day && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                              Venc. dia {group.payment_due_day}
                            </Badge>
                          )}
                        </div>
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground">
                            {group.entries.length} produto(s)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground text-sm">
                            {formatCurrency(group.total)}
                          </span>
                        </div>
                        <div></div>
                        <div></div>
                        <div></div>
                      </div>

                      {/* Product Rows */}
                      {!isCollapsed && group.entries.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className={`grid grid-cols-[1fr_90px_130px_130px_70px_40px] gap-2 px-4 py-2 border-b border-border/50 items-center group ${
                            idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                          }`}
                        >
                          {/* Product name */}
                          <div className="pl-8">
                            <Badge
                              variant="secondary"
                              className="text-xs capitalize max-w-[200px] truncate"
                            >
                              {entry.product_name}
                            </Badge>
                          </div>

                          {/* Recurring toggle */}
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleRecurring({ id: entry.id, isRecurring: !entry.is_recurring })}
                              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                                entry.is_recurring
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                              title={entry.is_recurring ? 'Recorrente' : 'Avulso'}
                            >
                              <RefreshCw size={10} />
                              {entry.is_recurring ? 'Sim' : 'Nao'}
                            </button>
                          </div>

                          {/* Value with edit */}
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-semibold text-foreground text-sm">
                              {formatCurrency(entry.valor)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                              onClick={() => openEditDialog(entry, group.client_name)}
                            >
                              <Pencil size={12} />
                            </Button>
                          </div>

                          {/* Status */}
                          <div className="flex justify-center">
                            <Select
                              value={entry.status}
                              onValueChange={(value) =>
                                updateStatus({ id: entry.id, status: value })
                              }
                            >
                              <SelectTrigger
                                className={`w-[120px] h-7 text-xs font-semibold border-0 ${getStatusStyle(entry.status)}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="em_dia">
                                  <div className="flex items-center gap-2">
                                    <Check size={14} className="text-green-600" />
                                    Em Dia
                                  </div>
                                </SelectItem>
                                <SelectItem value="pago">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-blue-600" />
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

                          {/* Inadimplencia badge */}
                          <div className="flex justify-center">
                            {entry.inadimplencia_count > 0 ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                {entry.inadimplencia_count}+
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>

                          {/* Delete */}
                          <div className="flex justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                              onClick={() => {
                                if (confirm('Remover esta entrada deste mes?')) {
                                  deleteEntry(entry.id);
                                }
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Value Edit Dialog */}
      {editingEntry && (
        <ValueEditDialog
          open={editDialogOpen}
          onOpenChange={(isOpen) => {
            setEditDialogOpen(isOpen);
            if (!isOpen) setEditingEntry(null);
          }}
          currentValue={editingEntry.valor}
          productName={editingEntry.product_name}
          clientName={editingClientName}
          onConfirm={handleValueEditConfirm}
          isPending={isUpdatingValue}
        />
      )}
    </>
  );
}
