import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useClientsWithSales, useRegisterSale, ClientWithSales } from '@/hooks/useClientList';
import { useAuth } from '@/contexts/AuthContext';
import { useFinanceiroActiveClients } from '@/hooks/useFinanceiroActiveClients';
import { useUpsells } from '@/hooks/useUpsells';
import { useProductChurn } from '@/hooks/useProductChurn';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import ProductBadges, { PRODUCT_CONFIG } from '@/components/shared/ProductBadges';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import { 
  Search, 
  Users, 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  Plus,
  Building2,
  Loader2,
  CalendarDays,
  UserX,
  AlertTriangle,
  RotateCcw,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

// Helper to generate month options
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  
  // Add "All" option
  options.push({ value: 'all', label: 'Todos os meses' });
  
  // Generate last 12 months
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    });
  }
  
  return options;
};

// Roles allowed to mark clients as churn
const CHURN_ALLOWED_ROLES = ['financeiro', 'gestor_projetos', 'sucesso_cliente', 'ceo'];

// Service-based products that show ALL clients (not filtered by contracted_products)
const SERVICE_PRODUCTS = ['atrizes', 'produtora', 'design', 'video', 'devs'];

export default function ClientListPage() {
  const { productSlug } = useParams<{ productSlug?: string }>();
  const { data: clients = [], isLoading, refetch } = useClientsWithSales();
  const { activeClients: financeiroClients } = useFinanceiroActiveClients();
  const { data: upsells = [] } = useUpsells();
  const { initiateProductChurn, productChurns } = useProductChurn(productSlug);
  const registerSale = useRegisterSale();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientWithSales | null>(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [churnModalOpen, setChurnModalOpen] = useState(false);
  const [saleValue, setSaleValue] = useState('');
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Get product values for the current product filter
  const { data: productValues = [] } = useQuery({
    queryKey: ['client-product-values', productSlug],
    queryFn: async () => {
      if (!productSlug) return [];
      const { data, error } = await supabase
        .from('client_product_values')
        .select('client_id, monthly_value')
        .eq('product_slug', productSlug);
      if (error) throw error;
      return data || [];
    },
    enabled: !!productSlug,
  });

  // Map of client_id -> product monthly value
  const productValueMap = useMemo(() => {
    const map: Record<string, number> = {};
    productValues.forEach((pv: any) => {
      map[pv.client_id] = pv.monthly_value;
    });
    return map;
  }, [productValues]);

  // Get product display name
  const productDisplayName = useMemo(() => {
    if (!productSlug) return 'Todos os Produtos';
    const config = PRODUCT_CONFIG[productSlug];
    return config?.name || productSlug;
  }, [productSlug]);

  // Get unique products from all clients
  const availableProducts = useMemo(() => {
    const products = new Set<string>();
    clients.forEach(client => {
      client.contracted_products?.forEach(p => products.add(p));
    });
    return Array.from(products).sort();
  }, [clients]);
  
  // Check if current user can mark clients as churn
  const canMarkAsChurn = user?.role && CHURN_ALLOWED_ROLES.includes(user.role);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Create a map of client monthly values from financeiro_active_clients
  const clientMonthlyValueMap = useMemo(() => {
    const map: Record<string, number> = {};
    financeiroClients.forEach(fc => {
      map[fc.client_id] = fc.monthly_value;
    });
    return map;
  }, [financeiroClients]);

  // Check if viewing a service-based product (shows ALL clients)
  const isServiceProduct = productSlug && SERVICE_PRODUCTS.includes(productSlug);

  // Get IDs of clients that have an active churn for this product
  const churnedClientIds = useMemo(() => {
    return new Set(productChurns.map(c => c.client_id));
  }, [productChurns]);

  // Separate clients into active and churned, filtered by product
  const { activeClients, churnedClients } = useMemo(() => {
    const active: ClientWithSales[] = [];
    const churned: ClientWithSales[] = [];
    
    clients.forEach(client => {
      // If filtering by product, check if client has that product
      if (productSlug && !isServiceProduct) {
        const hasProduct = client.contracted_products?.includes(productSlug);
        if (!hasProduct) return; // Skip clients without this product
      }

      // Check if client has an active churn for THIS product
      const hasProductChurn = churnedClientIds.has(client.id);
      
      // Global churn (legacy) - only if no productSlug filter
      const isGloballyChurned = !productSlug && (
        !!client.distrato_step || 
        client.archived || 
        client.status === 'churned'
      );
      
      if (hasProductChurn || isGloballyChurned) {
        churned.push(client);
      } else {
        active.push(client);
      }
    });
    
    return { activeClients: active, churnedClients: churned };
  }, [clients, productSlug, churnedClientIds, isServiceProduct]);

  // Filter clients by search, month, and products
  const filterClients = (clientList: ClientWithSales[]) => {
    return clientList.filter(client => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        client.name.toLowerCase().includes(query) ||
        client.razao_social?.toLowerCase().includes(query) ||
        client.cnpj?.includes(query) ||
        client.cpf?.includes(query)
      );

      // Month filter based on entry_date
      let matchesMonth = true;
      if (selectedMonth !== 'all') {
        const entryDateStr = client.entry_date || client.created_at;
        const entryDate = new Date(entryDateStr);
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        matchesMonth = entryDate >= monthStart && entryDate <= monthEnd;
      }

      // Product filter
      let matchesProducts = true;
      if (selectedProducts.length > 0) {
        const clientProducts = client.contracted_products || [];
        matchesProducts = selectedProducts.some(p => clientProducts.includes(p));
      }

      return matchesSearch && matchesMonth && matchesProducts;
    });
  };

  const filteredActiveClients = filterClients(activeClients);
  const filteredChurnedClients = filterClients(churnedClients);

  // Calculate entry and churn values for current month
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Entry value from NEW clients: sum of monthly value for clients that entered this month
    let newClientValue = 0;
    let newClientCount = 0;
    activeClients.forEach(client => {
      const entryDate = client.entry_date ? parseISO(client.entry_date) : parseISO(client.created_at);
      if (entryDate >= monthStart && entryDate <= monthEnd) {
        const monthlyValue = clientMonthlyValueMap[client.id] || 0;
        newClientValue += monthlyValue;
        newClientCount++;
      }
    });

    // Upsell value: sum of monthly value for upsells created this month
    let upsellValue = 0;
    let upsellCount = 0;
    upsells.forEach(upsell => {
      const upsellDate = new Date(upsell.created_at);
      if (isSameMonth(upsellDate, now)) {
        upsellValue += Number(upsell.monthly_value);
        upsellCount++;
      }
    });

    // Total entry = new clients + upsells
    const entryValue = newClientValue + upsellValue;
    const entryCount = newClientCount + upsellCount;

    // Churn value: sum of expected_investment for clients that churned this month
    let churnValue = 0;
    let churnCount = 0;
    churnedClients.forEach(client => {
      const distratoDate = client.distrato_entered_at ? parseISO(client.distrato_entered_at) : null;
      if (distratoDate && distratoDate >= monthStart && distratoDate <= monthEnd) {
        const monthlyValue = clientMonthlyValueMap[client.id] || 0;
        churnValue += monthlyValue;
        churnCount++;
      }
    });

    return { 
      entryValue, 
      entryCount, 
      newClientValue, 
      newClientCount, 
      upsellValue, 
      upsellCount, 
      churnValue, 
      churnCount 
    };
  }, [activeClients, churnedClients, clientMonthlyValueMap, upsells]);

  // Stats (only from active clients)
  const totalClients = activeClients.length;
  const totalChurned = churnedClients.length;
  const totalSales = activeClients.reduce((sum, c) => sum + c.total_sales, 0);
  const totalCommissions = activeClients.reduce((sum, c) => sum + c.total_commission, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleOpenSaleModal = (client: ClientWithSales) => {
    setSelectedClient(client);
    setSaleValue('');
    setSaleDate(format(new Date(), 'yyyy-MM-dd'));
    setSaleModalOpen(true);
  };

  const handleOpenChurnModal = (client: ClientWithSales) => {
    setSelectedClient(client);
    setChurnModalOpen(true);
  };

  const handleRegisterSale = async () => {
    if (!selectedClient || !saleValue) return;

    const value = parseFloat(saleValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      return;
    }

    await registerSale.mutateAsync({
      clientId: selectedClient.id,
      saleValue: value,
      saleDate: saleDate,
    });

    setSaleModalOpen(false);
    setSelectedClient(null);
  };

  const handleMarkAsChurn = async () => {
    if (!selectedClient) return;
    
    // If we have a productSlug, use product-specific churn
    if (productSlug) {
      setIsUpdatingStatus(true);
      try {
        // Check if client has a signed and valid contract
        const { data: activeClient } = await supabase
          .from('financeiro_active_clients')
          .select('contract_expires_at')
          .eq('client_id', selectedClient.id)
          .single();

        let hasValidContract = false;
        if (activeClient?.contract_expires_at) {
          const expiresAt = new Date(activeClient.contract_expires_at);
          hasValidContract = expiresAt > new Date();
        }

        // Get the monthly value for this product
        const monthlyValue = productValueMap[selectedClient.id] || 0;
        
        // Use product-specific churn
        await initiateProductChurn.mutateAsync({
          clientId: selectedClient.id,
          productSlug: productSlug,
          productName: productDisplayName,
          monthlyValue: monthlyValue,
          hasValidContract: hasValidContract,
        });

        setChurnModalOpen(false);
        setSelectedClient(null);
      } catch (error: any) {
        toast.error('Erro ao marcar como churn', {
          description: error.message,
        });
      } finally {
        setIsUpdatingStatus(false);
      }
      return;
    }

    // Legacy: global churn (when no productSlug)
    setIsUpdatingStatus(true);
    try {
      // Check if client has a signed and valid contract
      // A client has a valid contract if they are in financeiro_active_clients 
      // with a non-expired contract_expires_at date
      const { data: activeClient } = await supabase
        .from('financeiro_active_clients')
        .select('contract_expires_at')
        .eq('client_id', selectedClient.id)
        .single();

      // Determine if contract is valid (signed and not expired)
      let hasValidContract = false;
      if (activeClient?.contract_expires_at) {
        const expiresAt = new Date(activeClient.contract_expires_at);
        hasValidContract = expiresAt > new Date();
      }

      // Determine which distrato step to use based on contract status:
      // - COM contrato válido -> churn_solicitado (fluxo de 4 etapas)
      // - SEM contrato ou expirado -> sem_contrato_solicitado (fluxo de 2 etapas)
      const distratoStep = hasValidContract ? 'churn_solicitado' : 'sem_contrato_solicitado';

      // Remove from active clients if exists
      await supabase
        .from('financeiro_active_clients')
        .delete()
        .eq('client_id', selectedClient.id);

      // Update client with status and distrato_step
      const { error } = await supabase
        .from('clients')
        .update({ 
          status: 'churned',
          distrato_step: distratoStep,
          distrato_entered_at: new Date().toISOString(),
        })
        .eq('id', selectedClient.id);

      if (error) throw error;

      // Create churn notification
      await supabase
        .from('churn_notifications')
        .insert({
          client_id: selectedClient.id,
          client_name: selectedClient.name,
        } as any);

      const workflowMessage = hasValidContract 
        ? 'Cliente movido para Churn com Contrato (4 etapas)'
        : 'Cliente movido para Churn sem Contrato (2 etapas)';

      toast.success('Cliente marcado como churn', {
        description: workflowMessage,
      });

      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['churn-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      setChurnModalOpen(false);
      setSelectedClient(null);
    } catch (error: any) {
      toast.error('Erro ao marcar como churn', {
        description: error.message,
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRestoreClient = async (client: ClientWithSales) => {
    setIsUpdatingStatus(true);
    try {
      let newStatus = 'new_client';
      if (client.campaign_published_at) {
        newStatus = 'campaign_published';
      } else if (client.onboarding_started_at) {
        newStatus = 'onboarding';
      }

      const { error } = await supabase
        .from('clients')
        .update({ 
          status: newStatus,
          archived: false,
          archived_at: null,
          distrato_step: null,
          distrato_entered_at: null,
        } as any)
        .eq('id', client.id);

      if (error) throw error;

      const statusLabels: Record<string, string> = {
        'new_client': 'Novo Cliente',
        'onboarding': 'Onboarding',
        'campaign_published': 'Campanha Publicada'
      };

      toast.success('Cliente restaurado', {
        description: `${client.name} foi restaurado para "${statusLabels[newStatus]}".`,
      });

      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
    } catch (error: any) {
      toast.error('Erro ao restaurar cliente', {
        description: error.message,
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,.-]/g, '');
    setSaleValue(value);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const renderClientTable = (clientList: ClientWithSales[], isChurnList = false) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="font-semibold">Cliente</TableHead>
          <TableHead className="font-semibold">Data de Entrada</TableHead>
          <TableHead className="font-semibold text-right">Valor Mensal</TableHead>
          <TableHead className="font-semibold text-center">% Comissão</TableHead>
          <TableHead className="font-semibold text-right">Vendas Acumuladas</TableHead>
          <TableHead className="font-semibold text-right">Comissão Gerada</TableHead>
          <TableHead className="font-semibold text-center">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery 
                  ? 'Nenhum cliente encontrado com essa busca.' 
                  : isChurnList 
                    ? 'Nenhum cliente em churn.' 
                    : 'Nenhum cliente cadastrado ainda.'}
              </p>
            </TableCell>
          </TableRow>
        ) : (
          clientList.map((client) => (
            <TableRow key={client.id} className="hover:bg-muted/30">
              <TableCell>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{client.name}</p>
                    <ClientLabelBadge label={(client as any).client_label as ClientLabel} size="sm" />
                    {isChurnList && client.archived && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        Arquivado
                      </span>
                    )}
                    {isChurnList && !client.archived && client.status === 'churned' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive">
                        Churn
                      </span>
                    )}
                  </div>
                  <ProductBadges products={(client as any).contracted_products} size="sm" maxVisible={4} />
                  {client.razao_social && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {client.razao_social}
                    </p>
                  )}
                  {client.ads_manager_name && (
                    <p className="text-xs text-primary mt-0.5">
                      Gestor: {client.ads_manager_name}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {client.entry_date 
                    ? format(parseISO(client.entry_date), "dd/MM/yyyy")
                    : format(parseISO(client.created_at), "dd/MM/yyyy")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(clientMonthlyValueMap[client.id] || 0)}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                  client.sales_percentage > 0 
                    ? "bg-primary/10 text-primary" 
                    : "bg-destructive/10 text-destructive"
                )}>
                  {client.sales_percentage}%
                  {client.sales_percentage === 0 && (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={cn(
                  "font-semibold",
                  client.total_sales > 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {formatCurrency(client.total_sales)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={cn(
                  "font-semibold",
                  client.total_commission > 0 ? "text-warning" : "text-muted-foreground"
                )}>
                  {formatCurrency(client.total_commission)}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  {isChurnList ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestoreClient(client)}
                      disabled={isUpdatingStatus}
                      className="gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenSaleModal(client)}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Venda
                      </Button>
                      {canMarkAsChurn && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenChurnModal(client)}
                          className="gap-1"
                        >
                          <UserX className="w-3 h-3" />
                          Churn
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <MainLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-card/30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                {productSlug ? `Clientes - ${productDisplayName}` : 'Lista de Clientes'}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {productSlug 
                  ? `Gestão de clientes do produto ${productDisplayName}` 
                  : 'Gestão centralizada de clientes e vendas'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Tempo real
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Cards - First Row: Entry and Churn for month */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <ArrowUpCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Entrada no Mês</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(currentMonthStats.entryValue)}</p>
                </div>
              </div>
              {/* Breakdown: New Clients vs Upsells */}
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Users className="w-3 h-3" />
                    Novos Clientes ({currentMonthStats.newClientCount})
                  </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(currentMonthStats.newClientValue)}
                  </span>
                </div>
                {currentMonthStats.upsellCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="w-3 h-3" />
                      UP Sells ({currentMonthStats.upsellCount})
                    </span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(currentMonthStats.upsellValue)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-orange-200 dark:border-orange-800 rounded-xl p-4 flex items-center gap-4 bg-orange-50 dark:bg-orange-900/20">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <ArrowDownCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400">Churn no Mês</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(currentMonthStats.churnValue)}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">{currentMonthStats.churnCount} clientes</p>
              </div>
            </div>
          </div>

          {/* Stats Cards - Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold text-foreground">{totalClients}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <UserX className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Churns</p>
                <p className="text-2xl font-bold text-foreground">{totalChurned}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendas Acumuladas</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSales)}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissões Geradas</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCommissions)}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, razão social ou CNPJ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Filtrar por mês" />
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

            {/* Product Filter */}
            {availableProducts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Filter className="w-4 h-4" />
                  <span>Produtos:</span>
                </div>
                {availableProducts.map(slug => {
                  const config = PRODUCT_CONFIG[slug];
                  const isSelected = selectedProducts.includes(slug);
                  return (
                    <button
                      key={slug}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedProducts(prev => prev.filter(p => p !== slug));
                        } else {
                          setSelectedProducts(prev => [...prev, slug]);
                        }
                      }}
                      className={cn(
                        'inline-flex items-center rounded-full border font-medium px-2.5 py-1 text-xs transition-all',
                        isSelected 
                          ? config?.color || 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                      )}
                    >
                      {config?.name || slug}
                    </button>
                  );
                })}
                {selectedProducts.length > 0 && (
                  <button
                    onClick={() => setSelectedProducts([])}
                    className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tabs for Active and Churned */}
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active" className="gap-2">
                <Users className="w-4 h-4" />
                Ativos ({filteredActiveClients.length})
              </TabsTrigger>
              <TabsTrigger value="churned" className="gap-2">
                <UserX className="w-4 h-4" />
                Churns ({filteredChurnedClients.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {renderClientTable(filteredActiveClients, false)}
              </div>
            </TabsContent>

            <TabsContent value="churned" className="mt-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {renderClientTable(filteredChurnedClients, true)}
              </div>
            </TabsContent>
          </Tabs>

          {/* Info about commission */}
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Sobre as Comissões</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As comissões são calculadas automaticamente ao registrar uma venda. 
                  O valor total da comissão (baseado na % do cliente) é dividido igualmente entre: 
                  <strong> Gestor de Ads</strong>, <strong>Sucesso do Cliente</strong> e <strong>Consultor Comercial</strong>.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clientes com <span className="text-destructive font-semibold">0% de comissão</span> não geram comissões. 
                  Configure a porcentagem no cadastro do cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sale Registration Modal */}
      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Venda</DialogTitle>
            <DialogDescription>
              Registre uma nova venda para <strong>{selectedClient?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor da Venda</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  R$
                </span>
                <Input
                  placeholder="0,00"
                  value={saleValue}
                  onChange={handleSaleValueChange}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data da Venda</Label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>

            {selectedClient && selectedClient.sales_percentage > 0 && saleValue && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Prévia da comissão:</p>
                <p className="text-sm font-medium text-foreground">
                  {formatCurrency(
                    parseFloat(saleValue.replace(',', '.') || '0') * (selectedClient.sales_percentage / 100)
                  )}
                  <span className="text-muted-foreground font-normal"> ({selectedClient.sales_percentage}%)</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Será dividida entre: Gestor de Ads, Sucesso do Cliente e Consultor Comercial
                </p>
              </div>
            )}

            {selectedClient && selectedClient.sales_percentage === 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Este cliente não tem % de comissão configurada
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  A venda será registrada, mas nenhuma comissão será gerada.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegisterSale}
              disabled={!saleValue || registerSale.isPending}
            >
              {registerSale.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar Venda'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Churn Confirmation Modal */}
      <Dialog open={churnModalOpen} onOpenChange={setChurnModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserX className="w-5 h-5" />
              Marcar como Churn
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja marcar <strong>{selectedClient?.name}</strong> como churn?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-foreground">
                O cliente será movido para o fluxo de distrato no Financeiro. 
                O sistema determinará automaticamente se o cliente irá para:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li><strong>Churn com Contrato</strong> (4 etapas) - se houver contrato válido</li>
                <li><strong>Churn sem Contrato</strong> (2 etapas) - se não houver contrato ou estiver expirado</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChurnModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleMarkAsChurn}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Confirmar Churn
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
