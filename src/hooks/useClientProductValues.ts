import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ClientProductValue {
  id: string;
  client_id: string;
  product_slug: string;
  product_name: string;
  monthly_value: number;
  created_at: string;
  updated_at: string;
}

// Buscar valores por produto de um cliente
export function useClientProductValues(clientId?: string) {
  return useQuery({
    queryKey: ['client-product-values', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('client_product_values')
        .select('*')
        .eq('client_id', clientId)
        .order('product_name', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ClientProductValue[];
    },
    enabled: !!clientId,
  });
}

// Buscar valores por produto de múltiplos clientes
export function useAllClientProductValues(clientIds?: string[]) {
  return useQuery({
    queryKey: ['client-product-values', 'multiple', clientIds],
    queryFn: async () => {
      if (!clientIds || clientIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('client_product_values')
        .select('*')
        .in('client_id', clientIds)
        .order('product_name', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ClientProductValue[];
    },
    enabled: !!clientIds && clientIds.length > 0,
  });
}

// Atualizar valor de um produto (com registro de mudança de MRR)
export function useUpdateProductValue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      monthly_value
    }: {
      id: string;
      monthly_value: number;
    }) => {
      // Buscar valor anterior para registrar a mudança
      const { data: current, error: fetchError } = await supabase
        .from('client_product_values')
        .select('client_id, product_slug, product_name, monthly_value')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const previousValue = Number(current.monthly_value || 0);
      const newValue = Number(monthly_value);
      const diff = newValue - previousValue;

      // Atualizar o valor
      const { error } = await supabase
        .from('client_product_values')
        .update({ monthly_value })
        .eq('id', id);

      if (error) throw error;

      // Registrar mudança de MRR se houver diferença real
      if (diff !== 0) {
        await supabase.from('mrr_changes').insert({
          client_id: current.client_id,
          product_slug: current.product_slug,
          product_name: current.product_name,
          previous_value: previousValue,
          new_value: newValue,
          change_value: Math.abs(diff),
          change_type: diff > 0 ? 'expansion' : 'depreciation',
          source: 'manual',
          changed_by: user?.id || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      queryClient.invalidateQueries({ queryKey: ['mrr-changes'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-indicadores'] });
      toast.success('Valor atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar valor: ' + error.message);
    },
  });
}

// Adicionar valor de produto a um cliente
export function useAddProductValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      client_id,
      product_slug,
      product_name,
      monthly_value 
    }: { 
      client_id: string;
      product_slug: string;
      product_name: string;
      monthly_value: number;
    }) => {
      const { error } = await supabase
        .from('client_product_values')
        .upsert({
          client_id,
          product_slug,
          product_name,
          monthly_value,
        }, {
          onConflict: 'client_id,product_slug'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      toast.success('Valor adicionado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar valor: ' + error.message);
    },
  });
}

// Remover valor de produto
export function useDeleteProductValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_product_values')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      toast.success('Valor removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover valor: ' + error.message);
    },
  });
}
