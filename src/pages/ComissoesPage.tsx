import { useState, useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Coins,
  DollarSign,
  Clock,
  CheckCircle2,
  User,
  TrendingUp,
  Sparkles,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useAllCommissions, useMarkUpsellCommissionPaid, getRoleLabel, type Commission, type UserCommissionGroup } from '@/hooks/useAllCommissions';
import { format, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

export default function ComissoesPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { data, isLoading } = useAllCommissions();
  const markAsPaid = useMarkUpsellCommissionPaid();
  const { user } = useAuth();

  const canMarkAsPaid = user?.role === 'ceo' || user?.role === 'financeiro';

  // Filter commissions by selected month
  const filteredData = useMemo(() => {
    if (!data) return { groups: [], totals: { total: 0, pending: 0, paid: 0 } };

    const filteredGroups = data.groups.map(group => {
      const filteredCommissions = group.commissions.filter(c => {
        const commissionDate = new Date(c.created_at);
        return isSameMonth(commissionDate, selectedMonth);
      });

      const total = filteredCommissions.reduce((sum, c) => sum + Number(c.commission_value), 0);
      const pending = filteredCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.commission_value), 0);
      const paid = filteredCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.commission_value), 0);

      return {
        ...group,
        commissions: filteredCommissions,
        total,
        pending,
        paid,
      };
    }).filter(g => g.commissions.length > 0);

    const totals = {
      total: filteredGroups.reduce((sum, g) => sum + g.total, 0),
      pending: filteredGroups.reduce((sum, g) => sum + g.pending, 0),
      paid: filteredGroups.reduce((sum, g) => sum + g.paid, 0),
    };

    return { groups: filteredGroups, totals };
  }, [data, selectedMonth]);

  const handlePreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setSelectedMonth(new Date());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCommissionTypeBadge = (commission: Commission) => {
    if (commission.type === 'upsell') {
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          UP Sell
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs">
        <ShoppingCart className="h-3 w-3 mr-1" />
        Venda
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'paid') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getClientName = (commission: Commission) => {
    if (commission.type === 'upsell') {
      return (commission as any).upsell?.client?.name || 'Cliente';
    }
    return (commission as any).client?.name || 'Cliente';
  };

  const getProductInfo = (commission: Commission) => {
    if (commission.type === 'upsell') {
      return (commission as any).upsell?.product_name || '';
    }
    return '';
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

  return (
    <MainLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Coins className="h-6 w-6 text-yellow-500" />
                Comissões
              </h1>
              <p className="text-muted-foreground">
                Acompanhe as comissões de cada colaborador
              </p>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleCurrentMonth}
                className="h-8 px-3 gap-2 font-medium"
              >
                <Calendar className="h-4 w-4" />
                {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Coins className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Comissões</p>
                    <p className="text-2xl font-bold">{formatCurrency(filteredData.totals.total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold">{formatCurrency(filteredData.totals.pending)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pagas</p>
                    <p className="text-2xl font-bold">{formatCurrency(filteredData.totals.paid)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Kanban-style columns by user */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          {filteredData.groups.length === 0 ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma comissão registrada em {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
            </Card>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
                {filteredData.groups.map((group) => (
                  <Card key={group.user_id} className="w-[350px] flex-shrink-0 flex flex-col max-h-full">
                    {/* Column Header */}
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{group.user_name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{getRoleLabel(group.user_role)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="text-center flex-1">
                          <p className="text-lg font-bold text-emerald-500">{formatCurrency(group.total)}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="text-center flex-1">
                          <p className="text-sm font-medium text-yellow-500">{formatCurrency(group.pending)}</p>
                          <p className="text-xs text-muted-foreground">Pendente</p>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Commission Cards */}
                    <ScrollArea className="flex-1">
                      <CardContent className="p-3 space-y-2">
                        {group.commissions.map((commission) => (
                          <div
                            key={commission.id}
                            className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-medium text-sm truncate">
                                {getClientName(commission)}
                              </span>
                              {getCommissionTypeBadge(commission)}
                            </div>
                            
                            {getProductInfo(commission) && (
                              <p className="text-xs text-muted-foreground mb-2">
                                Produto: {getProductInfo(commission)}
                              </p>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-emerald-500">
                                {formatCurrency(Number(commission.commission_value))}
                              </span>
                              {getStatusBadge(commission.status)}
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              
                              {canMarkAsPaid && commission.status === 'pending' && commission.type === 'upsell' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                                  onClick={() => markAsPaid.mutate(commission.id)}
                                  disabled={markAsPaid.isPending}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Marcar Pago
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </ScrollArea>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
