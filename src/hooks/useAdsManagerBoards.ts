import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdsManagerBoard {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  owner_name: string;
  squad_id: string | null;
}

/**
 * Fetch all individual ADS manager boards (one per gestor_ads)
 */
export function useAdsManagerBoards() {
  return useQuery({
    queryKey: ['ads-manager-boards'],
    queryFn: async (): Promise<AdsManagerBoard[]> => {
      // Get all boards with owner_user_id (individual manager boards)
      const { data: boards, error: boardsError } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, owner_user_id, squad_id')
        .not('owner_user_id', 'is', null)
        .order('name', { ascending: true });

      if (boardsError) throw boardsError;
      if (!boards || boards.length === 0) return [];

      // Get owner profiles
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
        owner_name: profileMap.get(b.owner_user_id!) || 'Gestor',
        squad_id: b.squad_id,
      }));
    },
  });
}

/**
 * Get the individual board for a specific user
 */
export function useMyAdsBoard(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-ads-board', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, owner_user_id, squad_id')
        .eq('owner_user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Ensure a board exists for a gestor_ads user, create if not
 */
export async function ensureAdsManagerBoard(userId: string, userName: string, squadId: string | null) {
  // Check if board exists
  const { data: existing } = await supabase
    .from('kanban_boards')
    .select('id')
    .eq('owner_user_id', userId)
    .single();

  if (existing) return existing.id;

  // Create new board
  const { data: newBoard, error } = await supabase
    .from('kanban_boards')
    .insert({
      name: `Gestor de ADS (${userName})`,
      slug: `ads-${userId}`,
      description: `Kanban individual do Gestor de ADS ${userName}`,
      owner_user_id: userId,
      squad_id: squadId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newBoard?.id;
}
