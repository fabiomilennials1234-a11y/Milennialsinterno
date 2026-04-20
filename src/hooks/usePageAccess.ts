import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Lê a lista ativa de page_slugs concedidos ao usuário logado via RPC
// get_my_page_access (definida em 20260420170000_user_page_grants).
//
// Retorno: string[] — slugs de app_pages. Admins (ceo/cto/gestor_projetos)
// não recebem '*' aqui; a RPC devolve apenas os grants explícitos em
// user_page_grants. Lógica de bypass continua sendo responsabilidade do
// caller (vide useAuth().isAdminUser).
export function usePageAccess() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['page-access', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_page_access');
      if (error) throw error;
      return (data ?? []) as string[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
