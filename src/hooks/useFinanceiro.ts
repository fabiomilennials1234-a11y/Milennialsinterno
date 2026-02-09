import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ClientInvoice {
  id: string;
  client_id: string;
  invoice_month: string;
  invoice_value: number;
  invoice_number?: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date?: string;
  paid_at?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    razao_social?: string;
  };
}

// Fetch all invoices with client info
export function useClientInvoices() {
  return useQuery({
    queryKey: ['client-invoices'],
    queryFn: async (): Promise<ClientInvoice[]> => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('*, client:clients(id, name, razao_social)')
        .order('invoice_month', { ascending: false });

      if (error) throw error;
      return (data || []) as ClientInvoice[];
    },
  });
}

// Fetch invoices for current month
export function useCurrentMonthInvoices() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  return useQuery({
    queryKey: ['client-invoices', 'current-month'],
    queryFn: async (): Promise<ClientInvoice[]> => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('*, client:clients(id, name, razao_social)')
        .eq('invoice_month', firstDayOfMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ClientInvoice[];
    },
  });
}

// Fetch pending/overdue invoices (Contas a Receber)
export function usePendingInvoices() {
  return useQuery({
    queryKey: ['client-invoices', 'pending'],
    queryFn: async (): Promise<ClientInvoice[]> => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('*, client:clients(id, name, razao_social)')
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      if (error) throw error;
      return (data || []) as ClientInvoice[];
    },
  });
}

// Create invoice
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (invoice: {
      clientId: string;
      invoiceMonth: string;
      invoiceValue: number;
      invoiceNumber?: string;
      dueDate?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('client_invoices').insert({
        client_id: invoice.clientId,
        invoice_month: invoice.invoiceMonth,
        invoice_value: invoice.invoiceValue,
        invoice_number: invoice.invoiceNumber,
        due_date: invoice.dueDate,
        notes: invoice.notes,
        created_by: user.id,
        status: 'pending',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
      toast.success('Faturamento criado!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um faturamento para este cliente neste mês');
      } else {
        toast.error('Erro ao criar faturamento');
      }
    },
  });
}

// Update invoice status
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      status,
    }: {
      invoiceId: string;
      status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('client_invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

// Delete invoice
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('client_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
      toast.success('Faturamento removido!');
    },
    onError: () => {
      toast.error('Erro ao remover faturamento');
    },
  });
}

// Calculate monthly totals
export function calculateMonthlyTotals(invoices: ClientInvoice[]) {
  const total = invoices.reduce((sum, inv) => sum + Number(inv.invoice_value), 0);
  const paid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.invoice_value), 0);
  const pending = invoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + Number(inv.invoice_value), 0);

  return { total, paid, pending };
}
