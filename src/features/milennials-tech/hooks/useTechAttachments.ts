import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TechAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

const BUCKET = 'tech-attachments';

export const attachmentKeys = {
  task: (taskId: string) => ['tech', 'attachments', taskId] as const,
};

export function useTechAttachments(taskId?: string) {
  return useQuery<TechAttachment[]>({
    queryKey: attachmentKeys.task(taskId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tech_task_attachments')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as TechAttachment[];
    },
    enabled: !!taskId,
  });
}

export function getAttachmentUrl(filePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export function useUploadAttachments() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      files,
    }: {
      taskId: string;
      files: File[];
      /** Kept for call-site compatibility; uploaded_by is resolved server-side from auth.uid(). */
      userId?: string;
    }) => {
      const ids: string[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        // RPC bypasses table RLS so submitters without can_see_tech can still
        // persist metadata for tasks they created. Authorization is enforced
        // inside the function (can_see_tech OR created_by = auth.uid()).
        // Supabase types.ts is stale — this RPC isn't in the generated
        // Database type yet. Cast name to sidestep the overload check;
        // runtime behavior is defined by the migration.
        const { data: attachmentId, error: rpcError } = await supabase.rpc(
          'tech_submit_attachment' as never,
          {
            _task_id: taskId,
            _file_name: file.name,
            _file_path: path,
            _file_size: file.size,
            _content_type: file.type,
          } as never,
        );
        if (rpcError) throw rpcError;
        ids.push(attachmentId as unknown as string);
      }

      return ids;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attachmentKeys.task(vars.taskId) });
    },
  });
}
