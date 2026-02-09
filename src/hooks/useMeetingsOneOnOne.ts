import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MeetingOneOnOne {
  id: string;
  evaluated_manager_id: string;
  evaluated_manager_name: string;
  documentation_up_to_date: boolean;
  correct_client_movement: boolean;
  delay_video: boolean;
  delay_design: boolean;
  delay_site: boolean;
  delay_crm: boolean;
  delay_automation: boolean;
  main_challenges: string[];
  general_observations: string | null;
  meeting_date: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyProblem {
  id: string;
  problem_text: string;
  source_meeting_id: string | null;
  problem_type: string | null;
  manager_id: string | null;
  manager_name: string | null;
  week_start: string | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface PredefinedChallenge {
  id: string;
  challenge_text: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface WeeklySummary {
  id: string;
  week_start: string;
  summary_text: string;
  main_challenges: string[] | null;
  main_delays: string[] | null;
  recommendations: string[] | null;
  generated_at: string;
  generated_by: string | null;
  created_at: string;
}

export interface MeetingFormData {
  evaluated_manager_id: string;
  evaluated_manager_name: string;
  documentation_up_to_date: boolean;
  correct_client_movement: boolean;
  delay_video: boolean;
  delay_design: boolean;
  delay_site: boolean;
  delay_crm: boolean;
  delay_automation: boolean;
  main_challenges: string[];
  general_observations: string | null;
  meeting_date: string;
  created_by_name: string | null;
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

export function useMeetingsOneOnOne() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const meetingsQuery = useQuery({
    queryKey: ['meetings-one-on-one'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings_one_on_one')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MeetingOneOnOne[];
    },
  });

  const challengesQuery = useQuery({
    queryKey: ['predefined-challenges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('predefined_challenges')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return data as PredefinedChallenge[];
    },
  });

  const weeklyProblemsQuery = useQuery({
    queryKey: ['weekly-problems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_problems')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WeeklyProblem[];
    },
  });

  const weeklySummaryQuery = useQuery({
    queryKey: ['weekly-summary', getWeekStart()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .select('*')
        .eq('week_start', getWeekStart())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as WeeklySummary | null;
    },
  });

  const createMeeting = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      const meetingInsert = {
        evaluated_manager_id: data.evaluated_manager_id,
        evaluated_manager_name: data.evaluated_manager_name,
        documentation_up_to_date: data.documentation_up_to_date,
        correct_client_movement: data.correct_client_movement,
        delay_video: data.delay_video,
        delay_design: data.delay_design,
        delay_site: data.delay_site,
        delay_crm: data.delay_crm,
        delay_automation: data.delay_automation,
        main_challenges: data.main_challenges,
        general_observations: data.general_observations,
        meeting_date: data.meeting_date,
        created_by: user?.id || null,
        created_by_name: data.created_by_name,
      };

      const { data: meeting, error } = await supabase
        .from('meetings_one_on_one')
        .insert(meetingInsert)
        .select()
        .single();
      if (error) throw error;

      // Criar problemas da semana baseado na reunião
      const weekStart = getWeekStart();
      const problemsToInsert: {
        problem_text: string;
        source_meeting_id: string;
        problem_type: string;
        manager_id: string;
        manager_name: string;
        week_start: string;
      }[] = [];

      // Adicionar desafios principais
      if (data.main_challenges?.length > 0) {
        for (const challenge of data.main_challenges) {
          problemsToInsert.push({
            problem_text: challenge,
            source_meeting_id: meeting.id,
            problem_type: 'challenge',
            manager_id: data.evaluated_manager_id,
            manager_name: data.evaluated_manager_name,
            week_start: weekStart,
          });
        }
      }

      // Adicionar atrasos
      if (data.delay_video) {
        problemsToInsert.push({
          problem_text: `Atraso em Vídeo - ${data.evaluated_manager_name}`,
          source_meeting_id: meeting.id,
          problem_type: 'delay_video',
          manager_id: data.evaluated_manager_id,
          manager_name: data.evaluated_manager_name,
          week_start: weekStart,
        });
      }
      if (data.delay_design) {
        problemsToInsert.push({
          problem_text: `Atraso em Design - ${data.evaluated_manager_name}`,
          source_meeting_id: meeting.id,
          problem_type: 'delay_design',
          manager_id: data.evaluated_manager_id,
          manager_name: data.evaluated_manager_name,
          week_start: weekStart,
        });
      }
      if (data.delay_site) {
        problemsToInsert.push({
          problem_text: `Atraso em Site - ${data.evaluated_manager_name}`,
          source_meeting_id: meeting.id,
          problem_type: 'delay_site',
          manager_id: data.evaluated_manager_id,
          manager_name: data.evaluated_manager_name,
          week_start: weekStart,
        });
      }
      if (data.delay_crm) {
        problemsToInsert.push({
          problem_text: `Atraso em CRM - ${data.evaluated_manager_name}`,
          source_meeting_id: meeting.id,
          problem_type: 'delay_crm',
          manager_id: data.evaluated_manager_id,
          manager_name: data.evaluated_manager_name,
          week_start: weekStart,
        });
      }
      if (data.delay_automation) {
        problemsToInsert.push({
          problem_text: `Atraso em Automação - ${data.evaluated_manager_name}`,
          source_meeting_id: meeting.id,
          problem_type: 'delay_automation',
          manager_id: data.evaluated_manager_id,
          manager_name: data.evaluated_manager_name,
          week_start: weekStart,
        });
      }

      // Adicionar observações gerais como problema
      if (data.general_observations?.trim()) {
        problemsToInsert.push({
          problem_text: data.general_observations,
          source_meeting_id: meeting.id,
          problem_type: 'observation',
          manager_id: data.evaluated_manager_id,
          manager_name: data.evaluated_manager_name,
          week_start: weekStart,
        });
      }

      if (problemsToInsert.length > 0) {
        await supabase.from('weekly_problems').insert(problemsToInsert);
      }

      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-one-on-one'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-problems'] });
      toast.success('Reunião 1 a 1 registrada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar reunião: ' + error.message);
    },
  });

  const archiveWeeklyProblems = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('weekly_problems')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('archived', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-problems'] });
      toast.success('Problemas da semana arquivados');
    },
    onError: (error: Error) => {
      toast.error('Erro ao arquivar problemas: ' + error.message);
    },
  });

  const saveWeeklySummary = useMutation({
    mutationFn: async (summary: { summary_text: string; main_challenges?: string[]; main_delays?: string[]; recommendations?: string[] }) => {
      const insertData = {
        week_start: getWeekStart(),
        summary_text: summary.summary_text,
        main_challenges: summary.main_challenges || [],
        main_delays: summary.main_delays || [],
        recommendations: summary.recommendations || [],
        generated_by: user?.id || null,
      };
      const { data, error } = await supabase
        .from('weekly_summaries')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-summary'] });
      toast.success('Resumo salvo');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar resumo: ' + error.message);
    },
  });

  const addChallenge = useMutation({
    mutationFn: async (challengeText: string) => {
      const { data, error } = await supabase
        .from('predefined_challenges')
        .insert({ challenge_text: challengeText })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predefined-challenges'] });
      toast.success('Desafio adicionado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar desafio: ' + error.message);
    },
  });

  return {
    meetings: meetingsQuery.data || [],
    challenges: challengesQuery.data || [],
    weeklyProblems: weeklyProblemsQuery.data || [],
    weeklySummary: weeklySummaryQuery.data,
    isLoading: meetingsQuery.isLoading || challengesQuery.isLoading,
    createMeeting,
    archiveWeeklyProblems,
    saveWeeklySummary,
    addChallenge,
  };
}
