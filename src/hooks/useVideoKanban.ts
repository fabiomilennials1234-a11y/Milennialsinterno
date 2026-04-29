import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, getRolesWithPageSlug } from '@/types/auth';
import { upsertKanbanBriefing } from '@/lib/kanbanBriefingOperations';

// ============================================
// TYPES
// ============================================

export interface VideoBriefing {
  id: string;
  card_id: string;
  script_url: string | null;
  observations: string | null;
  materials_url: string | null;
  reference_video_url: string | null;
  identity_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ============================================
// PERMISSION CONSTANTS
// ============================================

// Quem pode VER o Kanban de Editor de Vídeo.
// Derivado da matriz: união dos roles que declaram pageSlug 'editor-video' + execs.
export const VIDEO_BOARD_VIEWERS: UserRole[] = getRolesWithPageSlug('editor-video');

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewVideoBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return VIDEO_BOARD_VIEWERS.includes(role);
}

// ============================================
// VIDEO STATUS CONSTANTS
// ============================================

export const VIDEO_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-slate-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-blue-500' },
  { id: 'alteracao', label: 'ALTERAÇÃO', color: 'bg-orange-500' },
  { id: 'aguardando_aprovacao', label: 'AGUARDANDO APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovados', label: 'APROVADOS', color: 'bg-green-500' },
] as const;

export const VIDEO_STATUS_LABELS: Record<string, string> = {
  'a_fazer': 'A FAZER',
  'fazendo': 'FAZENDO',
  'alteracao': 'ALTERAÇÃO',
  'aguardando_aprovacao': 'AGUARDANDO APROVAÇÃO',
  'aprovados': 'APROVADOS',
};

// ============================================
// HOOKS - BRIEFING
// ============================================

export function useVideoBriefing(cardId: string | undefined) {
  return useQuery({
    queryKey: ['video-briefing', cardId],
    queryFn: async (): Promise<VideoBriefing | null> => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from('video_briefings')
        .select('*')
        .eq('card_id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!cardId,
  });
}

export function useUpsertVideoBriefing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<VideoBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      return upsertKanbanBriefing<VideoBriefing>(cardId, 'video', briefing);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['video-briefing', variables.cardId] });
    },
  });
}
