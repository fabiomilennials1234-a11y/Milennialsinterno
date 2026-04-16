import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TechProfile {
  user_id: string;
  name: string;
}

export function useTechProfiles() {
  return useQuery<TechProfile[]>({
    queryKey: ['tech', 'profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000, // profiles change rarely
  });
}

/** Get a name lookup map from the profiles query (memoised) */
export function useProfileMap(): Record<string, string> {
  const { data } = useTechProfiles();
  return useMemo(() => {
    if (!data) return {};
    const map: Record<string, string> = {};
    for (const p of data) {
      map[p.user_id] = p.name;
    }
    return map;
  }, [data]);
}

/** Extract initials from a name: "Gabriel Gipp" → "GG" */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
