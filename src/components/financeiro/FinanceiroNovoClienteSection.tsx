import { useFinanceiroOnboarding } from '@/hooks/useFinanceiroOnboarding';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, FileX } from 'lucide-react';
import ProductBadges from '@/components/shared/ProductBadges';
import ProductValuesBreakdown from '@/components/shared/ProductValuesBreakdown';

export default function FinanceiroNovoClienteSection() {
  const { getClientsByStep, moveToNextStep, isLoading, getDaysSinceCreated } = useFinanceiroOnboarding();

  const newClients = getClientsByStep('novo_cliente');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (newClients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileX size={40} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum novo cliente</p>
      </div>
    );
  }

  const handleMoveToNext = (clientId: string) => {
    moveToNextStep.mutate({ clientId, currentStep: 'novo_cliente' });
  };

  return (
    <div className="space-y-3">
      {newClients.map((record) => {
        const daysAgo = getDaysSinceCreated(record.created_at);
        const displayName = record.client?.razao_social || record.client?.name || 'Cliente';
        const monthlyValue = record.client?.monthly_value;
        const contractedProducts = record.client?.contracted_products;

        return (
          <Card key={record.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {displayName}
                    </h4>
                    
                    {/* Valores por produto com breakdown */}
                    <div className="mt-1">
                      <ProductValuesBreakdown clientId={record.client_id} />
                    </div>
                    
                    {/* Fallback para monthly_value se não houver breakdown */}
                    {monthlyValue && monthlyValue > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 hidden first:block">
                        R$ {monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    
                    {contractedProducts && contractedProducts.length > 0 && (
                      <div className="mt-1.5">
                        <ProductBadges products={contractedProducts} size="sm" maxVisible={4} />
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30 shrink-0">
                    <FileX size={12} className="mr-1" />
                    Contrato não assinado
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>{daysAgo} {daysAgo === 1 ? 'dia' : 'dias'}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleMoveToNext(record.client_id)}
                    disabled={moveToNextStep.isPending}
                  >
                    Iniciar Fluxo
                    <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
