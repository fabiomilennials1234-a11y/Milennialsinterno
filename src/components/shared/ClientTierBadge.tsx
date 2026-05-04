import { Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClientCreativeUsage } from '@/hooks/useClientCreativeUsage';

export type ClientTier = 'bronze' | 'prata' | 'ouro' | 'platina';

export interface TierConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  creativesLimit: number;
}

const TIER_CONFIGS: Record<ClientTier, TierConfig> = {
  bronze: {
    label: 'Bronze',
    color: 'text-amber-800 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-950/40',
    borderColor: 'border-amber-300 dark:border-amber-700/50',
    creativesLimit: 4,
  },
  prata: {
    label: 'Prata',
    color: 'text-slate-700 dark:text-slate-200',
    bgColor: 'bg-slate-100 dark:bg-slate-800/50',
    borderColor: 'border-slate-300 dark:border-slate-600/50',
    creativesLimit: 6,
  },
  ouro: {
    label: 'Ouro',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950/40',
    borderColor: 'border-yellow-400 dark:border-yellow-700/50',
    creativesLimit: 10,
  },
  platina: {
    label: 'Platina',
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-950/40',
    borderColor: 'border-indigo-300 dark:border-indigo-700/50',
    creativesLimit: 15,
  },
};

export function getClientTier(monthlyValue: number | null | undefined): ClientTier {
  const value = monthlyValue || 0;
  if (value > 6000) return 'platina';
  if (value > 4000) return 'ouro';
  if (value > 2000) return 'prata';
  return 'bronze';
}

export function getTierConfig(tier: ClientTier): TierConfig {
  return TIER_CONFIGS[tier];
}

export function useClientTier(clientId: string) {
  return useQuery({
    queryKey: ['client-tier', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('monthly_value')
        .eq('id', clientId)
        .single();
      const value = data?.monthly_value ?? 0;
      const tier = getClientTier(value);
      return { tier, config: getTierConfig(tier), monthlyValue: value };
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

interface Props {
  clientId: string;
  className?: string;
  /** compact = apenas ícone + nome curto, para card fechado */
  compact?: boolean;
}

export default function ClientTierBadge({ clientId, className, compact }: Props) {
  const { data, isLoading } = useClientTier(clientId);

  if (isLoading || !data) return null;

  const { config } = data;

  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-0.5 gap-1 ${config.bgColor} ${config.color} ${config.borderColor} ${className || ''}`}
    >
      <Award size={compact ? 10 : 12} />
      {config.label}
    </Badge>
  );
}

interface CreativesProps {
  clientId: string;
  className?: string;
}

export function ClientCreativesLimit({ clientId, className }: CreativesProps) {
  const { data: tierData, isLoading: tierLoading } = useClientTier(clientId);
  const { data: usage, isLoading: usageLoading } = useClientCreativeUsage(clientId);

  if (tierLoading || !tierData) return null;

  const { config } = tierData;
  const used = usage?.total ?? 0;
  const isOverLimit = used >= config.creativesLimit;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${className || ''}`}>
      <Award size={18} className={config.color} />
      <span className="text-sm font-semibold text-foreground">Limite de criativos mensal:</span>
      <span className={`text-lg font-bold ${isOverLimit ? 'text-danger' : config.color}`}>
        {usageLoading ? '...' : used}/{config.creativesLimit}
      </span>
      {!usageLoading && usage && (usage.video > 0 || usage.design > 0) && (
        <span className="text-xs text-muted-foreground ml-1">
          ({usage.video}V + {usage.design}D)
        </span>
      )}
    </div>
  );
}
