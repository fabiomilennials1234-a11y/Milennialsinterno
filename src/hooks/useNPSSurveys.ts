import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NPSSurvey {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  public_token: string;
}

export interface NPSResponse {
  id: string;
  survey_id: string;
  company_name: string;
  nps_score: number;
  score_reason: string;
  strategies_aligned: 'sim' | 'parcialmente' | 'nao';
  communication_rating: 'excelente' | 'bom' | 'regular' | 'ruim' | 'outro';
  communication_other: string | null;
  creatives_rating: 'excelente' | 'bom' | 'regular' | 'ruim';
  creatives_represent_brand: 'sim_totalmente' | 'parcialmente' | 'nao';
  improvement_suggestions: string;
  submitted_at: string;
}

export interface NPSStats {
  totalResponses: number;
  averageScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  npsScore: number;
}

export function useNPSSurveys() {
  return useQuery({
    queryKey: ['nps-surveys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as NPSSurvey[];
    },
  });
}

export function useNPSSurvey(surveyId: string) {
  return useQuery({
    queryKey: ['nps-survey', surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (error) throw error;
      return data as NPSSurvey;
    },
    enabled: !!surveyId,
  });
}

export function useNPSSurveyByToken(token: string) {
  return useQuery({
    queryKey: ['nps-survey-token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_surveys')
        .select('*')
        .eq('public_token', token)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as NPSSurvey;
    },
    enabled: !!token,
  });
}

export function useNPSResponses(surveyId: string) {
  return useQuery({
    queryKey: ['nps-responses', surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_responses')
        .select('*')
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as NPSResponse[];
    },
    enabled: !!surveyId,
  });
}

export function calculateNPSStats(responses: NPSResponse[]): NPSStats {
  if (responses.length === 0) {
    return {
      totalResponses: 0,
      averageScore: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      npsScore: 0,
    };
  }

  const promoters = responses.filter(r => r.nps_score >= 9).length;
  const passives = responses.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length;
  const detractors = responses.filter(r => r.nps_score <= 6).length;

  const npsScore = Math.round(((promoters - detractors) / responses.length) * 100);
  const averageScore = responses.reduce((acc, r) => acc + r.nps_score, 0) / responses.length;

  return {
    totalResponses: responses.length,
    averageScore: Math.round(averageScore * 10) / 10,
    promoters,
    passives,
    detractors,
    npsScore,
  };
}

export function useCreateNPSSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, description }: { title?: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('nps_surveys')
        .insert({
          title: title || 'Pesquisa NPS | Millennials',
          description,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as NPSSurvey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-surveys'] });
      toast.success('Pesquisa NPS criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pesquisa', { description: error.message });
    },
  });
}

export function useSubmitNPSResponse() {
  return useMutation({
    mutationFn: async (response: Omit<NPSResponse, 'id' | 'submitted_at'>) => {
      const { data, error } = await supabase
        .from('nps_responses')
        .insert(response)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Resposta enviada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar resposta', { description: error.message });
    },
  });
}

export function useToggleSurveyActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, isActive }: { surveyId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('nps_surveys')
        .update({ is_active: isActive })
        .eq('id', surveyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-surveys'] });
      toast.success('Status da pesquisa atualizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar pesquisa', { description: error.message });
    },
  });
}
