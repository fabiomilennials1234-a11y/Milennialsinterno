import { useMemo } from 'react';
import { Users, Clock, DollarSign, TrendingUp, Package, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientAreaItem } from '@/hooks/useClientArea';

interface Props {
  clients: ClientAreaItem[];
}

interface MetricCard {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  highlight?: boolean;
}

export default function ClientAreaMetrics({ clients }: Props) {
  const metrics = useMemo(() => {
    const active = clients.filter(
      c => c.cx_validation_status === 'validado' && c.status !== 'churned'
    );
    const pending = clients.filter(c => c.cx_validation_status === 'aguardando_validacao');
    const rejected = clients.filter(c => c.cx_validation_status === 'reprovado');

    const totalMRR = active.reduce((sum, c) => sum + (c.monthly_value || 0), 0);

    // Clients entered this month
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthClients = active.filter(c => {
      if (!c.entry_date) return false;
      const d = new Date(c.entry_date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const lastMonthClients = active.filter(c => {
      if (!c.entry_date) return false;
      const d = new Date(c.entry_date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const growthDelta = thisMonthClients.length - lastMonthClients.length;
    const growthPercent = lastMonthClients.length > 0
      ? ((growthDelta / lastMonthClients.length) * 100).toFixed(0)
      : thisMonthClients.length > 0 ? '+100' : '0';

    // Products breakdown
    const productCounts: Record<string, number> = {};
    active.forEach(c => {
      (c.contracted_products || []).forEach(p => {
        productCounts[p] = (productCounts[p] || 0) + 1;
      });
    });
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

    const cards: MetricCard[] = [
      {
        label: 'Clientes Ativos',
        value: active.length,
        subtitle: `${clients.length} total`,
        icon: Users,
        color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
      },
      {
        label: 'Aguardando Aprovacao',
        value: pending.length,
        subtitle: rejected.length > 0 ? `${rejected.length} reprovados` : undefined,
        icon: Clock,
        color: pending.length > 0
          ? 'from-amber-500/20 to-amber-500/5 border-amber-500/20'
          : 'from-zinc-500/10 to-zinc-500/5 border-zinc-500/15',
        highlight: pending.length > 0,
      },
      {
        label: 'MRR Total',
        value: `R$ ${totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        subtitle: `Media R$ ${active.length > 0 ? Math.round(totalMRR / active.length).toLocaleString('pt-BR') : 0}/cliente`,
        icon: DollarSign,
        color: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
      },
      {
        label: 'Crescimento Mensal',
        value: `${growthDelta >= 0 ? '+' : ''}${thisMonthClients.length}`,
        subtitle: `${growthPercent}% vs mes anterior`,
        icon: TrendingUp,
        color: growthDelta >= 0
          ? 'from-blue-500/20 to-blue-500/5 border-blue-500/20'
          : 'from-red-500/20 to-red-500/5 border-red-500/20',
      },
      {
        label: 'Produto Principal',
        value: topProduct ? topProduct[1] : 0,
        subtitle: topProduct
          ? formatProductName(topProduct[0])
          : 'Nenhum produto',
        icon: Package,
        color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
      },
    ];

    return cards;
  }, [clients]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {metrics.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={cn(
              'relative overflow-hidden rounded-xl border p-5',
              'bg-gradient-to-br backdrop-blur-sm',
              'transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
              card.color,
              card.highlight && 'ring-1 ring-amber-500/40'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {card.value}
                </p>
                {card.subtitle && (
                  <p className="text-[11px] text-muted-foreground/60">
                    {card.subtitle}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-background/30 p-2">
                <Icon size={18} className="text-foreground/50" />
              </div>
            </div>
            {card.highlight && (
              <div className="absolute top-2 right-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatProductName(slug: string): string {
  const map: Record<string, string> = {
    'millennials-growth': 'Growth',
    'millennials-outbound': 'Outbound',
    'millennials-paddock': 'Paddock',
    'torque-crm': 'Torque CRM',
    'millennials-hunting': 'Hunting',
    'gestor-mktplace': 'MKT Place',
  };
  return map[slug] || slug;
}
