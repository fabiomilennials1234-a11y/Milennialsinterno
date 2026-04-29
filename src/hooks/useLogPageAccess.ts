import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

/**
 * Registra acesso autorizado a uma página via RPC `log_page_access`.
 * Idempotente em janela de 5 min (RPC dedupa).
 */
export function useLogPageAccess(pageSlug: string | null | undefined) {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !pageSlug) return;
    void sb.rpc('log_page_access', { _page_slug: pageSlug });
  }, [isAuthenticated, user?.id, pageSlug]);
}
