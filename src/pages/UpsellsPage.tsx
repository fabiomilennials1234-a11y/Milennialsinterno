import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  Plus, 
  DollarSign, 
  Package, 
  User,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { useUpsells, useUpdateUpsellStatus } from '@/hooks/useUpsells';
import { CreateUpsellModal } from '@/components/upsells/CreateUpsellModal';
import { PRODUCT_CONFIG } from '@/components/shared/ProductBadges';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MainLayout from '@/layouts/MainLayout';

export default function UpsellsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { data: upsells = [], isLoading } = useUpsells();
  const updateStatus = useUpdateUpsellStatus();

  // Filter upsells by selected month
  const filteredUpsells = useMemo(() => {
    return upsells.filter(u => {
      const upsellDate = new Date(u.created_at);
      return isSameMonth(upsellDate, selectedMonth);
    });
  }, [upsells, selectedMonth]);

  // Calculate stats for filtered month
  const totalUpsells = filteredUpsells.length;
  const pendingUpsells = filteredUpsells.filter(u => u.status === 'pending').length;
  const contractedUpsells = filteredUpsells.filter(u => u.status === 'contracted').length;
  const totalValue = filteredUpsells.reduce((sum, u) => sum + Number(u.monthly_value), 0);
  const pendingValue = filteredUpsells
    .filter(u => u.status === 'pending')
    .reduce((sum, u) => sum + Number(u.monthly_value), 0);

  const handlePreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const handleCurrentMonth = () => setSelectedMonth(new Date());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'contracted':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Contratado</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return null;
    }
  };

  const getProductBadge = (slug: string) => {
    const config = PRODUCT_CONFIG[slug as keyof typeof PRODUCT_CONFIG];
    if (!config) return <Badge variant="outline">{slug}</Badge>;
    
    return (
      <Badge 
        variant="outline"
        className={config.color}
      >
        {config.name}
      </Badge>
    );
  };

  return (
    <MainLayout>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
            UP Sells
          </h1>
          <p className="text-muted-foreground">
            Registre vendas adicionais para clientes existentes
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo UP Sell
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total UP Sells</p>
                <p className="text-2xl font-bold">{totalUpsells}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingUpsells}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contratados</p>
                <p className="text-2xl font-bold">{contractedUpsells}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upsells List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Histórico de UP Sells - {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredUpsells.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum UP Sell registrado em {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Registrar UP Sell
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredUpsells.map((upsell) => (
                  <div 
                    key={upsell.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {(upsell.client as any)?.name || 'Cliente'}
                            </span>
                            {getProductBadge(upsell.product_slug)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {upsell.sold_by_name}
                            </span>
                            <span>•</span>
                            <span>
                              {format(new Date(upsell.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            R$ {Number(upsell.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </div>
                        
                        {getStatusBadge(upsell.status)}
                        
                        {upsell.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                              onClick={() => updateStatus.mutate({ upsellId: upsell.id, status: 'contracted' })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => updateStatus.mutate({ upsellId: upsell.id, status: 'cancelled' })}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Commission info */}
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Comissão gerada (7%):
                      </span>
                      <span className="font-medium text-emerald-500">
                        R$ {(Number(upsell.monthly_value) * 0.07).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <CreateUpsellModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen} 
      />
    </div>
    </MainLayout>
  );
}
