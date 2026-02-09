import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { createNoteNotificationAndTask } from '@/hooks/useAdsNoteNotifications';

export interface ClientNote {
  id: string;
  client_id: string;
  created_by: string;
  content: string;
  note_type: 'note' | 'comment';
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_role?: string;
}

export function useClientNotes(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['client-notes', clientId],
    queryFn: async (): Promise<ClientNote[]> => {
      if (!clientId) return [];

      // Fetch notes
      const { data: notes, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!notes || notes.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(notes.map(n => n.created_by))];

      // Fetch profiles for authors
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      return notes.map(note => ({
        ...note,
        note_type: note.note_type as 'note' | 'comment',
        author_name: profileMap.get(note.created_by) || 'Usuário',
        author_role: roleMap.get(note.created_by) || undefined,
      }));
    },
    enabled: !!clientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`client-notes-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_notes',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  return query;
}

export function useAddClientNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      content, 
      noteType 
    }: { 
      clientId: string; 
      content: string; 
      noteType: 'note' | 'comment';
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Insert the note
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          created_by: user.id,
          content,
          note_type: noteType,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // If it's a note (Anotações do Gestor de Tráfego) added by consultor comercial,
      // create task and notification for the ads manager
      if (noteType === 'note') {
        // Get client info including assigned_ads_manager and name
        const { data: clientData } = await supabase
          .from('clients')
          .select('name, assigned_ads_manager')
          .eq('id', clientId)
          .single();

        if (clientData?.assigned_ads_manager) {
          // Get the user's name
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', user.id)
            .single();

          const createdByName = profileData?.name || 'Usuário';

          try {
            await createNoteNotificationAndTask({
              clientId,
              clientName: clientData.name,
              adsManagerId: clientData.assigned_ads_manager,
              noteId: data.id,
              noteContent: content,
              createdBy: user.id,
              createdByName,
            });
          } catch (notifError) {
            console.error('Error creating notification/task:', notifError);
            // Don't throw - the note was created successfully
          }
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.clientId] });
      toast.success(variables.noteType === 'note' ? 'Anotação adicionada' : 'Comentário adicionado');
    },
    onError: (error: any) => {
      toast.error('Erro ao adicionar', { description: error.message });
    },
  });
}

export function useUpdateClientNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      noteId, 
      content,
      clientId 
    }: { 
      noteId: string; 
      content: string;
      clientId: string;
    }) => {
      const { error } = await supabase
        .from('client_notes')
        .update({ content } as any)
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.clientId] });
      toast.success('Anotação atualizada');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar', { description: error.message });
    },
  });
}

export function useDeleteClientNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      noteId,
      clientId 
    }: { 
      noteId: string;
      clientId: string;
    }) => {
      const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.clientId] });
      toast.success('Anotação removida');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover', { description: error.message });
    },
  });
}

// Hook para verificar se o usuário pode adicionar notas (gestor de ads OU consultor comercial do cliente)
export function useCanAddNotes(clientId: string | undefined) {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['can-add-notes', clientId, user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!clientId || !user?.id) return false;
      if (isCEO) return true;
      if (user.role === 'gestor_projetos') return true;

      // Check if user is the assigned ads manager OR assigned comercial
      const { data } = await supabase
        .from('clients')
        .select('assigned_ads_manager, assigned_comercial')
        .eq('id', clientId)
        .single();

      return data?.assigned_ads_manager === user.id || data?.assigned_comercial === user.id;
    },
    enabled: !!clientId && !!user?.id,
  });
}

// Hook para verificar se o usuário pode adicionar comentários (consultor comercial do cliente)
export function useCanAddComments(clientId: string | undefined) {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['can-add-comments', clientId, user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!clientId || !user?.id) return false;
      if (isCEO) return true;
      if (user.role === 'gestor_projetos') return true;

      // Check if user is the assigned comercial
      const { data } = await supabase
        .from('clients')
        .select('assigned_comercial')
        .eq('id', clientId)
        .single();

      return data?.assigned_comercial === user.id;
    },
    enabled: !!clientId && !!user?.id,
  });
}
