import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ClientNpsRow = Database['public']['Tables']['client_nps_responses']['Row'];
type ClientNpsInsert = Database['public']['Tables']['client_nps_responses']['Insert'];

// ─── NPS Classification ───

export type NpsClassification = 'promotor' | 'neutro' | 'detrator';

export function getNpsClassification(score: number): NpsClassification {
  if (score >= 9) return 'promotor';
  if (score >= 7) return 'neutro';
  return 'detrator';
}

export function getNpsColor(classification: NpsClassification): string {
  switch (classification) {
    case 'promotor':
      return 'text-emerald-400';
    case 'neutro':
      return 'text-amber-400';
    case 'detrator':
      return 'text-red-400';
  }
}

export function getNpsBgColor(classification: NpsClassification): string {
  switch (classification) {
    case 'promotor':
      return 'bg-emerald-400/10 border-emerald-400/20';
    case 'neutro':
      return 'bg-amber-400/10 border-amber-400/20';
    case 'detrator':
      return 'bg-red-400/10 border-red-400/20';
  }
}

export function getNpsLabel(classification: NpsClassification): string {
  switch (classification) {
    case 'promotor':
      return 'Promotor';
    case 'neutro':
      return 'Neutro';
    case 'detrator':
      return 'Detrator';
  }
}

// ─── useClientNps: list NPS responses for a client ───

export function useClientNps(clientId: string) {
  return useQuery({
    queryKey: ['client-nps', clientId],
    queryFn: async (): Promise<ClientNpsRow[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_nps_responses')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ClientNpsRow[];
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useLatestClientNps: last NPS only ───

export function useLatestClientNps(clientId: string) {
  return useQuery({
    queryKey: ['client-nps-latest', clientId],
    queryFn: async (): Promise<ClientNpsRow | null> => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('client_nps_responses')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ClientNpsRow | null;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useAllClientNps: fetch all NPS responses (for kanban column) ───

export interface ClientNpsWithName extends ClientNpsRow {
  client_name: string;
}

export function useAllClientNps() {
  return useQuery({
    queryKey: ['all-client-nps'],
    queryFn: async (): Promise<ClientNpsWithName[]> => {
      const { data, error } = await supabase
        .from('client_nps_responses')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: Record<string, unknown>) => ({
        ...(row as unknown as ClientNpsRow),
        client_name: (row.clients as { name: string } | null)?.name || 'Cliente',
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useCreateClientNps: mutation INSERT ───

export function useCreateClientNps() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Omit<ClientNpsInsert, 'collected_by'>) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const { data, error } = await supabase
        .from('client_nps_responses')
        .insert({
          ...input,
          collected_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['client-nps', input.client_id] });
      queryClient.invalidateQueries({ queryKey: ['client-nps-latest', input.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-client-nps'] });
      toast.success('NPS registrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar NPS', { description: error.message });
    },
  });
}

// ─── useCreateClientNpsLink: INSERT with NULL score (generates public link) ───

export function useCreateClientNpsLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { client_id: string; reference_month: string }) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const { data, error } = await supabase
        .from('client_nps_responses')
        .insert({
          client_id: input.client_id,
          reference_month: input.reference_month,
          collected_by: user.id,
          nps_score: null,
          score_reason: null,
        })
        .select('id, public_token')
        .single();

      if (error) throw error;
      return data as { id: string; public_token: string | null };
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['client-nps', input.client_id] });
      queryClient.invalidateQueries({ queryKey: ['client-nps-latest', input.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-client-nps'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao gerar link NPS', { description: error.message });
    },
  });
}

// ─── useDeleteClientNps: mutation DELETE ───

export function useDeleteClientNps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('client_nps_responses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-nps', result.clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-nps-latest', result.clientId] });
      queryClient.invalidateQueries({ queryKey: ['all-client-nps'] });
      toast.success('NPS excluido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir NPS', { description: error.message });
    },
  });
}
