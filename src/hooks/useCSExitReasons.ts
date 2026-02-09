import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CSExitReason {
  id: string;
  client_id: string;
  client_name: string;
  public_token: string;
  main_reason: string | null;
  satisfaction_score: number | null;
  what_could_improve: string | null;
  would_recommend: boolean | null;
  additional_feedback: string | null;
  is_submitted: boolean;
  submitted_at: string | null;
  created_at: string;
  created_by: string | null;
}

export function useCSExitReasons() {
  return useQuery({
    queryKey: ['cs-exit-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_exit_reasons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CSExitReason[];
    },
  });
}

export function useSubmittedExitReasons() {
  return useQuery({
    queryKey: ['cs-exit-reasons', 'submitted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_exit_reasons')
        .select('*')
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as CSExitReason[];
    },
  });
}

export function useExitReasonByClient(clientId: string | null) {
  return useQuery({
    queryKey: ['cs-exit-reasons', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('cs_exit_reasons')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as CSExitReason | null;
    },
    enabled: !!clientId,
  });
}

export function useExitReasonByToken(token: string | null) {
  return useQuery({
    queryKey: ['cs-exit-reasons', 'token', token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from('cs_exit_reasons')
        .select('*')
        .eq('public_token', token)
        .maybeSingle();

      if (error) throw error;
      return data as CSExitReason | null;
    },
    enabled: !!token,
  });
}

export function useCreateExitReason() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      const { data, error } = await supabase
        .from('cs_exit_reasons')
        .insert({
          client_id: clientId,
          client_name: clientName,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as CSExitReason;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-exit-reasons'] });
      toast.success('Formulário de saída criado');
    },
    onError: (error: any) => {
      // Check if it's a duplicate error
      if (error.code === '23505') {
        toast.error('Já existe um formulário de saída para este cliente');
      } else {
        toast.error('Erro ao criar formulário', { description: error.message });
      }
    },
  });
}

export function useSubmitExitReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      token, 
      mainReason, 
      satisfactionScore, 
      whatCouldImprove, 
      wouldRecommend, 
      additionalFeedback 
    }: { 
      token: string;
      mainReason: string;
      satisfactionScore: number;
      whatCouldImprove: string;
      wouldRecommend: boolean;
      additionalFeedback: string;
    }) => {
      const { data, error } = await supabase
        .from('cs_exit_reasons')
        .update({
          main_reason: mainReason,
          satisfaction_score: satisfactionScore,
          what_could_improve: whatCouldImprove,
          would_recommend: wouldRecommend,
          additional_feedback: additionalFeedback,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        } as any)
        .eq('public_token', token)
        .select()
        .single();

      if (error) throw error;
      return data as CSExitReason;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-exit-reasons'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar resposta', { description: error.message });
    },
  });
}
