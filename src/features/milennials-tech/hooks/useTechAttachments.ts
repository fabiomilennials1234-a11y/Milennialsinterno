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
      userId,
    }: {
      taskId: string;
      files: File[];
      userId: string;
    }) => {
      const results: TechAttachment[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        // Save metadata
        const { data, error: dbError } = await supabase
          .from('tech_task_attachments')
          .insert({
            task_id: taskId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            content_type: file.type,
            uploaded_by: userId,
          })
          .select()
          .single();
        if (dbError) throw dbError;
        results.push(data as TechAttachment);
      }

      return results;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attachmentKeys.task(vars.taskId) });
    },
  });
}
