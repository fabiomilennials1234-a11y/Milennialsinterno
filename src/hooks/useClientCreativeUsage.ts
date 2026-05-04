import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreativeUsageMonth {
  yearMonth: string;
  video: number;
  design: number;
  total: number;
}

export interface ClientCreativeUsageResult {
  video: number;
  design: number;
  total: number;
  history: CreativeUsageMonth[];
}

function getCurrentYearMonth(): string {
  // Use Sao Paulo timezone-aware month via date formatting
  const now = new Date();
  // Approximate: JS Date in user's browser. The DB source of truth uses
  // 'America/Sao_Paulo' on insert, so this is display-only.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  return `${year}-${month}`;
}

export function useClientCreativeUsage(clientId: string | null | undefined) {
  return useQuery<ClientCreativeUsageResult>({
    queryKey: ['client-creatives', clientId],
    queryFn: async () => {
      if (!clientId) {
        return { video: 0, design: 0, total: 0, history: [] };
      }

      const { data, error } = await supabase
        .from('client_creative_usage' as never)
        .select('year_month, material_type, used_count')
        .eq('client_id', clientId)
        .order('year_month', { ascending: false });

      if (error) throw error;

      type Row = { year_month: string; material_type: string; used_count: number };
      const rows = (data ?? []) as unknown as Row[];

      const currentYM = getCurrentYearMonth();

      // Aggregate by month
      const byMonth = new Map<string, { video: number; design: number }>();
      for (const row of rows) {
        const existing = byMonth.get(row.year_month) ?? { video: 0, design: 0 };
        if (row.material_type === 'video') {
          existing.video += row.used_count;
        } else if (row.material_type === 'design') {
          existing.design += row.used_count;
        }
        byMonth.set(row.year_month, existing);
      }

      const current = byMonth.get(currentYM) ?? { video: 0, design: 0 };

      const history: CreativeUsageMonth[] = [];
      for (const [ym, counts] of byMonth.entries()) {
        history.push({
          yearMonth: ym,
          video: counts.video,
          design: counts.design,
          total: counts.video + counts.design,
        });
      }

      return {
        video: current.video,
        design: current.design,
        total: current.video + current.design,
        history,
      };
    },
    enabled: !!clientId,
    staleTime: 60 * 1000,
  });
}
