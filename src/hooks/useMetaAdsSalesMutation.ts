import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CreateSaleInput {
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  sale_date: string;
  num_sales: number;
  sales_value: number;
}

interface UpdateSaleInput {
  id: string;
  num_sales: number;
  sales_value: number;
}

export function useMetaAdsSalesMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['meta-ads-sales'] });
  };

  const createSale = useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('meta_ads_manual_sales')
        .insert({
          ...input,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateSale = useMutation({
    mutationFn: async (input: UpdateSaleInput) => {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from('meta_ads_manual_sales')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_ads_manual_sales')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createSale, updateSale, deleteSale };
}
