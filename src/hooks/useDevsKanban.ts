import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';
import { upsertKanbanBriefing } from '@/lib/kanbanBriefingOperations';

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
  'outbound',
  'sucesso_cliente',
  'devs',
];

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewDevBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return DEV_BOARD_VIEWERS.includes(role);
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

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<DevBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      return upsertKanbanBriefing<DevBriefing>(cardId, 'dev', briefing);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dev-briefing', variables.cardId] });
    },
  });
}
