import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TaskTable = 'onboarding_tasks' | 'department_tasks' | 'ads_tasks' | 'kanban_cards';

export function useAddJustification(table: TaskTable, queryKey: string[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, justification }: { taskId: string; justification: string }) => {
      const { error } = await supabase
        .from(table)
        .update({
          justification,
          justification_at: new Date().toISOString(),
        } as any)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Justificativa salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar justificativa', { description: error.message });
    },
  });
}
