import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientProductData {
  clientId: string;
  clientName: string;
  razaoSocial: string | null;
  productSlug: string;
  productName: string;
  monthlyValue: number;
}

export interface ClientWithProductMargin {
  clientId: string;
  clientName: string;
  razaoSocial: string | null;
  monthlyValue: number;
  estimatedCost: number;
  margin: number;
  marginPercent: number;
}

export interface ProductWithClients {
  productSlug: string;
  productName: string;
  clients: ClientWithProductMargin[];
  totalReceita: number;
  totalCustos: number;
  totalMargem: number;
  margemPercent: number;
}

// Hook to get all clients with their product values
export function useClientsByProduct() {
  return useQuery({
    queryKey: ['clients-by-product'],
    queryFn: async () => {
      // Get all active clients with their contracted products
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, archived, distrato_step, status')
        .eq('archived', false)
        .is('distrato_step', null);

      if (clientsError) throw clientsError;

      // Get all client product values
      const { data: productValues, error: valuesError } = await supabase
        .from('client_product_values')
        .select('*');

      if (valuesError) throw valuesError;

      // Create a map of client values by product
      const clientsByProduct: Record<string, ClientProductData[]> = {};

      // Process each client
      clients?.forEach(client => {
        if (!client.contracted_products?.length) return;

        client.contracted_products.forEach((product: string) => {
          if (!clientsByProduct[product]) {
            clientsByProduct[product] = [];
          }

          // Find the specific product value for this client
          const productValue = productValues?.find(
            pv => pv.client_id === client.id && pv.product_slug === product
          );

          clientsByProduct[product].push({
            clientId: client.id,
            clientName: client.name,
            razaoSocial: client.razao_social,
            productSlug: product,
            productName: productValue?.product_name || product,
            monthlyValue: productValue?.monthly_value || 0,
          });
        });
      });

      return clientsByProduct;
    },
  });
}

// Hook to calculate margin per client for a specific product
export function useProductClientMargins(productSlug: string, totalProductCost: number) {
  const { data: clientsByProduct = {} } = useClientsByProduct();
  
  const clients = clientsByProduct[productSlug] || [];
  const totalReceita = clients.reduce((sum, c) => sum + c.monthlyValue, 0);
  
  // Distribute costs proportionally based on each client's contribution to revenue
  const clientsWithMargin: ClientWithProductMargin[] = clients.map(client => {
    const revenueShare = totalReceita > 0 ? client.monthlyValue / totalReceita : 0;
    const estimatedCost = totalProductCost * revenueShare;
    const margin = client.monthlyValue - estimatedCost;
    const marginPercent = client.monthlyValue > 0 ? (margin / client.monthlyValue) * 100 : 0;

    return {
      clientId: client.clientId,
      clientName: client.clientName,
      razaoSocial: client.razaoSocial,
      monthlyValue: client.monthlyValue,
      estimatedCost,
      margin,
      marginPercent,
    };
  });

  return {
    clients: clientsWithMargin.sort((a, b) => b.margin - a.margin),
    totalReceita,
    totalCustos: totalProductCost,
    totalMargem: totalReceita - totalProductCost,
    margemPercent: totalReceita > 0 ? ((totalReceita - totalProductCost) / totalReceita) * 100 : 0,
  };
}

// Get all products with their client margins
export function useAllProductsWithClientMargins(custosPorProduto: Record<string, number>) {
  const { data: clientsByProduct = {}, isLoading } = useClientsByProduct();

  const productsWithClients: ProductWithClients[] = Object.entries(clientsByProduct).map(([slug, clients]) => {
    const totalReceita = clients.reduce((sum, c) => sum + c.monthlyValue, 0);
    const totalCustos = custosPorProduto[slug] || 0;
    
    const clientsWithMargin: ClientWithProductMargin[] = clients.map(client => {
      const revenueShare = totalReceita > 0 ? client.monthlyValue / totalReceita : 0;
      const estimatedCost = totalCustos * revenueShare;
      const margin = client.monthlyValue - estimatedCost;
      const marginPercent = client.monthlyValue > 0 ? (margin / client.monthlyValue) * 100 : 0;

      return {
        clientId: client.clientId,
        clientName: client.clientName,
        razaoSocial: client.razaoSocial,
        monthlyValue: client.monthlyValue,
        estimatedCost,
        margin,
        marginPercent,
      };
    });

    return {
      productSlug: slug,
      productName: clients[0]?.productName || slug,
      clients: clientsWithMargin.sort((a, b) => b.margin - a.margin),
      totalReceita,
      totalCustos,
      totalMargem: totalReceita - totalCustos,
      margemPercent: totalReceita > 0 ? ((totalReceita - totalCustos) / totalReceita) * 100 : 0,
    };
  });

  return {
    products: productsWithClients.sort((a, b) => b.totalMargem - a.totalMargem),
    isLoading,
  };
}
