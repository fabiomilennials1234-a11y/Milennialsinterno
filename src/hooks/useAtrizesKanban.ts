import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, getRolesWithPageSlug } from '@/types/auth';
import { upsertKanbanBriefing } from '@/lib/kanbanBriefingOperations';

// ============================================
// TYPES
// ============================================

export interface AtrizesBriefing {
  id: string;
  card_id: string;
  client_instagram: string | null;
  script_url: string | null;
  drive_upload_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ============================================
// PERMISSION CONSTANTS
// ============================================

// Quem pode VER o Kanban de Atrizes de Gravação.
// Derivado da matriz: união dos roles que declaram pageSlug 'atrizes-gravacao' + execs.
export const ATRIZES_BOARD_VIEWERS: UserRole[] = getRolesWithPageSlug('atrizes-gravacao');

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewAtrizesBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return ATRIZES_BOARD_VIEWERS.includes(role);
}

// ============================================
// ATRIZES STATUS CONSTANTS
// ============================================

export const ATRIZES_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-slate-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-blue-500' },
  { id: 'alteracao', label: 'ALTERAÇÃO', color: 'bg-orange-500' },
  { id: 'aguardando_aprovacao', label: 'AGUARDANDO APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovados', label: 'APROVADOS', color: 'bg-green-500' },
] as const;

export const ATRIZES_STATUS_LABELS: Record<string, string> = {
  'a_fazer': 'A FAZER',
  'fazendo': 'FAZENDO',
  'alteracao': 'ALTERAÇÃO',
  'aguardando_aprovacao': 'AGUARDANDO APROVAÇÃO',
  'aprovados': 'APROVADOS',
};

// ============================================
// HOOKS - BRIEFING (using raw SQL until types regenerate)
// ============================================

export function useAtrizesBriefing(cardId: string | undefined) {
  return useQuery({
    queryKey: ['atrizes-briefing', cardId],
    queryFn: async (): Promise<AtrizesBriefing | null> => {
      if (!cardId) return null;

      // Use raw query since types may not be regenerated yet
      const { data, error } = await supabase
        .from('atrizes_briefings')
        .select('*')
        .eq('card_id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as AtrizesBriefing | null;
    },
    enabled: !!cardId,
  });
}

export function useUpsertAtrizesBriefing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<AtrizesBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      return upsertKanbanBriefing<AtrizesBriefing>(cardId, 'atrizes', briefing);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['atrizes-briefing', variables.cardId] });
    },
  });
}
