import { supabase } from '@/integrations/supabase/client';
import type { CardAttachment } from '@/hooks/useCardAttachments';
import { toError } from '@/lib/supabaseErrors';

type RpcError = { message: string };

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

export async function createKanbanCardAttachment(input: {
  cardId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
}): Promise<CardAttachment> {
  const { data, error } = await rpcClient.rpc<CardAttachment>('create_kanban_card_attachment', {
    _card_id: input.cardId,
    _file_name: input.fileName,
    _file_url: input.fileUrl,
    _file_type: input.fileType ?? null,
    _file_size: input.fileSize ?? null,
  });

  if (error) throw toError(error);
  if (!data) throw new Error('RPC create_kanban_card_attachment não retornou anexo');
  return data;
}

export async function deleteKanbanCardAttachment(attachmentId: string): Promise<CardAttachment> {
  const { data, error } = await rpcClient.rpc<CardAttachment>('delete_kanban_card_attachment', {
    _attachment_id: attachmentId,
  });

  if (error) throw toError(error);
  if (!data) throw new Error('RPC delete_kanban_card_attachment não retornou anexo');
  return data;
}
