import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Helper to get date key in Brazil timezone (YYYY-MM-DD)
function getDateKeyInBrazilTZ(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface ComercialClientDoc {
  id: string;
  comercial_user_id: string;
  client_id: string;
  documentation_date: string;
  helped_client: boolean;
  help_description: string;
  has_combinado: boolean;
  combinado_description?: string;
  combinado_deadline?: string;
  created_at: string;
  updated_at: string;
}

// Fetch all documentation for the current user
export function useComercialClientDocumentation() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['comercial-client-documentation', user?.id],
    queryFn: async (): Promise<ComercialClientDoc[]> => {
      const { data, error } = await supabase
        .from('comercial_client_documentation')
        .select('*')
        .eq('comercial_user_id', user?.id)
        .order('documentation_date', { ascending: false });

      if (error) throw error;
      return (data || []) as ComercialClientDoc[];
    },
    enabled: !!user,
  });
}

// Upsert documentation for a specific client (one record per client per day)
export function useUpsertComercialClientDoc() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (doc: {
      clientId: string;
      helpedClient: boolean;
      helpDescription: string;
      hasCombinado: boolean;
      combinadoDescription?: string;
      combinadoDeadline?: Date;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const today = getDateKeyInBrazilTZ();

      // Check if documentation exists for this client today
      const { data: existing } = await supabase
        .from('comercial_client_documentation')
        .select('id')
        .eq('client_id', doc.clientId)
        .eq('comercial_user_id', user.id)
        .eq('documentation_date', today)
        .maybeSingle();

      const docData = {
        comercial_user_id: user.id,
        client_id: doc.clientId,
        documentation_date: today,
        helped_client: doc.helpedClient,
        help_description: doc.helpDescription,
        has_combinado: doc.hasCombinado,
        combinado_description: doc.hasCombinado ? doc.combinadoDescription : null,
        combinado_deadline: doc.hasCombinado && doc.combinadoDeadline 
          ? format(doc.combinadoDeadline, 'yyyy-MM-dd') 
          : null,
      };

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('comercial_client_documentation')
          .update(docData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('comercial_client_documentation')
          .insert(docData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-client-documentation'] });
    },
    onError: () => {
      toast.error('Erro ao salvar documentação');
    },
  });
}

// Create a "combinado" task in comercial_tasks
export function useCreateComercialCombinadoTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      dueDate,
      clientId,
      clientName,
    }: {
      title: string;
      dueDate: string;
      clientId: string;
      clientName: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('comercial_tasks').insert({
        user_id: user.id,
        title: `📌 COMBINADO: ${title}`,
        description: `Cliente: ${clientName}\n\nCombinado: ${title}`,
        task_type: 'daily',
        status: 'todo',
        priority: 'high',
        due_date: dueDate,
        related_client_id: clientId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
      toast.success('Tarefa de combinado criada!');
    },
    onError: () => {
      toast.error('Erro ao criar tarefa de combinado');
    },
  });
}
