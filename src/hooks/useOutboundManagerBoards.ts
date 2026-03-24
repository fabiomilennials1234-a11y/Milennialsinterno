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
 * Fetch all individual Outbound manager boards (one per outbound user).
 * Queries user_roles directly so boards appear as soon as the role exists,
 * without requiring a manual kanban_boards entry.
 */
export function useOutboundManagerBoards() {
  return useQuery({
    queryKey: ['outbound-manager-boards'],
    queryFn: async (): Promise<OutboundManagerBoard[]> => {
      // Buscar todos os usuários com cargo outbound
      const { data: outboundRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'outbound');

      if (rolesError) throw rolesError;
      if (!outboundRoles || outboundRoles.length === 0) return [];

      const userIds = outboundRoles.map(r => r.user_id);

      // Buscar perfis para nomes e squad_id
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, squad_id')
        .in('user_id', userIds);

      if (!profiles || profiles.length === 0) return [];

      return profiles.map(p => ({
        id: p.user_id,
        name: `Outbound (${p.name})`,
        slug: `outbound-${p.user_id}`,
        owner_user_id: p.user_id,
        owner_name: p.name,
        squad_id: p.squad_id,
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
