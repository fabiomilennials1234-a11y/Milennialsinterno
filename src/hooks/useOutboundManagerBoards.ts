import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OutboundManagerBoard {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  owner_name: string;
  squad_id: string | null;
}

/**
 * Fetch all individual Outbound manager boards (one per outbound user)
 */
export function useOutboundManagerBoards() {
  return useQuery({
    queryKey: ['outbound-manager-boards'],
    queryFn: async (): Promise<OutboundManagerBoard[]> => {
      const { data: boards, error: boardsError } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, owner_user_id, squad_id')
        .not('owner_user_id', 'is', null)
        .like('slug', 'outbound-%')
        .order('name', { ascending: true });

      if (boardsError) throw boardsError;
      if (!boards || boards.length === 0) return [];

      const ownerIds = boards.map(b => b.owner_user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      return boards.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        owner_user_id: b.owner_user_id!,
        owner_name: profileMap.get(b.owner_user_id!) || 'Outbound',
        squad_id: b.squad_id,
      }));
    },
  });
}

/**
 * Get the individual board for a specific outbound user
 */
export function useMyOutboundBoard(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-outbound-board', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, owner_user_id, squad_id')
        .eq('owner_user_id', userId)
        .like('slug', 'outbound-%')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Ensure a board exists for an outbound user, create if not
 */
export async function ensureOutboundManagerBoard(userId: string, userName: string, squadId: string | null) {
  const { data: existing } = await supabase
    .from('kanban_boards')
    .select('id')
    .eq('owner_user_id', userId)
    .like('slug', 'outbound-%')
    .single();

  if (existing) return existing.id;

  const { data: newBoard, error } = await supabase
    .from('kanban_boards')
    .insert({
      name: `Outbound (${userName})`,
      slug: `outbound-${userId}`,
      description: `Kanban individual do Outbound ${userName}`,
      owner_user_id: userId,
      squad_id: squadId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newBoard?.id;
}
