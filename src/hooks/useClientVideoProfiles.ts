import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TYPES
// ============================================

export interface ClientVideoProfile {
  id: string;
  client_id: string;
  editing_style: string | null;
  video_format: string | null;
  resolution: string | null;
  youtube_channel: string | null;
  tiktok_handle: string | null;
  instagram_handle: string | null;
  pacing: string | null;
  music_style: string | null;
  intro_outro_url: string | null;
  reference_urls: string | null;
  brand_assets_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientWithVideoProfile {
  id: string;
  name: string;
  razao_social: string | null;
  profile: ClientVideoProfile | null;
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetches all active clients joined with their video profiles.
 * Two queries (clients + profiles) joined in memory.
 */
export function useClientVideoProfiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-video-profiles'],
    queryFn: async (): Promise<ClientWithVideoProfile[]> => {
      const [clientsResult, profilesResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, razao_social')
          .eq('archived', false)
          .order('name'),
        supabase
          .from('client_video_profiles')
          .select('id, client_id, editing_style, video_format, resolution, youtube_channel, tiktok_handle, instagram_handle, pacing, music_style, intro_outro_url, reference_urls, brand_assets_url, notes, created_by, created_at, updated_at'),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profilesByClientId = new Map<string, ClientVideoProfile>();
      for (const p of profilesResult.data ?? []) {
        profilesByClientId.set(p.client_id, p as ClientVideoProfile);
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
 * Fetches a single video profile by client_id.
 */
export function useClientVideoProfile(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-video-profile', clientId],
    queryFn: async (): Promise<ClientVideoProfile | null> => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('client_video_profiles')
        .select('id, client_id, editing_style, video_format, resolution, youtube_channel, tiktok_handle, instagram_handle, pacing, music_style, intro_outro_url, reference_urls, brand_assets_url, notes, created_by, created_at, updated_at')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientVideoProfile | null;
    },
    enabled: !!clientId,
  });
}

/**
 * Upserts a video profile via RPC `upsert_client_video_profile`.
 * Invalidates both list and single query keys on success.
 */
export function useUpsertClientVideoProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      editingStyle?: string | null;
      videoFormat?: string | null;
      resolution?: string | null;
      youtubeChannel?: string | null;
      tiktokHandle?: string | null;
      instagramHandle?: string | null;
      pacing?: string | null;
      musicStyle?: string | null;
      introOutroUrl?: string | null;
      referenceUrls?: string | null;
      brandAssetsUrl?: string | null;
      notes?: string | null;
    }): Promise<string> => {
      const { data, error } = await (supabase.rpc as any)(
        'upsert_client_video_profile',
        {
          p_client_id: params.clientId,
          p_editing_style: params.editingStyle ?? undefined,
          p_video_format: params.videoFormat ?? undefined,
          p_resolution: params.resolution ?? undefined,
          p_youtube_channel: params.youtubeChannel ?? undefined,
          p_tiktok_handle: params.tiktokHandle ?? undefined,
          p_instagram_handle: params.instagramHandle ?? undefined,
          p_pacing: params.pacing ?? undefined,
          p_music_style: params.musicStyle ?? undefined,
          p_intro_outro_url: params.introOutroUrl ?? undefined,
          p_reference_urls: params.referenceUrls ?? undefined,
          p_brand_assets_url: params.brandAssetsUrl ?? undefined,
          p_notes: params.notes ?? undefined,
        },
      );

      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-video-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['client-video-profile', variables.clientId] });
    },
  });
}
