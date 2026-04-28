import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ClientTagItem } from '@/components/client-tags/ClientTagsList';

export interface ClientTag extends ClientTagItem {
  client_id: string;
  source: string | null;
  created_at: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Sort: expiradas primeiro → <24h → <3d → ativas calmas → sem cronômetro.
 * Empate por `created_at` ASC (mais antiga primeiro).
 */
export function sortClientTags<T extends ClientTagItem & { created_at?: string }>(tags: T[]): T[] {
  const now = Date.now();
  const bucket = (t: T): number => {
    if (t.expired_at) return 0;
    if (!t.expires_at) return 4;
    const ms = new Date(t.expires_at).getTime() - now;
    if (ms <= 0) return 0;
    if (ms <= DAY_MS) return 1;
    if (ms <= 3 * DAY_MS) return 2;
    return 3;
  };
  return [...tags].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
}

/**
 * Tags ativas (não dismissed) de um único cliente. Use `useClientTagsBatch`
 * quando renderizar listas — evita N+1.
 */
export function useClientTags(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-tags', clientId],
    queryFn: async (): Promise<ClientTag[]> => {
      if (!clientId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('client_tags')
        .select('id, client_id, name, source, created_at, expires_at, expired_at, dismissed_at')
        .eq('client_id', clientId)
        .is('dismissed_at', null);
      if (error) throw error;
      return sortClientTags((data || []) as ClientTag[]);
    },
    enabled: !!clientId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Batch para listas de cards: 1 query .in('client_id', ids).
 * Retorna `Map<clientId, ClientTag[]>` já sorteado por client.
 */
export function useClientTagsBatch(clientIds: string[]) {
  // Chave estável: ordena para evitar refetch quando ordem muda mas conteúdo é igual.
  const sortedIds = [...clientIds].sort();
  const key = sortedIds.join(',');
  return useQuery({
    queryKey: ['client-tags-batch', key],
    queryFn: async (): Promise<Map<string, ClientTag[]>> => {
      if (sortedIds.length === 0) return new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('client_tags')
        .select('id, client_id, name, source, created_at, expires_at, expired_at, dismissed_at')
        .in('client_id', sortedIds)
        .is('dismissed_at', null);
      if (error) throw error;
      const map = new Map<string, ClientTag[]>();
      for (const id of sortedIds) map.set(id, []);
      for (const row of (data || []) as ClientTag[]) {
        const list = map.get(row.client_id);
        if (list) list.push(row);
      }
      // Sort per-client.
      for (const [k, v] of map.entries()) {
        map.set(k, sortClientTags(v));
      }
      return map;
    },
    enabled: sortedIds.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
