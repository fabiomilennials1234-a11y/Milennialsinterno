import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TYPES
// ============================================

export interface ClientDesignProfile {
  id: string;
  client_id: string;
  brand_colors: string | null;
  typography: string | null;
  visual_style: string | null;
  brand_manual_url: string | null;
  logo_url: string | null;
  instagram_handle: string | null;
  website_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientWithDesignProfile {
  id: string;
  name: string;
  razao_social: string | null;
  profile: ClientDesignProfile | null;
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetches all active clients joined with their design profiles.
 * Two queries (clients + profiles) joined in memory.
 */
export function useClientDesignProfiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-design-profiles'],
    queryFn: async (): Promise<ClientWithDesignProfile[]> => {
      const [clientsResult, profilesResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, razao_social')
          .eq('archived', false)
          .order('name'),
        supabase
          .from('client_design_profiles')
          .select('id, client_id, brand_colors, typography, visual_style, brand_manual_url, logo_url, instagram_handle, website_url, notes, created_by, created_at, updated_at'),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profilesByClientId = new Map<string, ClientDesignProfile>();
      for (const p of profilesResult.data ?? []) {
        profilesByClientId.set(p.client_id, p as ClientDesignProfile);
      }

      return (clientsResult.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        razao_social: c.razao_social,
        profile: profilesByClientId.get(c.id) ?? null,
      }));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetches a single design profile by client_id.
 */
export function useClientDesignProfile(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-design-profile', clientId],
    queryFn: async (): Promise<ClientDesignProfile | null> => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('client_design_profiles')
        .select('id, client_id, brand_colors, typography, visual_style, brand_manual_url, logo_url, instagram_handle, website_url, notes, created_by, created_at, updated_at')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientDesignProfile | null;
    },
    enabled: !!clientId,
  });
}

/**
 * Upserts a design profile via RPC `upsert_client_design_profile`.
 * Invalidates both list and single query keys on success.
 */
export function useUpsertClientDesignProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      brandColors?: string | null;
      typography?: string | null;
      visualStyle?: string | null;
      brandManualUrl?: string | null;
      logoUrl?: string | null;
      instagramHandle?: string | null;
      websiteUrl?: string | null;
      notes?: string | null;
    }): Promise<string> => {
      const { data, error } = await (supabase.rpc as any)(
        'upsert_client_design_profile',
        {
          p_client_id: params.clientId,
          p_brand_colors: params.brandColors ?? undefined,
          p_typography: params.typography ?? undefined,
          p_visual_style: params.visualStyle ?? undefined,
          p_brand_manual_url: params.brandManualUrl ?? undefined,
          p_logo_url: params.logoUrl ?? undefined,
          p_instagram_handle: params.instagramHandle ?? undefined,
          p_website_url: params.websiteUrl ?? undefined,
          p_notes: params.notes ?? undefined,
        },
      );

      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-design-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['client-design-profile', variables.clientId] });
    },
  });
}
