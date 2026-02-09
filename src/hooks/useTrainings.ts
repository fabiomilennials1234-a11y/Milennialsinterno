import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Training {
  id: string;
  title: string;
  description: string | null;
  class_links: string[] | null;
  class_date: string | null;
  class_time: string | null;
  is_recurring: boolean | null;
  recurrence_days: string[] | null;
  allowed_roles: string[] | null;
  thumbnail_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived: boolean | null;
  archived_at: string | null;
}

export interface TrainingLesson {
  id: string;
  training_id: string;
  title: string;
  lesson_url: string;
  order_index: number | null;
  duration_minutes: number | null;
  created_at: string;
}

export function useTrainings() {
  return useQuery({
    queryKey: ['trainings'],
    queryFn: async (): Promise<Training[]> => {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Training[];
    },
  });
}

export function useTrainingLessons(trainingId: string | null) {
  return useQuery({
    queryKey: ['training-lessons', trainingId],
    queryFn: async (): Promise<TrainingLesson[]> => {
      if (!trainingId) return [];
      
      const { data, error } = await supabase
        .from('training_lessons')
        .select('*')
        .eq('training_id', trainingId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!trainingId,
  });
}

export function useCreateTraining() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (training: {
      title: string;
      description?: string;
      class_date?: string;
      class_time?: string;
      is_recurring?: boolean;
      recurrence_days?: string[];
      allowed_roles?: string[];
      thumbnail_url?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('trainings')
        .insert({
          ...training,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Treinamento criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating training:', error);
      toast.error('Erro ao criar treinamento', { description: error.message });
    },
  });
}

export function useUpdateTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Training> & { id: string }) => {
      const { data, error } = await supabase
        .from('trainings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Treinamento atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar treinamento', { description: error.message });
    },
  });
}

export function useDeleteTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Permanently delete
      const { error } = await supabase
        .from('trainings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Treinamento excluído!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir treinamento', { description: error.message });
    },
  });
}

export function useAddLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lesson: {
      training_id: string;
      title: string;
      lesson_url?: string;
      order_index: number;
      duration_minutes?: number;
    }) => {
      const { data, error } = await supabase
        .from('training_lessons')
        .insert({
          training_id: lesson.training_id,
          title: lesson.title,
          lesson_url: lesson.lesson_url || '',
          order_index: lesson.order_index,
          duration_minutes: lesson.duration_minutes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons', variables.training_id] });
      toast.success('Aula adicionada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar aula', { description: error.message });
    },
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      training_id,
      ...updates
    }: Partial<TrainingLesson> & { id: string; training_id: string }) => {
      const { data, error } = await supabase
        .from('training_lessons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, training_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons', data.training_id] });
      toast.success('Aula atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar aula', { description: error.message });
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, training_id }: { id: string; training_id: string }) => {
      const { error } = await supabase
        .from('training_lessons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { training_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons', data.training_id] });
      toast.success('Aula removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover aula', { description: error.message });
    },
  });
}

// Helper to get role labels
export const ROLE_OPTIONS = [
  { value: 'ceo', label: 'CEO' },
  { value: 'gestor_projetos', label: 'Gestor de Projetos' },
  { value: 'gestor_ads', label: 'Gestor de Ads' },
  { value: 'sucesso_cliente', label: 'Sucesso do Cliente' },
  { value: 'consultor_comercial', label: 'Consultor Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'editor_video', label: 'Editor de Vídeo' },
  { value: 'designer', label: 'Designer' },
  { value: 'dev', label: 'Desenvolvedor' },
  { value: 'rh', label: 'RH' },
];

export const WEEKDAY_OPTIONS = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];
