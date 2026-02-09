import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

// ============================================
// TYPES
// ============================================

export interface DevBriefing {
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

// Quem pode VER o Kanban de Desenvolvedor
export const DEV_BOARD_VIEWERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'devs',
];

// Quem pode CRIAR cards
export const DEV_CARD_CREATORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'devs',
  'sucesso_cliente',
];

// Quem pode ARQUIVAR e EXCLUIR cards
export const DEV_CARD_ARCHIVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'devs',
  'sucesso_cliente',
];

// Quem pode MOVER cards (drag and drop)
export const DEV_CARD_MOVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'devs',
  'sucesso_cliente',
];

// Quem pode EDITAR briefing
export const DEV_BRIEFING_EDITORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'devs',
  'sucesso_cliente',
];

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewDevBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return DEV_BOARD_VIEWERS.includes(role);
}

export function canCreateDevCard(role: UserRole | null): boolean {
  if (!role) return false;
  return DEV_CARD_CREATORS.includes(role);
}

export function canArchiveDevCard(role: UserRole | null): boolean {
  if (!role) return false;
  return DEV_CARD_ARCHIVERS.includes(role);
}

export function canMoveDevCard(role: UserRole | null): boolean {
  if (!role) return false;
  return DEV_CARD_MOVERS.includes(role);
}

export function canEditDevBriefing(role: UserRole | null): boolean {
  if (!role) return false;
  return DEV_BRIEFING_EDITORS.includes(role);
}

// ============================================
// DEV STATUS CONSTANTS
// ============================================

export const DEV_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-slate-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-blue-500' },
  { id: 'alteracao', label: 'ALTERAÇÃO', color: 'bg-orange-500' },
  { id: 'aguardando_aprovacao', label: 'AGUARDANDO APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovados', label: 'APROVADOS', color: 'bg-green-500' },
] as const;

export const DEV_STATUS_LABELS: Record<string, string> = {
  'a_fazer': 'A FAZER',
  'fazendo': 'FAZENDO',
  'alteracao': 'ALTERAÇÃO',
  'aguardando_aprovacao': 'AGUARDANDO APROVAÇÃO',
  'aprovados': 'APROVADOS',
};

// ============================================
// HOOKS - BRIEFING
// ============================================

export function useDevBriefing(cardId: string | undefined) {
  return useQuery({
    queryKey: ['dev-briefing', cardId],
    queryFn: async (): Promise<DevBriefing | null> => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from('dev_briefings')
        .select('*')
        .eq('card_id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!cardId,
  });
}

export function useUpsertDevBriefing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<DevBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      // Check if briefing exists
      const { data: existing } = await supabase
        .from('dev_briefings')
        .select('id')
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('dev_briefings')
          .update(briefing)
          .eq('card_id', cardId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('dev_briefings')
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
      queryClient.invalidateQueries({ queryKey: ['dev-briefing', variables.cardId] });
    },
  });
}
