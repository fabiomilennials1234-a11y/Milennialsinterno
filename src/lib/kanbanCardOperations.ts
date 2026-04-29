import { supabase } from '@/integrations/supabase/client';
import type { KanbanCard } from '@/hooks/useKanban';

type RpcError = { message: string };
type RpcResponse<T> = Promise<{ data: T | null; error: RpcError | null }>;

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => RpcResponse<T>;
};

const rpcClient = supabase as unknown as RpcClient;

export type CreateKanbanCardInput = {
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  tags?: string[] | null;
  status?: string | null;
  cardType?: string | null;
  clientId?: string | null;
};

export async function createKanbanCard(input: CreateKanbanCardInput): Promise<KanbanCard> {
  const { data, error } = await rpcClient.rpc<KanbanCard>('kanban_create_card', {
    _board_id: input.boardId,
    _column_id: input.columnId,
    _title: input.title,
    _description: input.description ?? null,
    _priority: input.priority ?? 'medium',
    _due_date: input.dueDate ?? null,
    _assigned_to: input.assignedTo ?? null,
    _tags: input.tags ?? null,
    _status: input.status ?? null,
    _card_type: input.cardType ?? null,
    _client_id: input.clientId ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('RPC kanban_create_card não retornou card');
  return data;
}

export async function moveKanbanCard(input: {
  cardId: string;
  destinationColumnId: string;
  newPosition: number;
  destinationStatus?: string | null;
}): Promise<KanbanCard> {
  const { data, error } = await rpcClient.rpc<KanbanCard>('kanban_move_card', {
    _card_id: input.cardId,
    _destination_column_id: input.destinationColumnId,
    _new_position: input.newPosition,
    _destination_status: input.destinationStatus ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('RPC kanban_move_card não retornou card');
  return data;
}

export async function archiveKanbanCard(cardId: string): Promise<KanbanCard> {
  const { data, error } = await rpcClient.rpc<KanbanCard>('kanban_archive_card', {
    _card_id: cardId,
  });

  if (error) throw error;
  if (!data) throw new Error('RPC kanban_archive_card não retornou card');
  return data;
}

export async function deleteKanbanCard(cardId: string): Promise<string> {
  const { data, error } = await rpcClient.rpc<string>('kanban_delete_card', {
    _card_id: cardId,
  });

  if (error) throw error;
  return data ?? cardId;
}
