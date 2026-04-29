import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Listener global de realtime: assina mudanças em qualquer tabela do schema
 * public e invalida queries ativas do React Query a cada evento.
 *
 * Resultado: toda página vira realtime sem precisar montar listener por hook.
 *
 * Custo: cada evento dispara `invalidateQueries()` global, que refaz fetch
 * apenas das queries ATIVAS observadas. Queries inativas (já desmontadas) são
 * ignoradas. Em prática: refetch das listas que o user está vendo.
 *
 * Throttle: agrupamos invalidations em window de 250ms para evitar refetch
 * em rajada quando muitos eventos chegam (ex: bulk insert).
 */
export function useGlobalRealtime() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTablesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const flushInvalidations = () => {
      if (pendingTablesRef.current.size === 0) return;
      pendingTablesRef.current.clear();
      // Brute-force mas eficaz: invalida tudo. React Query só refetcha queries
      // ativas observadas (componentes montados).
      void queryClient.invalidateQueries();
    };

    const queueInvalidation = (table: string) => {
      pendingTablesRef.current.add(table);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushInvalidations, 250);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabase;
    const channel = sb
      .channel(`global-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const table = payload?.table;
          if (typeof table === 'string') {
            queueInvalidation(table);
          }
        },
      )
      .subscribe();

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingTablesRef.current.clear();
      void sb.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, queryClient]);
}
