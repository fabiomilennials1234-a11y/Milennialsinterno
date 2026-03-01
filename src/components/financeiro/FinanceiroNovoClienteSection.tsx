import { useFinanceiroOnboarding } from '@/hooks/useFinanceiroOnboarding';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileX, DollarSign, Package } from 'lucide-react';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function FinanceiroNovoClienteSection() {
  const { getClientsByStep, isLoading: onboardingLoading } = useFinanceiroOnboarding();
  const novoClientes = getClientsByStep('novo_cliente');

  // Fetch product values for novo_cliente records
  const clientIds = [...new Set(novoClientes.map(r => r.client_id))];
  const productKeys = novoClientes.map(r => `${r.client_id}:${r.product_slug}`);

  const { data: productValues = [] } = useQuery({
    queryKey: ['novo-cliente-product-values', productKeys.sort().join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase
        .from('client_product_values')
        .select('client_id, product_slug, product_name, monthly_value')
        .in('client_id', clientIds);
      if (error) throw error;
      return data || [];
    },
    enabled: clientIds.length > 0,
  });

  // Map product values by client_id:product_slug
  const pvMap = new Map<string, number>();
  for (const pv of productValues) {
    pvMap.set(`${pv.client_id}:${pv.product_slug}`, Number(pv.monthly_value || 0));
  }

  if (onboardingLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (novoClientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileX size={40} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum cliente novo</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {novoClientes.map((record) => {
        const client = record.client;
        if (!client) return null;
        const clientName = client.razao_social || client.name || 'Cliente';
        const productName = record.product_name;
        const productValue = pvMap.get(`${record.client_id}:${record.product_slug}`) || 0;

        return (
          <Card key={record.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col gap-2">
                {/* Client name + value */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {clientName}
                    </h4>
                  </div>
                  {productValue > 0 && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                      <DollarSign size={10} className="mr-0.5" />
                      {formatCurrency(productValue)}
                    </Badge>
                  )}
                </div>

                {/* Product */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-primary font-medium flex items-center gap-1">
                    <Package size={10} />
                    {productName}
                  </span>
                  {productValue > 0 && (
                    <span className="text-muted-foreground">
                      {formatCurrency(productValue)}/mês
                    </span>
                  )}
                </div>

                {/* Info text */}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Aguardando conclusão das tarefas diárias
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
