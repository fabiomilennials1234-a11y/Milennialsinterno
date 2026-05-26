import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TYPES
// ============================================

export interface ClientInfoBankProfile {
  id: string;
  client_id: string;
  // Marca
  brand_colors: string | null;
  typography: string | null;
  visual_style: string | null;
  brand_manual_url: string | null;
  logo_url: string | null;
  // Presenca Digital
  website_url: string | null;
  instagram_handle: string | null;
  youtube_channel: string | null;
  tiktok_handle: string | null;
  domain: string | null;
  // Video
  editing_style: string | null;
  video_formats: string | null;
  // Dev
  cms_platform: string | null;
  figma_url: string | null;
  // Geral
  notes: string | null;
  // Control
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientWithInfoBank {
  id: string;
  name: string;
  razao_social: string | null;
  profile: ClientInfoBankProfile | null;
}

// ============================================
// FIELD DEFINITIONS (shared by hook, modal, tab)
// ============================================

export interface InfoBankFieldDef {
  key: keyof Omit<ClientInfoBankProfile, 'id' | 'client_id' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'>;
  label: string;
  section: 'marca' | 'presenca_digital' | 'video' | 'dev' | 'geral';
  type: 'text' | 'url' | 'textarea';
  placeholder: string;
}

export const INFO_BANK_FIELDS: InfoBankFieldDef[] = [
  // Marca
  { key: 'brand_colors', label: 'Cores da marca', section: 'marca', type: 'text', placeholder: '#FF5500, #1A1A2E, #FAFAFA...' },
  { key: 'typography', label: 'Tipografia', section: 'marca', type: 'text', placeholder: 'Montserrat (titulos), Inter (corpo)...' },
  { key: 'visual_style', label: 'Estilo visual / Referencias', section: 'marca', type: 'text', placeholder: 'Minimalista, cores vibrantes, foto-realista...' },
  { key: 'brand_manual_url', label: 'Manual de marca (link)', section: 'marca', type: 'url', placeholder: 'https://drive.google.com/...' },
  { key: 'logo_url', label: 'Logo (link)', section: 'marca', type: 'url', placeholder: 'https://drive.google.com/...' },
  // Presenca Digital
  { key: 'website_url', label: 'Website', section: 'presenca_digital', type: 'url', placeholder: 'https://www.cliente.com.br' },
  { key: 'instagram_handle', label: '@ Instagram', section: 'presenca_digital', type: 'text', placeholder: '@cliente' },
  { key: 'youtube_channel', label: 'Canal YouTube', section: 'presenca_digital', type: 'url', placeholder: 'https://youtube.com/@canal' },
  { key: 'tiktok_handle', label: '@ TikTok', section: 'presenca_digital', type: 'text', placeholder: '@cliente' },
  { key: 'domain', label: 'Dominio', section: 'presenca_digital', type: 'text', placeholder: 'cliente.com.br' },
  // Video
  { key: 'editing_style', label: 'Estilo de edicao', section: 'video', type: 'text', placeholder: 'Cinematico, dinamico, clean...' },
  { key: 'video_formats', label: 'Formatos de video', section: 'video', type: 'text', placeholder: 'Reels, YouTube, Stories, TikTok...' },
  // Dev
  { key: 'cms_platform', label: 'CMS / Plataforma', section: 'dev', type: 'text', placeholder: 'WordPress, Shopify, custom...' },
  { key: 'figma_url', label: 'Figma (link)', section: 'dev', type: 'url', placeholder: 'https://figma.com/file/...' },
  // Geral
  { key: 'notes', label: 'Observacoes gerais', section: 'geral', type: 'textarea', placeholder: 'Preferencias especiais, restricoes, contexto adicional...' },
];

export const INFO_BANK_SECTIONS = [
  { key: 'marca', label: 'Marca' },
  { key: 'presenca_digital', label: 'Presenca Digital' },
  { key: 'video', label: 'Video' },
  { key: 'dev', label: 'Desenvolvimento' },
  { key: 'geral', label: 'Geral' },
] as const;

// ============================================
// SELECT COLUMNS (shared constant)
// ============================================

const SELECT_COLS = 'id, client_id, brand_colors, typography, visual_style, brand_manual_url, logo_url, website_url, instagram_handle, youtube_channel, tiktok_handle, domain, editing_style, video_formats, cms_platform, figma_url, notes, created_by, updated_by, created_at, updated_at';

// ============================================
// HOOKS
// ============================================

/**
 * Fetches all active clients joined with their unified info bank profiles.
 * Two queries (clients + profiles) joined in memory.
 */
export function useClientInfoBanks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-info-bank'],
    queryFn: async (): Promise<ClientWithInfoBank[]> => {
      const [clientsResult, profilesResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, razao_social')
          .eq('archived', false)
          .order('name'),
        (supabase.from as any)('client_info_bank')
          .select(SELECT_COLS),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profilesByClientId = new Map<string, ClientInfoBankProfile>();
      for (const p of (profilesResult.data ?? []) as ClientInfoBankProfile[]) {
        profilesByClientId.set(p.client_id, p);
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
 * Fetches a single info bank profile by client_id.
 */
export function useClientInfoBank(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-info-bank', clientId],
    queryFn: async (): Promise<ClientInfoBankProfile | null> => {
      if (!clientId) return null;

      const { data, error } = await (supabase.from as any)('client_info_bank')
        .select(SELECT_COLS)
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientInfoBankProfile | null;
    },
    enabled: !!clientId,
  });
}

/**
 * Upserts an info bank profile via RPC `upsert_client_info_bank`.
 * Invalidates both list and single query keys on success.
 */
export function useUpsertClientInfoBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      brandColors?: string | null;
      typography?: string | null;
      visualStyle?: string | null;
      brandManualUrl?: string | null;
      logoUrl?: string | null;
      websiteUrl?: string | null;
      instagramHandle?: string | null;
      youtubeChannel?: string | null;
      tiktokHandle?: string | null;
      domain?: string | null;
      editingStyle?: string | null;
      videoFormats?: string | null;
      cmsPlatform?: string | null;
      figmaUrl?: string | null;
      notes?: string | null;
    }): Promise<string> => {
      const { data, error } = await (supabase.rpc as any)(
        'upsert_client_info_bank',
        {
          p_client_id: params.clientId,
          p_brand_colors: params.brandColors ?? undefined,
          p_typography: params.typography ?? undefined,
          p_visual_style: params.visualStyle ?? undefined,
          p_brand_manual_url: params.brandManualUrl ?? undefined,
          p_logo_url: params.logoUrl ?? undefined,
          p_website_url: params.websiteUrl ?? undefined,
          p_instagram_handle: params.instagramHandle ?? undefined,
          p_youtube_channel: params.youtubeChannel ?? undefined,
          p_tiktok_handle: params.tiktokHandle ?? undefined,
          p_domain: params.domain ?? undefined,
          p_editing_style: params.editingStyle ?? undefined,
          p_video_formats: params.videoFormats ?? undefined,
          p_cms_platform: params.cmsPlatform ?? undefined,
          p_figma_url: params.figmaUrl ?? undefined,
          p_notes: params.notes ?? undefined,
        },
      );

      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-info-bank'] });
      queryClient.invalidateQueries({ queryKey: ['client-info-bank', variables.clientId] });
    },
  });
}

/**
 * Batch check which client_ids have a client_info_bank record.
 * Returns a Set of client_ids that have records.
 * Used by GP onboarding to show gate status.
 */
export function useClientInfoBankExists(clientIds: string[]) {
  return useQuery({
    queryKey: ['client-info-bank-exists', ...clientIds.sort()],
    queryFn: async (): Promise<Set<string>> => {
      if (clientIds.length === 0) return new Set();

      const { data, error } = await (supabase.from as any)('client_info_bank')
        .select('client_id')
        .in('client_id', clientIds);

      if (error) throw error;

      return new Set(
        ((data ?? []) as Array<{ client_id: string }>).map((r) => r.client_id)
      );
    },
    enabled: clientIds.length > 0,
    staleTime: 30 * 1000,
  });
}
