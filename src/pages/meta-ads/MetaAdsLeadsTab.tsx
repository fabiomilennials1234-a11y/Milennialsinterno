import { useState, useMemo } from 'react';
import {
  Users,
  Coins,
  Target,
  Image,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaLeads } from '@/hooks/useMetaLeads';
import { useMetaAdsInsights, type MetaAdsAggregates } from '@/hooks/useMetaAdsInsights';
import { parseLeadFieldData, type LeadFieldEntry } from '@/lib/meta-ads-utils';
import { MetricCard, SectionHeader } from './shared-components';
import { formatCurrency, formatNumber } from './format-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

interface Props {
  dateFrom: string;
  dateTo: string;
  accountId: string;
  aggregates: MetaAdsAggregates;
}

export default function MetaAdsLeadsTab({ dateFrom, dateTo, accountId, aggregates }: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading: leadsLoading } = useMetaLeads({ dateFrom, dateTo, accountId });

  // Ad-level data for creative ranking
  const { data: adInsights = [] } = useMetaAdsInsights({ dateFrom, dateTo, accountId });

  // Creative ranking by leads
  const creativeRanking = useMemo(() => {
    const map = new Map<string, {
      ad_name: string;
      creative_thumbnail_url: string | null;
      leads: number;
      spend: number;
    }>();

    for (const row of adInsights) {
      const r = row as Record<string, unknown>;
      const adId = r.ad_id as string | null;
      if (!adId) continue;
      const existing = map.get(adId);
      if (existing) {
        existing.leads += (r.leads as number) ?? 0;
        existing.spend += (r.spend as number) ?? 0;
      } else {
        map.set(adId, {
          ad_name: (r.ad_name as string) ?? adId,
          creative_thumbnail_url: (r.creative_thumbnail_url as string) ?? null,
          leads: (r.leads as number) ?? 0,
          spend: (r.spend as number) ?? 0,
        });
      }
    }

    return Array.from(map.entries())
      .map(([ad_id, c]) => ({
        ad_id,
        ...c,
        cpl: c.leads > 0 ? c.spend / c.leads : 0,
      }))
      .filter(c => c.leads > 0)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  }, [adInsights]);

  // Campaign ranking by leads
  const campaignRanking = useMemo(() => {
    return [...aggregates.campaignData]
      .filter(c => c.leads > 0)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  }, [aggregates.campaignData]);

  // Parse leads for table
  const parsedLeads = useMemo(() => {
    return leads.map(lead => {
      const fields = (lead.field_data ?? []) as LeadFieldEntry[];
      const parsed = parseLeadFieldData(fields);
      return { ...lead, ...parsed };
    });
  }, [leads]);

  // Search + paginate
  const filteredLeads = useMemo(() => {
    if (!search) return parsedLeads;
    const s = search.toLowerCase();
    return parsedLeads.filter(l =>
      l.name.toLowerCase().includes(s) ||
      l.email.toLowerCase().includes(s) ||
      l.phone.toLowerCase().includes(s) ||
      (l.campaign_name ?? '').toLowerCase().includes(s) ||
      (l.ad_name ?? '').toLowerCase().includes(s)
    );
  }, [parsedLeads, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const pagedLeads = filteredLeads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Hero cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard
          icon={Users}
          label="Total de Leads"
          value={formatNumber(aggregates.totalLeads)}
          variant="success"
          animDelay={0}
        />
        <MetricCard
          icon={Target}
          label="CPL Medio"
          value={aggregates.avgCPL > 0 ? formatCurrency(aggregates.avgCPL) : '--'}
          variant={aggregates.avgCPL > 0 ? 'warning' : 'default'}
          animDelay={80}
        />
        <MetricCard
          icon={Coins}
          label="Valor Investido"
          value={formatCurrency(aggregates.totalSpend)}
          variant="info"
          animDelay={160}
        />
      </div>

      {/* Rankings side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Creative ranking */}
        {creativeRanking.length > 0 && (
          <section>
            <SectionHeader title="Top Criativos por Leads" icon={Image} color="success" />
            <div className="dashboard-card dash-card-animate overflow-hidden">
              <div className="divide-y divide-border/30">
                {creativeRanking.map((c, i) => (
                  <div key={c.ad_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                    {c.creative_thumbnail_url ? (
                      <img
                        src={c.creative_thumbnail_url}
                        alt={c.ad_name}
                        className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Image size={16} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.ad_name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="text-success font-semibold">{formatNumber(c.leads)} leads</span>
                        <span>CPL {formatCurrency(c.cpl)}</span>
                        <span>{formatCurrency(c.spend)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Campaign ranking */}
        {campaignRanking.length > 0 && (
          <section>
            <SectionHeader title="Top Campanhas por Leads" icon={Target} color="info" />
            <div className="dashboard-card dash-card-animate overflow-hidden">
              <div className="divide-y divide-border/30">
                {campaignRanking.map((c, i) => (
                  <div key={c.campaign_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.campaign_name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="text-success font-semibold">{formatNumber(c.leads)} leads</span>
                        <span>CPL {formatCurrency(c.cpl)}</span>
                        <span>{formatCurrency(c.spend)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Leads table */}
      <section>
        <SectionHeader title="Leads Recentes" icon={Users} color="primary" />
        <div className="dashboard-card dash-card-animate">
          <div className="px-4 py-3 border-b border-border/30">
            <Input
              placeholder="Buscar por nome, email, telefone, campanha..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="max-w-sm"
            />
          </div>

          {leadsLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              {search ? 'Nenhum lead encontrado' : 'Nenhum lead no periodo selecionado'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campanha</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Criativo</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLeads.map(l => (
                      <tr key={l.lead_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <span className="truncate block">{l.name || '--'}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs max-w-[200px]">
                          <span className="truncate block">{l.email || '--'}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{l.phone || '--'}</td>
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <span className="truncate block text-xs">{l.campaign_name || '--'}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[150px]">
                          <span className="truncate block text-xs">{l.ad_name || '--'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {l.created_time
                            ? format(new Date(l.created_time), "dd/MM/yy HH:mm", { locale: ptBR })
                            : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                <span className="text-xs text-muted-foreground">
                  {filteredLeads.length} leads — pagina {page + 1} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
