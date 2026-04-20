import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lookup booleano de feature flag via RPC `public.is_feature_enabled`.
 *
 * Regra de rollout no DB:
 *   - row em `feature_flags` com `enabled=true` → ligado p/ todos
 *   - row com `enabled=false` e `allowed_users` contendo user_id → ligado só p/ aquele user
 *   - row ausente ou erro de lookup → `false` (fail-closed)
 *
 * Cache de 5min via React Query — evita flip-flop e reduz carga no DB.
 */
export function useFeatureFlag(key: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['feature-flag', key, user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;
      // RPC ainda não presente nos types gerados (db-specialist bloqueado por DB password).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('is_feature_enabled', {
        _key: key,
        _user_id: user.id,
      });
      if (error) {
        console.warn('[useFeatureFlag] lookup failed', { key, error: error.message });
        return false;
      }
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
