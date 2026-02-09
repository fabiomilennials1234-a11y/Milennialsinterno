import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

// ============================================
// TYPES
// ============================================

export interface ProdutoraBriefing {
  id: string;
  card_id: string;
  script_url: string | null;
  observations: string | null;
  reference_video_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ============================================
// PERMISSION CONSTANTS
// ============================================

// Quem pode VER o Kanban de Produtora (mesmas do Editor de Vídeo)
export const PRODUTORA_BOARD_VIEWERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'produtora',
  'editor_video',
];

// Quem pode CRIAR cards
export const PRODUTORA_CARD_CREATORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'produtora',
  'sucesso_cliente',
  'editor_video',
];

// Quem pode ARQUIVAR e EXCLUIR cards
export const PRODUTORA_CARD_ARCHIVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'produtora',
  'sucesso_cliente',
];

// Quem pode MOVER cards (drag and drop)
export const PRODUTORA_CARD_MOVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'produtora',
  'sucesso_cliente',
  'editor_video',
];

// Quem pode EDITAR briefing
export const PRODUTORA_BRIEFING_EDITORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'produtora',
  'sucesso_cliente',
];

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewProdutoraBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return PRODUTORA_BOARD_VIEWERS.includes(role);
}

export function canCreateProdutoraCard(role: UserRole | null): boolean {
  if (!role) return false;
  return PRODUTORA_CARD_CREATORS.includes(role);
}

export function canArchiveProdutoraCard(role: UserRole | null): boolean {
  if (!role) return false;
  return PRODUTORA_CARD_ARCHIVERS.includes(role);
}

export function canMoveProdutoraCard(role: UserRole | null): boolean {
  if (!role) return false;
  return PRODUTORA_CARD_MOVERS.includes(role);
}

export function canEditProdutoraBriefing(role: UserRole | null): boolean {
  if (!role) return false;
  return PRODUTORA_BRIEFING_EDITORS.includes(role);
}

// ============================================
// PRODUTORA STATUS CONSTANTS
// ============================================

export const PRODUTORA_STATUSES = [
  { id: 'a_gravar', label: 'A GRAVAR', color: 'bg-blue-500' },
  { id: 'gravando', label: 'GRAVANDO', color: 'bg-orange-500' },
  { id: 'problemas', label: 'PROBLEMAS!', color: 'bg-red-500' },
  { id: 'pos_producao', label: 'PÓS PRODUÇÃO', color: 'bg-purple-500' },
  { id: 'gravado', label: 'GRAVADO', color: 'bg-green-500' },
] as const;

export const PRODUTORA_STATUS_LABELS: Record<string, string> = {
  'a_gravar': 'A GRAVAR',
  'gravando': 'GRAVANDO',
  'problemas': 'PROBLEMAS!',
  'pos_producao': 'PÓS PRODUÇÃO',
  'gravado': 'GRAVADO',
};

// ============================================
// HOOKS - BRIEFING
// ============================================

export function useProdutoraBriefing(cardId: string | undefined) {
  return useQuery({
    queryKey: ['produtora-briefing', cardId],
    queryFn: async (): Promise<ProdutoraBriefing | null> => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from('produtora_briefings')
        .select('*')
        .eq('card_id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!cardId,
  });
}

export function useUpsertProdutoraBriefing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<ProdutoraBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      // Check if briefing exists
      const { data: existing } = await supabase
        .from('produtora_briefings')
        .select('id')
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('produtora_briefings')
          .update(briefing)
          .eq('card_id', cardId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('produtora_briefings')
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
      queryClient.invalidateQueries({ queryKey: ['produtora-briefing', variables.cardId] });
    },
  });
}
