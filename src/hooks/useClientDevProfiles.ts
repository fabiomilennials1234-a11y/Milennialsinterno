import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TYPES
// ============================================

export interface ClientDevProfile {
  id: string;
  client_id: string;
  frontend_stack: string | null;
  css_framework: string | null;
  cms_platform: string | null;
  hosting_provider: string | null;
  domain: string | null;
  staging_url: string | null;
  repository_url: string | null;
  figma_url: string | null;
  analytics_id: string | null;
  api_docs_url: string | null;
  deploy_notes: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientWithDevProfile {
  id: string;
  name: string;
  razao_social: string | null;
  profile: ClientDevProfile | null;
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetches all active clients joined with their dev profiles.
 * Two queries (clients + profiles) joined in memory.
 */
export function useClientDevProfiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-dev-profiles'],
    queryFn: async (): Promise<ClientWithDevProfile[]> => {
      const [clientsResult, profilesResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, razao_social')
          .eq('archived', false)
          .order('name'),
        supabase
          .from('client_dev_profiles')
          .select('id, client_id, frontend_stack, css_framework, cms_platform, hosting_provider, domain, staging_url, repository_url, figma_url, analytics_id, api_docs_url, deploy_notes, notes, created_by, created_at, updated_at'),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profilesByClientId = new Map<string, ClientDevProfile>();
      for (const p of profilesResult.data ?? []) {
        profilesByClientId.set(p.client_id, p as ClientDevProfile);
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
 * Fetches a single dev profile by client_id.
 */
export function useClientDevProfile(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-dev-profile', clientId],
    queryFn: async (): Promise<ClientDevProfile | null> => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('client_dev_profiles')
        .select('id, client_id, frontend_stack, css_framework, cms_platform, hosting_provider, domain, staging_url, repository_url, figma_url, analytics_id, api_docs_url, deploy_notes, notes, created_by, created_at, updated_at')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientDevProfile | null;
    },
    enabled: !!clientId,
  });
}

/**
 * Upserts a dev profile via RPC `upsert_client_dev_profile`.
 * Invalidates both list and single query keys on success.
 */
export function useUpsertClientDevProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      frontendStack?: string | null;
      cssFramework?: string | null;
      cmsPlatform?: string | null;
      hostingProvider?: string | null;
      domain?: string | null;
      stagingUrl?: string | null;
      repositoryUrl?: string | null;
      figmaUrl?: string | null;
      analyticsId?: string | null;
      apiDocsUrl?: string | null;
      deployNotes?: string | null;
      notes?: string | null;
    }): Promise<string> => {
      const { data, error } = await (supabase.rpc as any)(
        'upsert_client_dev_profile',
        {
          p_client_id: params.clientId,
          p_frontend_stack: params.frontendStack ?? undefined,
          p_css_framework: params.cssFramework ?? undefined,
          p_cms_platform: params.cmsPlatform ?? undefined,
          p_hosting_provider: params.hostingProvider ?? undefined,
          p_domain: params.domain ?? undefined,
          p_staging_url: params.stagingUrl ?? undefined,
          p_repository_url: params.repositoryUrl ?? undefined,
          p_figma_url: params.figmaUrl ?? undefined,
          p_analytics_id: params.analyticsId ?? undefined,
          p_api_docs_url: params.apiDocsUrl ?? undefined,
          p_deploy_notes: params.deployNotes ?? undefined,
          p_notes: params.notes ?? undefined,
        },
      );

      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-dev-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['client-dev-profile', variables.clientId] });
    },
  });
}
