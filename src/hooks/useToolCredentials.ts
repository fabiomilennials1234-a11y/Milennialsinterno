// TODO: tabela tool_credentials criada em migration 20260420220000 (Track C.2)
// Até migration subir, hook retorna null + loga warn (UX degrada gracioso).
// Consumir: const { data, isLoading } = useToolCredential('make', 'login')
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ToolCredentialType = 'password' | 'token' | 'api_key' | 'login';

export interface ToolCredential {
  id: string;
  tool_name: string;
  credential_type: ToolCredentialType;
  credential_value: string;
  label?: string;
}

export function useToolCredential(
  toolName: string,
  credentialType: ToolCredentialType,
) {
  const { user } = useAuth();
  return useQuery<ToolCredential | null>({
    queryKey: ['tool-credentials', toolName, credentialType, user?.id],
    queryFn: async (): Promise<ToolCredential | null> => {
      if (!user?.id) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela tool_credentials ainda não está em Database types (Track C.2 pendente)
      const { data, error } = await (supabase as any)
        .from('tool_credentials')
        .select('id, tool_name, credential_type, credential_value, label')
        .eq('tool_name', toolName)
        .eq('credential_type', credentialType)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('[useToolCredential] lookup failed', {
          toolName,
          credentialType,
          error: error.message,
        });
        return null;
      }

      return (data as ToolCredential | null) ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
