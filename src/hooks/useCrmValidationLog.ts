import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================================
// Hook: useCrmValidationLog
//
// Fetches the full audit trail for a single CRM config.
// Used by CrmValidationHistory (7.4) and CrmTimeline (7.6).
// =============================================================

export interface ValidationLogEntry {
  id: string;
  config_id: string;
  step_key: string;
  action: string;
  details: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
  /** Joined from profiles */
  performer_name?: string;
}

/**
 * Fetches all validation log entries for a config, newest first.
 * Joins profiles to get performer name.
 */
export function useCrmValidationLog(configId: string | undefined) {
  return useQuery({
    queryKey: ['crm-validation-log', configId],
    queryFn: async (): Promise<ValidationLogEntry[]> => {
      if (!configId) return [];

      // Fetch logs
      const { data: logs, error } = await (supabase as any)
        .from('crm_validation_log')
        .select('*')
        .eq('config_id', configId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!logs || logs.length === 0) return [];

      // Collect unique performer IDs
      const performerIds = [...new Set(
        (logs as ValidationLogEntry[])
          .map(l => l.performed_by)
          .filter(Boolean) as string[]
      )];

      // Fetch names
      const nameMap = new Map<string, string>();
      if (performerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', performerIds);

        if (profiles) {
          for (const p of profiles) {
            nameMap.set(p.user_id, p.name || '');
          }
        }
      }

      return (logs as ValidationLogEntry[]).map(l => ({
        ...l,
        performer_name: l.performed_by ? nameMap.get(l.performed_by) || 'Desconhecido' : undefined,
      }));
    },
    enabled: !!configId,
    staleTime: 30_000,
  });
}
