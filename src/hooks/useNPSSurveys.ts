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
  survey_type: 'client' | 'team' | 'client_growth';
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

export interface NPSTeamResponse {
  id: string;
  survey_id: string;
  experience_rating: number;
  efficiency_assessment: 'sim' | 'parcialmente' | 'nao';
  positive_highlight: string;
  improvement_area: string;
  ideas_suggestions: string;
  respondent_name: string | null;
  submitted_at: string;
}

export interface NPSTeamSummary {
  id: string;
  survey_id: string | null;
  summary_content: string;
  summary_type: 'single' | 'all';
  model_used: string | null;
  tokens_used: number | null;
  generated_at: string;
  generated_by: string | null;
}

export interface NPSStats {
  totalResponses: number;
  averageScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  npsScore: number;
}

export interface NPSTeamStats {
  totalResponses: number;
  averageExperience: number;
  efficiencyBreakdown: { sim: number; parcialmente: number; nao: number };
}

// ---------- Surveys ----------

export function useNPSSurveys(surveyType?: 'client' | 'team' | 'client_growth') {
  return useQuery({
    queryKey: ['nps-surveys', surveyType],
    queryFn: async () => {
      let query = supabase
        .from('nps_surveys')
        .select('id, title, description, created_by, created_at, updated_at, is_active, public_token, survey_type')
        .order('created_at', { ascending: false });

      if (surveyType) {
        query = query.eq('survey_type', surveyType);
      }

      const { data, error } = await query;
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
        .select('id, title, description, created_by, created_at, updated_at, is_active, public_token, survey_type')
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
        .select('id, title, description, created_by, created_at, updated_at, is_active, public_token, survey_type')
        .eq('public_token', token)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as NPSSurvey;
    },
    enabled: !!token,
  });
}

// ---------- Client NPS Responses ----------

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

// ---------- Team NPS Responses ----------

export function useNPSTeamResponses(surveyId: string) {
  return useQuery({
    queryKey: ['nps-team-responses', surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_team_responses')
        .select('id, survey_id, experience_rating, efficiency_assessment, positive_highlight, improvement_area, ideas_suggestions, respondent_name, submitted_at')
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as NPSTeamResponse[];
    },
    enabled: !!surveyId,
  });
}

export function useAllNPSTeamResponses() {
  return useQuery({
    queryKey: ['nps-team-responses-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_team_responses')
        .select('id, survey_id, experience_rating, efficiency_assessment, positive_highlight, improvement_area, ideas_suggestions, submitted_at')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as Omit<NPSTeamResponse, 'respondent_name'>[];
    },
  });
}

export function calculateTeamStats(responses: Pick<NPSTeamResponse, 'experience_rating' | 'efficiency_assessment'>[]): NPSTeamStats {
  if (responses.length === 0) {
    return {
      totalResponses: 0,
      averageExperience: 0,
      efficiencyBreakdown: { sim: 0, parcialmente: 0, nao: 0 },
    };
  }

  const avg = responses.reduce((acc, r) => acc + r.experience_rating, 0) / responses.length;

  return {
    totalResponses: responses.length,
    averageExperience: Math.round(avg * 10) / 10,
    efficiencyBreakdown: {
      sim: responses.filter(r => r.efficiency_assessment === 'sim').length,
      parcialmente: responses.filter(r => r.efficiency_assessment === 'parcialmente').length,
      nao: responses.filter(r => r.efficiency_assessment === 'nao').length,
    },
  };
}

// ---------- Client Growth NPS Responses ----------

export interface NPSClientGrowthResponse {
  id: string;
  survey_id: string;
  company_name: string;
  results_evolution: 'muito_abaixo' | 'abaixo' | 'dentro' | 'acima' | 'muito_acima';
  biggest_challenges: string[];
  challenges_other: string | null;
  alignment_assessment: 'totalmente' | 'parcialmente' | 'pouco' | 'nao';
  strengthen_areas: string[];
  strengthen_other: string | null;
  improvement_suggestions: string;
  next_months_goal: string;
  nps_score: number;
  submitted_at: string;
}

export interface NPSClientGrowthStats {
  totalResponses: number;
  averageNPS: number;
  averageEvolution: number;
}

const EVOLUTION_SCORE: Record<string, number> = {
  muito_abaixo: 1,
  abaixo: 2,
  dentro: 3,
  acima: 4,
  muito_acima: 5,
};

export function useNPSClientGrowthResponses(surveyId: string) {
  return useQuery({
    queryKey: ['nps-client-growth-responses', surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_client_growth_responses')
        .select('*')
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as NPSClientGrowthResponse[];
    },
    enabled: !!surveyId,
  });
}

export function calculateClientGrowthStats(responses: NPSClientGrowthResponse[]): NPSClientGrowthStats {
  if (responses.length === 0) {
    return { totalResponses: 0, averageNPS: 0, averageEvolution: 0 };
  }

  const avgNPS = responses.reduce((acc, r) => acc + r.nps_score, 0) / responses.length;
  const avgEvo = responses.reduce((acc, r) => acc + (EVOLUTION_SCORE[r.results_evolution] || 3), 0) / responses.length;

  return {
    totalResponses: responses.length,
    averageNPS: Math.round(avgNPS * 10) / 10,
    averageEvolution: Math.round(avgEvo * 10) / 10,
  };
}

// ---------- Team Summaries ----------

export function useLatestTeamSummary() {
  return useQuery({
    queryKey: ['nps-team-summary-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_team_summaries')
        .select('id, summary_content, summary_type, generated_at, model_used')
        .eq('summary_type', 'all')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as NPSTeamSummary | null;
    },
  });
}

// ---------- Mutations ----------

export function useCreateNPSSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, description, surveyType }: { title?: string; description?: string; surveyType?: 'client' | 'team' | 'client_growth' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('nps_surveys')
        .insert({
          title: title || 'Pesquisa NPS | Millennials',
          description,
          created_by: user.id,
          survey_type: surveyType || 'client',
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
    onError: (error: Error) => {
      toast.error('Erro ao criar pesquisa', { description: error.message });
    },
  });
}

export function useSubmitNPSResponse() {
  return useMutation({
    mutationFn: async (response: Omit<NPSResponse, 'id' | 'submitted_at'>) => {
      const { error } = await supabase
        .from('nps_responses')
        .insert(response);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Resposta enviada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar resposta', { description: error.message });
    },
  });
}

export function useSubmitNPSTeamResponse() {
  return useMutation({
    mutationFn: async (response: Omit<NPSTeamResponse, 'id' | 'submitted_at'>) => {
      const { error } = await supabase
        .from('nps_team_responses')
        .insert(response);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Resposta enviada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar resposta', { description: error.message });
    },
  });
}

export function useSubmitNPSClientGrowthResponse() {
  return useMutation({
    mutationFn: async (response: Omit<NPSClientGrowthResponse, 'id' | 'submitted_at'>) => {
      const { error } = await supabase
        .from('nps_client_growth_responses')
        .insert(response);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Resposta enviada com sucesso!');
    },
    onError: (error: Error) => {
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
    onError: (error: Error) => {
      toast.error('Erro ao atualizar pesquisa', { description: error.message });
    },
  });
}

export function useGenerateTeamSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const response = await supabase.functions.invoke('summarize-nps-team', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return response.data as { summary: string; cached?: boolean };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nps-team-summary-latest'] });
      if (data.cached) {
        toast.info('Resumo carregado do cache.');
      } else {
        toast.success('Resumo inteligente gerado!');
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao gerar resumo', { description: error.message });
    },
  });
}
