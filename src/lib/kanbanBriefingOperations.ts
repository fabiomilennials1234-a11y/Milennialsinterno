import { supabase } from '@/integrations/supabase/client';

type RpcError = { message: string };

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

export type KanbanBriefingType = 'design' | 'video' | 'dev' | 'produtora' | 'atrizes';
export type KanbanBriefingPayload = Record<string, string | null | undefined>;

export async function upsertKanbanBriefing<T>(
  cardId: string,
  briefingType: KanbanBriefingType,
  payload: KanbanBriefingPayload,
): Promise<T> {
  const { data, error } = await rpcClient.rpc<T>('upsert_kanban_briefing', {
    _card_id: cardId,
    _briefing_type: briefingType,
    _payload: payload,
  });

  if (error) throw error;
  if (!data) throw new Error('RPC upsert_kanban_briefing não retornou briefing');
  return data;
}
