import { useState, useMemo } from 'react';
import {
  Image,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaAdsCreatives, type CreativeRow } from '@/hooks/useMetaAdsCreatives';
import { SectionHeader } from './shared-components';
import { formatCurrency, formatNumber, formatPercent } from './format-utils';
import { Input } from '@/components/ui/input';

type SortKey = 'ad_name' | 'campaign_name' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'leads' | 'cpl';

function SortIcon({ column, current, direction }: { column: SortKey; current: SortKey; direction: 'asc' | 'desc' }) {
  if (column !== current) return <ArrowUpDown size={12} className="opacity-30" />;
  return direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

interface Props {
  dateFrom: string;
  dateTo: string;
  accountId: string;
}

export default function MetaAdsCreativesTab({ dateFrom, dateTo, accountId }: Props) {
  const [sortCol, setSortCol] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const { data: creatives = [], isLoading } = useMetaAdsCreatives({ dateFrom, dateTo, accountId });

  const filtered = useMemo(() => {
    if (!search) return creatives;
    const s = search.toLowerCase();
    return creatives.filter(c =>
      c.ad_name.toLowerCase().includes(s) ||
      c.campaign_name.toLowerCase().includes(s)
    );
  }, [creatives, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortCol as keyof CreativeRow];
      const bv = b[sortCol as keyof CreativeRow];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = Number(av ?? 0);
      const nb = Number(bv ?? 0);
      return sortDir === 'asc' ? na - nb : nb - na;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col: SortKey) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const columns: [SortKey, string][] = [
    ['ad_name', 'Criativo'],
    ['campaign_name', 'Campanha'],
    ['spend', 'Investido'],
    ['impressions', 'Impressoes'],
    ['clicks', 'Clicks'],
    ['ctr', 'CTR'],
    ['cpc', 'CPC'],
    ['leads', 'Leads'],
    ['cpl', 'CPL'],
  ];

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="Criativos" icon={Image} color="info" />
        <div className="dashboard-card dash-card-animate">
          <div className="px-4 py-3 border-b border-border/30">
            <Input
              placeholder="Buscar por nome do criativo ou campanha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando criativos...</div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              {search ? 'Nenhum criativo encontrado' : 'Nenhum dado de criativo para o periodo'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">Thumb</th>
                    {columns.map(([col, title]) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => handleSort(col)}
                      >
                        <div className="flex items-center gap-1">
                          {title}
                          <SortIcon column={col} current={sortCol} direction={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.ad_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        {c.creative_thumbnail_url ? (
                          <img
                            src={c.creative_thumbnail_url}
                            alt={c.ad_name}
                            className="w-12 h-12 rounded-lg object-cover bg-muted"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={cn(
                          'w-12 h-12 rounded-lg bg-muted flex items-center justify-center',
                          c.creative_thumbnail_url && 'hidden'
                        )}>
                          <Image size={16} className="text-muted-foreground" />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <span className="truncate block text-xs font-medium" title={c.ad_name}>{c.ad_name}</span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <span className="truncate block text-xs" title={c.campaign_name}>{c.campaign_name}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(c.spend)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(c.impressions)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(c.clicks)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatPercent(c.ctr)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(c.cpc)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-success">{formatNumber(c.leads)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {c.leads > 0 ? formatCurrency(c.cpl) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/30">
                {sorted.length} criativos
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
