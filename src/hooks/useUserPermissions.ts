import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CapabilityCategory } from '@/types/permissions';

export interface AppCapabilityRow {
  key: string;
  label: string;
  category: CapabilityCategory;
  description: string | null;
  is_sensitive: boolean;
  default_roles: string[];
  position: number;
}

export interface UserCapabilityGrant {
  key: string;
  granted: boolean;
}

export interface UserActionOverride {
  page_slug: string;
  action: 'create' | 'move' | 'archive' | 'delete' | 'edit_briefing';
  granted: boolean;
}

export interface UserPermissionsState {
  page_grants: string[];
  capability_grants: UserCapabilityGrant[];
  action_overrides: UserActionOverride[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export function useAppCapabilities() {
  return useQuery({
    queryKey: ['app-capabilities'],
    queryFn: async (): Promise<AppCapabilityRow[]> => {
      const { data, error } = await sb
        .from('app_capabilities')
        .select('*')
        .order('category')
        .order('position');
      if (error) throw error;
      return (data || []) as AppCapabilityRow[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useUserPermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async (): Promise<UserPermissionsState> => {
      if (!userId) return { page_grants: [], capability_grants: [], action_overrides: [] };
      const { data, error } = await sb.rpc('get_user_permissions', { _target_user: userId });
      if (error) throw error;
      return (data || { page_grants: [], capability_grants: [], action_overrides: [] }) as UserPermissionsState;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useSetUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      capabilityGrants: UserCapabilityGrant[];
      actionOverrides: UserActionOverride[];
    }) => {
      const { error } = await sb.rpc('set_user_permissions', {
        _target_user: input.userId,
        _capability_grants: input.capabilityGrants,
        _action_overrides: input.actionOverrides,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
