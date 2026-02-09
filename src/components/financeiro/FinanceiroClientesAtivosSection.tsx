import { useState } from 'react';
import { useFinanceiroActiveClients, FinanceiroActiveClient } from '@/hooks/useFinanceiroActiveClients';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle, Users, DollarSign, AlertCircle, Pencil, Check, X, TrendingDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import ProductValuesBreakdown from '@/components/shared/ProductValuesBreakdown';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

interface ClientCardProps {
  client: FinanceiroActiveClient;
  onToggleStatus: (clientId: string, newStatus: 'em_dia' | 'atrasada') => void;
  onUpdateValue: (clientId: string, newValue: number) => void;
  isUpdating: boolean;
}

function ClientCard({ client, onToggleStatus, onUpdateValue, isUpdating }: ClientCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(client.monthly_value));
  
  const displayName = client.client?.razao_social || client.client?.name || 'Cliente';
  const isOverdue = client.invoice_status === 'atrasada';

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
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm text-foreground line-clamp-2">
                  {displayName}
                </h4>
                <ClientLabelBadge label={client.client?.client_label as ClientLabel} size="sm" />
              </div>
              
              {/* Editable Value */}
              {isEditing ? (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-20 h-6 text-xs px-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveValue();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={handleSaveValue}
                  >
                    <Check size={12} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={handleCancelEdit}
                  >
                    <X size={12} />
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 mt-1">
                  <div className="flex items-center gap-1">
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(Number(client.monthly_value))}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil size={10} />
                    </Button>
                  </div>
                  {/* Breakdown de valores por produto */}
                  <ProductValuesBreakdown clientId={client.client_id} showTotal={false} />
                </div>
              )}
            </div>
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

          <Button
            size="sm"
            variant={isOverdue ? "default" : "outline"}
            className={cn(
              "w-full h-7 text-xs",
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
                Marcar como Em Dia
              </>
            ) : (
              <>
                <AlertTriangle size={12} className="mr-1" />
                Marcar Fatura Atrasada
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinanceiroClientesAtivosSection() {
  const queryClient = useQueryClient();
  const { activeClients, isLoading, stats, toggleInvoiceStatus, updateMonthlyValue } = useFinanceiroActiveClients();

  const handleToggleStatus = (clientId: string, newStatus: 'em_dia' | 'atrasada') => {
    toggleInvoiceStatus.mutate({ clientId, newStatus });
  };

  const handleUpdateValue = async (clientId: string, newValue: number) => {
    // Update in financeiro_active_clients
    updateMonthlyValue.mutate({ clientId, monthlyValue: newValue });
    
    // Also update expected_investment in clients table (syncs with ClientListPage and Contas a Receber)
    const { error } = await supabase
      .from('clients')
      .update({ expected_investment: newValue })
      .eq('id', clientId);
    
    if (error) {
      toast.error('Erro ao atualizar valor na lista de clientes');
    } else {
      // Invalidate all related queries for full sync
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber'] });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    );
  }

  // Separate overdue from on-time clients
  const overdueClients = activeClients.filter(c => c.invoice_status === 'atrasada');
  const onTimeClients = activeClients.filter(c => c.invoice_status === 'em_dia');

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-2">
        {/* Stats Cards */}
        <div className="space-y-2">
          {/* Total de Clientes */}
          <Card className="border-subtle bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Users size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Clientes</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {stats.totalClients}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Churns do Mês */}
          <Card className={cn(
            "border-subtle",
            stats.monthlyChurnValue > 0 
              ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" 
              : "bg-muted/30"
          )}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  stats.monthlyChurnValue > 0 
                    ? "bg-orange-100 dark:bg-orange-900/50" 
                    : "bg-muted"
                )}>
                  <TrendingDown size={16} className={cn(
                    stats.monthlyChurnValue > 0 
                      ? "text-orange-600 dark:text-orange-400" 
                      : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Churns do Mês ({stats.monthlyChurnCount})
                  </p>
                  <p className={cn(
                    "text-lg font-bold",
                    stats.monthlyChurnValue > 0 
                      ? "text-orange-600 dark:text-orange-400" 
                      : "text-muted-foreground"
                  )}>
                    {formatCurrency(stats.monthlyChurnValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total a Receber */}
          <Card className="border-subtle bg-emerald-50 dark:bg-emerald-950/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                  <DollarSign size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total a Receber</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(stats.totalToReceive)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total em Inadimplência */}
          <Card className={cn(
            "border-subtle",
            stats.totalOverdue > 0 
              ? "bg-destructive/10 border-destructive/30" 
              : "bg-muted/30"
          )}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  stats.totalOverdue > 0 
                    ? "bg-destructive/20" 
                    : "bg-muted"
                )}>
                  <AlertCircle size={16} className={cn(
                    stats.totalOverdue > 0 
                      ? "text-destructive" 
                      : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Inadimplentes ({stats.overdueCount})
                  </p>
                  <p className={cn(
                    "text-lg font-bold",
                    stats.totalOverdue > 0 
                      ? "text-destructive" 
                      : "text-muted-foreground"
                  )}>
                    {formatCurrency(stats.totalOverdue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        <div className="space-y-4">
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
                  <ClientCard
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
                  <ClientCard
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
          {activeClients.length === 0 && (
            <div className="py-8 text-center">
              <Users size={32} className="mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum cliente ativo ainda
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes aparecem aqui após assinarem o contrato
              </p>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
