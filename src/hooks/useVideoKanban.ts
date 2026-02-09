import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

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

// Quem pode VER o Kanban de Editor de Vídeo
export const VIDEO_BOARD_VIEWERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'editor_video',
];

// Quem pode CRIAR cards (mesmas permissões do Design)
export const VIDEO_CARD_CREATORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'editor_video',
  'sucesso_cliente',
];

// Quem pode ARQUIVAR e EXCLUIR cards
export const VIDEO_CARD_ARCHIVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'editor_video',
  'sucesso_cliente',
];

// Quem pode MOVER cards (drag and drop)
export const VIDEO_CARD_MOVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'editor_video',
  'sucesso_cliente',
];

// Quem pode EDITAR briefing
export const VIDEO_BRIEFING_EDITORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'editor_video',
  'sucesso_cliente',
];

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewVideoBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return VIDEO_BOARD_VIEWERS.includes(role);
}

export function canCreateVideoCard(role: UserRole | null): boolean {
  if (!role) return false;
  return VIDEO_CARD_CREATORS.includes(role);
}

export function canArchiveVideoCard(role: UserRole | null): boolean {
  if (!role) return false;
  return VIDEO_CARD_ARCHIVERS.includes(role);
}

export function canMoveVideoCard(role: UserRole | null): boolean {
  if (!role) return false;
  return VIDEO_CARD_MOVERS.includes(role);
}

export function canEditVideoBriefing(role: UserRole | null): boolean {
  if (!role) return false;
  return VIDEO_BRIEFING_EDITORS.includes(role);
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<VideoBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      // Check if briefing exists
      const { data: existing } = await supabase
        .from('video_briefings')
        .select('id')
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('video_briefings')
          .update(briefing)
          .eq('card_id', cardId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('video_briefings')
          .insert({
            card_id: cardId,
            ...briefing,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['video-briefing', variables.cardId] });
    },
  });
}
