import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ClientMeetingNote {
  id: string;
  client_id: string;
  title: string;
  content: string;
  meeting_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

export function useClientMeetingNotes(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-meeting-notes', clientId],
    queryFn: async (): Promise<ClientMeetingNote[]> => {
      if (!clientId) return [];

      const { data: notes, error } = await supabase
        .from('client_meeting_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('meeting_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!notes || notes.length === 0) return [];

      const userIds = [...new Set(notes.map(n => n.created_by))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      return notes.map(note => ({
        ...note,
        author_name: profileMap.get(note.created_by) || 'Usuário',
      }));
    },
    enabled: !!clientId,
  });
}

export function useCreateMeetingNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      title,
      content,
      meetingDate,
    }: {
      clientId: string;
      title: string;
      content: string;
      meetingDate: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('client_meeting_notes')
        .insert({
          client_id: clientId,
          title,
          content,
          meeting_date: meetingDate,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-meeting-notes', variables.clientId] });
      toast.success('Resumo de reunião adicionado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar resumo', { description: error.message });
    },
  });
}

export function useUpdateMeetingNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      clientId,
      title,
      content,
      meetingDate,
    }: {
      noteId: string;
      clientId: string;
      title: string;
      content: string;
      meetingDate: string;
    }) => {
      const { error } = await supabase
        .from('client_meeting_notes')
        .update({ title, content, meeting_date: meetingDate })
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-meeting-notes', variables.clientId] });
      toast.success('Resumo atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar', { description: error.message });
    },
  });
}

export function useDeleteMeetingNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      clientId,
    }: {
      noteId: string;
      clientId: string;
    }) => {
      const { error } = await supabase
        .from('client_meeting_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-meeting-notes', variables.clientId] });
      toast.success('Resumo removido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover', { description: error.message });
    },
  });
}
