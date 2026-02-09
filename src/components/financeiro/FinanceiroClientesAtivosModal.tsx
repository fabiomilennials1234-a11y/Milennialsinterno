import { useState, useMemo } from 'react';
import { useFinanceiroActiveClients, FinanceiroActiveClient } from '@/hooks/useFinanceiroActiveClients';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Users, DollarSign, AlertCircle, Pencil, Check, X, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Generate last 12 months options
function generateMonthOptions() {
  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = format(date, 'yyyy-MM');
    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  
  return options;
}

interface ClientRowProps {
  client: FinanceiroActiveClient;
  onToggleStatus: (clientId: string, newStatus: 'em_dia' | 'atrasada') => void;
  onUpdateValue: (clientId: string, newValue: number) => void;
  isUpdating: boolean;
}

function ClientRow({ client, onToggleStatus, onUpdateValue, isUpdating }: ClientRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(client.monthly_value));
  
  const displayName = client.client?.razao_social || client.client?.name || 'Cliente';
  const isOverdue = client.invoice_status === 'atrasada';
  
  // Calculate days until contract expires
  const contractExpiresAt = client.contract_expires_at ? parseISO(client.contract_expires_at) : null;
  const daysUntilExpiration = contractExpiresAt 
    ? Math.ceil((contractExpiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isContractExpiring = daysUntilExpiration !== null && daysUntilExpiration <= 30 && daysUntilExpiration >= 0;
  const isContractExpired = daysUntilExpiration !== null && daysUntilExpiration < 0;

  const handleSaveValue = () => {
    const numericValue = parseFloat(editValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numericValue) && numericValue >= 0) {
      onUpdateValue(client.client_id, numericValue);
      setIsEditing(false);
    } else {
      toast.error('Valor inválido');
    }
  };

  const handleCancelEdit = () => {
    setEditValue(String(client.monthly_value));
    setIsEditing(false);
  };

  const handleToggle = () => {
    const newStatus = isOverdue ? 'em_dia' : 'atrasada';
    onToggleStatus(client.client_id, newStatus);
  };

  return (
    <Card 
      className={cn(
        "border-subtle hover:shadow-apple-hover transition-shadow",
        isOverdue && "border-destructive/50 bg-destructive/5"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Client Name & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm text-foreground truncate">
                {displayName}
              </h4>
              {isOverdue ? (
                <Badge variant="destructive" className="shrink-0 text-xs">
                  <AlertTriangle size={10} className="mr-1" />
                  Atrasada
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 text-xs bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                  <CheckCircle size={10} className="mr-1" />
                  Em dia
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Ativo desde {format(parseISO(client.activated_at), "dd/MM/yyyy", { locale: ptBR })}</span>
              {contractExpiresAt && (
                <span className={cn(
                  "flex items-center gap-1",
                  isContractExpired && "text-destructive font-medium",
                  isContractExpiring && !isContractExpired && "text-warning font-medium"
                )}>
                  <Calendar size={10} />
                  {isContractExpired 
                    ? `Expirado há ${Math.abs(daysUntilExpiration!)}d`
                    : `Expira em ${daysUntilExpiration}d`
                  }
                </span>
              )}
            </div>
          </div>

          {/* Value Editor */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-28 h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveValue();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={handleSaveValue}
                >
                  <Check size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={handleCancelEdit}
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(Number(client.monthly_value))}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil size={12} />
                </Button>
              </div>
            )}
          </div>

          {/* Toggle Status Button */}
          <Button
            size="sm"
            variant={isOverdue ? "default" : "outline"}
            className={cn(
              "h-8 text-xs shrink-0",
              isOverdue 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                : "text-destructive border-destructive/30 hover:bg-destructive/10"
            )}
            onClick={handleToggle}
            disabled={isUpdating}
          >
            {isOverdue ? (
              <>
                <CheckCircle size={12} className="mr-1" />
                Em Dia
              </>
            ) : (
              <>
                <AlertTriangle size={12} className="mr-1" />
                Atrasada
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface FinanceiroClientesAtivosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FinanceiroClientesAtivosModal({ open, onOpenChange }: FinanceiroClientesAtivosModalProps) {
  const queryClient = useQueryClient();
  const { activeClients, isLoading, toggleInvoiceStatus, updateMonthlyValue } = useFinanceiroActiveClients();
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Filter clients by selected month (based on activated_at)
  const filteredClients = useMemo(() => {
    if (selectedMonth === 'all') return activeClients;
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    
    return activeClients.filter(client => {
      const activatedAt = parseISO(client.activated_at);
      // Show clients that were active during this month (activated before or during the month)
      return activatedAt <= monthEnd;
    });
  }, [activeClients, selectedMonth]);

  // Calculate stats for filtered clients
  const stats = useMemo(() => ({
    totalClients: filteredClients.length,
    totalToReceive: filteredClients.reduce((sum, client) => sum + Number(client.monthly_value), 0),
    totalOverdue: filteredClients
      .filter(client => client.invoice_status === 'atrasada')
      .reduce((sum, client) => sum + Number(client.monthly_value), 0),
    overdueCount: filteredClients.filter(client => client.invoice_status === 'atrasada').length,
  }), [filteredClients]);

  const handleToggleStatus = (clientId: string, newStatus: 'em_dia' | 'atrasada') => {
    toggleInvoiceStatus.mutate({ clientId, newStatus });
  };

  const handleUpdateValue = async (clientId: string, newValue: number) => {
    // Update in financeiro_active_clients
    updateMonthlyValue.mutate({ clientId, monthlyValue: newValue });
    
    // Also update expected_investment in clients table
    const { error } = await supabase
      .from('clients')
      .update({ expected_investment: newValue })
      .eq('id', clientId);
    
    if (error) {
      toast.error('Erro ao atualizar valor na lista de clientes');
    } else {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  };

  // Separate overdue from on-time clients
  const overdueClients = filteredClients.filter(c => c.invoice_status === 'atrasada');
  const onTimeClients = filteredClients.filter(c => c.invoice_status === 'em_dia');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Users size={20} className="text-primary" />
              Clientes Ativos
            </DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Month Filter */}
            <div className="flex items-center gap-3 py-2">
              <Calendar size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtrar por mês:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[220px] h-9">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3 py-4 border-b border-subtle">
              {/* Total de Clientes */}
              <Card className="border-subtle bg-blue-50 dark:bg-blue-950/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <Users size={14} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {stats.totalClients}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total a Receber */}
              <Card className="border-subtle bg-emerald-50 dark:bg-emerald-950/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                      <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(stats.totalToReceive)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inadimplentes */}
              <Card className={cn(
                "border-subtle",
                stats.totalOverdue > 0 
                  ? "bg-destructive/10 border-destructive/30" 
                  : "bg-muted/30"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-2 rounded-lg",
                      stats.totalOverdue > 0 ? "bg-destructive/20" : "bg-muted"
                    )}>
                      <AlertCircle size={14} className={cn(
                        stats.totalOverdue > 0 ? "text-destructive" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Inadimplentes ({stats.overdueCount})
                      </p>
                      <p className={cn(
                        "text-lg font-bold",
                        stats.totalOverdue > 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {formatCurrency(stats.totalOverdue)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Client List */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {/* Overdue clients first */}
                {overdueClients.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <AlertTriangle size={14} className="text-destructive" />
                      <h3 className="text-sm font-semibold text-destructive">
                        Faturas Atrasadas ({overdueClients.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {overdueClients.map((client) => (
                        <ClientRow
                          key={client.id}
                          client={client}
                          onToggleStatus={handleToggleStatus}
                          onUpdateValue={handleUpdateValue}
                          isUpdating={toggleInvoiceStatus.isPending || updateMonthlyValue.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* On-time clients */}
                {onTimeClients.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <CheckCircle size={14} className="text-emerald-600" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Em Dia ({onTimeClients.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {onTimeClients.map((client) => (
                        <ClientRow
                          key={client.id}
                          client={client}
                          onToggleStatus={handleToggleStatus}
                          onUpdateValue={handleUpdateValue}
                          isUpdating={toggleInvoiceStatus.isPending || updateMonthlyValue.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {filteredClients.length === 0 && (
                  <div className="py-12 text-center">
                    <Users size={40} className="mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {selectedMonth === 'all' 
                        ? 'Nenhum cliente ativo ainda' 
                        : 'Nenhum cliente ativo neste período'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedMonth === 'all' 
                        ? 'Clientes aparecem aqui após assinarem o contrato'
                        : 'Tente selecionar outro mês'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
