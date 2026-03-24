import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MeetingFolder {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordedMeeting {
  id: string;
  folder_id: string;
  video_url: string;
  video_filename: string | null;
  ata: string | null;
  summary: string | null;
  meeting_date: string;
  participants: string[];
  is_whole_team: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordedMeetingFormData {
  folder_id: string;
  video_url: string;
  video_filename: string | null;
  ata: string | null;
  summary: string | null;
  meeting_date: string;
  participants: string[];
  is_whole_team: boolean;
}

export function useRecordedMeetings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const foldersQuery = useQuery({
    queryKey: ['meeting-folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_folders')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as MeetingFolder[];
    },
  });

  const meetingsQuery = useQuery({
    queryKey: ['recorded-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recorded_meetings')
        .select('*')
        .order('meeting_date', { ascending: false });
      if (error) throw error;
      return data as RecordedMeeting[];
    },
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('meeting_folders')
        .insert({ name, created_by: user?.id || null } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-folders'] });
      toast.success('Pasta criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar pasta: ' + error.message);
    },
  });

  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('meeting_folders')
        .update({ name } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-folders'] });
      toast.success('Pasta renomeada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao renomear pasta: ' + error.message);
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meeting_folders')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-folders'] });
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });
      toast.success('Pasta excluída');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir pasta: ' + error.message);
    },
  });

  const createMeeting = useMutation({
    mutationFn: async (data: RecordedMeetingFormData) => {
      const insertData = {
        ...data,
        created_by: user?.id || null,
        created_by_name: user?.name || null,
      };
      const { data: meeting, error } = await supabase
        .from('recorded_meetings')
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;
      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });
      toast.success('Reunião cadastrada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar reunião: ' + error.message);
    },
  });

  const deleteMeeting = useMutation({
    mutationFn: async (meeting: RecordedMeeting) => {
      // Remove video from storage
      if (meeting.video_url) {
        const path = meeting.video_url.split('/recorded-meetings/')[1];
        if (path) {
          await supabase.storage.from('recorded-meetings').remove([decodeURIComponent(path)]);
        }
      }
      const { error } = await supabase
        .from('recorded_meetings')
        .delete()
        .eq('id', meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });
      toast.success('Reunião excluída');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir reunião: ' + error.message);
    },
  });

  const uploadVideo = async (file: File): Promise<{ url: string; filename: string }> => {
    const timestamp = Date.now();
    const safeName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 50);
    const path = `${user?.id || 'anonymous'}/${timestamp}-${safeName}`;

    const { error } = await supabase.storage
      .from('recorded-meetings')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('recorded-meetings')
      .getPublicUrl(path);

    return { url: urlData.publicUrl, filename: file.name };
  };

  return {
    folders: foldersQuery.data || [],
    meetings: meetingsQuery.data || [],
    isLoading: foldersQuery.isLoading || meetingsQuery.isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    createMeeting,
    deleteMeeting,
    uploadVideo,
  };
}
