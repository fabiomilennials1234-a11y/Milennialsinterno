import { supabase } from '@/integrations/supabase/client';
import { toError } from '@/lib/supabaseErrors';

type RpcError = { message: string };

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

export type KanbanActionPermissions = {
  canCreate: boolean;
  canMove: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canEditBriefing: boolean;
};

export const EMPTY_KANBAN_ACTION_PERMISSIONS: KanbanActionPermissions = {
  canCreate: false,
  canMove: false,
  canArchive: false,
  canDelete: false,
  canEditBriefing: false,
};

export function normalizeKanbanActionPermissions(
  value: Partial<KanbanActionPermissions> | null | undefined,
): KanbanActionPermissions {
  return {
    canCreate: value?.canCreate === true,
    canMove: value?.canMove === true,
    canArchive: value?.canArchive === true,
    canDelete: value?.canDelete === true,
    canEditBriefing: value?.canEditBriefing === true,
  };
}

export async function fetchKanbanActionPermissions(boardId: string): Promise<KanbanActionPermissions> {
  const { data, error } = await rpcClient.rpc<Partial<KanbanActionPermissions>>(
    'get_kanban_action_permissions',
    { _board_id: boardId },
  );

  if (error) throw toError(error);
  return normalizeKanbanActionPermissions(data);
}
