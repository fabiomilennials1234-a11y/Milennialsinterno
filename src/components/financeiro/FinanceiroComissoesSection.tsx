import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  Building2,
  Sparkles,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Coins
} from 'lucide-react';
import { 
  useAllCommissions, 
  useMarkUpsellCommissionPaid, 
  getRoleLabel,
  type Commission 
} from '@/hooks/useAllCommissions';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientCommissionGroup {
  client_id: string;
  client_name: string;
  total: number;
  pending: number;
  commissions: Commission[];
}

export function FinanceiroComissoesSection() {
  const { data, isLoading } = useAllCommissions();
  const markPaid = useMarkUpsellCommissionPaid();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const currentMonth = new Date();

  // Filter to current month and group by client
  const clientGroups: ClientCommissionGroup[] = [];
  const clientMap: Record<string, ClientCommissionGroup> = {};

  if (data) {
    data.groups.forEach(userGroup => {
      userGroup.commissions.forEach(commission => {
        // Filter to current month
        if (!isSameMonth(new Date(commission.created_at), currentMonth)) return;

        const clientId = commission.type === 'upsell' 
          ? (commission as any).upsell?.client_id 
          : (commission as any).client_id;
        const clientName = commission.type === 'upsell'
          ? (commission as any).upsell?.client?.name || 'Cliente'
          : (commission as any).client?.name || 'Cliente';

        if (!clientId) return;

        if (!clientMap[clientId]) {
          clientMap[clientId] = {
            client_id: clientId,
            client_name: clientName,
            total: 0,
            pending: 0,
            commissions: [],
          };
        }

        clientMap[clientId].total += Number(commission.commission_value);
        if (commission.status === 'pending') {
          clientMap[clientId].pending += Number(commission.commission_value);
        }
        clientMap[clientId].commissions.push(commission);
      });
    });

    Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .forEach(group => clientGroups.push(group));
  }

  // Calculate totals for current month
  const currentMonthTotals = {
    total: clientGroups.reduce((sum, g) => sum + g.total, 0),
    pending: clientGroups.reduce((sum, g) => sum + g.pending, 0),
    paid: clientGroups.reduce((sum, g) => sum + (g.total - g.pending), 0),
  };

  // Filter user groups to current month only
  const currentMonthUserGroups = data?.groups.map(group => {
    const filteredCommissions = group.commissions.filter(c => 
      isSameMonth(new Date(c.created_at), currentMonth)
    );
    const total = filteredCommissions.reduce((sum, c) => sum + Number(c.commission_value), 0);
    const pending = filteredCommissions.filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.commission_value), 0);
    return { ...group, commissions: filteredCommissions, total, pending };
  }).filter(g => g.commissions.length > 0) || [];

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const getCommissionTypeBadge = (commission: Commission) => {
    if (commission.type === 'upsell') {
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-[10px] px-1.5">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
          UP Sell
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] px-1.5">
        <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
        Venda
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8 text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">A Pagar</span>
          </div>
          <p className="text-lg font-bold">
            R$ {currentMonthTotals.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Pago</span>
          </div>
          <p className="text-lg font-bold">
            R$ {currentMonthTotals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clients" className="text-xs">
            <Building2 className="h-3 w-3 mr-1" />
            Por Cliente
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            Por Colaborador
          </TabsTrigger>
        </TabsList>

        {/* By Client View */}
        <TabsContent value="clients" className="mt-3">
          <ScrollArea className="h-[400px]">
            {clientGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Coins className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma comissão este mês</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {clientGroups.map((clientGroup) => {
                  const isExpanded = expandedClients.has(clientGroup.client_id);
                  
                  return (
                    <div 
                      key={clientGroup.client_id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Client Header */}
                      <button
                        onClick={() => toggleClient(clientGroup.client_id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{clientGroup.client_name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {clientGroup.commissions.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-bold text-sm text-emerald-500">
                              R$ {clientGroup.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {clientGroup.pending > 0 && (
                              <p className="text-[10px] text-yellow-500">
                                R$ {clientGroup.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente
                              </p>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t bg-muted/30 p-3 space-y-2">
                          {clientGroup.commissions.map((commission) => {
                            const userName = commission.type === 'upsell'
                              ? (commission as any).user_name
                              : (commission as any).user_name || 'Colaborador';
                            const userRole = commission.type === 'sale'
                              ? getRoleLabel((commission as any).user_role)
                              : 'Sucesso do Cliente';

                            return (
                              <div 
                                key={commission.id}
                                className="p-2 bg-background rounded border flex items-center justify-between"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{userName}</span>
                                    {getCommissionTypeBadge(commission)}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">{userRole}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-emerald-500">
                                    R$ {Number(commission.commission_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                  {commission.status === 'pending' ? (
                                    commission.type === 'upsell' ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 text-[10px] px-1.5 text-emerald-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markPaid.mutate(commission.id);
                                        }}
                                        disabled={markPaid.isPending}
                                      >
                                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                        Pagar
                                      </Button>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                                        Pendente
                                      </Badge>
                                    )
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                                      Pago
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* By User View */}
        <TabsContent value="users" className="mt-3">
          <ScrollArea className="h-[400px]">
            {currentMonthUserGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma comissão este mês</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {currentMonthUserGroups.map((userGroup) => (
                  <div 
                    key={userGroup.user_id}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{userGroup.user_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {getRoleLabel(userGroup.user_role)} • {userGroup.commissions.length} comissões
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-500">
                          R$ {userGroup.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {userGroup.pending > 0 && (
                          <p className="text-[10px] text-yellow-500">
                            R$ {userGroup.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
