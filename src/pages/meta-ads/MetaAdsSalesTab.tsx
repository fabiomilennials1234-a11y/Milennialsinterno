import { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Coins,
  Target,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaAdsSales, type MetaAdsSale } from '@/hooks/useMetaAdsSales';
import { useMetaAdsSalesMutation } from '@/hooks/useMetaAdsSalesMutation';
import { type MetaAdsAggregates, type CampaignData } from '@/hooks/useMetaAdsInsights';
import { computeSalesMetrics } from '@/lib/meta-ads-utils';
import { MetricCard, SectionHeader } from './shared-components';
import { formatCurrency, formatNumber, formatPercent } from './format-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

interface Props {
  dateFrom: string;
  dateTo: string;
  accountId: string;
  aggregates: MetaAdsAggregates;
}

// ---------- Register Sale Modal ----------

function RegisterSaleModal({
  campaigns,
  accountId,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  campaigns: CampaignData[];
  accountId: string;
  onClose: () => void;
  onSubmit: (data: {
    ad_account_id: string;
    campaign_id: string;
    campaign_name: string;
    sale_date: string;
    num_sales: number;
    sales_value: number;
  }) => void;
  isSubmitting: boolean;
}) {
  const [campaignId, setCampaignId] = useState('');
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [numSales, setNumSales] = useState('');
  const [salesValue, setSalesValue] = useState('');

  const selectedCampaign = campaigns.find(c => c.campaign_id === campaignId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !numSales || !saleDate) return;
    onSubmit({
      ad_account_id: accountId,
      campaign_id: selectedCampaign.campaign_id,
      campaign_name: selectedCampaign.campaign_name,
      sale_date: saleDate,
      num_sales: parseInt(numSales, 10),
      sales_value: parseFloat(salesValue || '0'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 dashboard-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Registrar Vendas</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Campanha</label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar campanha" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map(c => (
                  <SelectItem key={c.campaign_id} value={c.campaign_id}>
                    {c.campaign_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data da Venda</label>
            <Input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nro de Vendas</label>
              <Input
                type="number"
                min="1"
                value={numSales}
                onChange={(e) => setNumSales(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Total (R$)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={salesValue}
                onChange={(e) => setSalesValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!campaignId || !numSales || !saleDate || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Registrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---------- Inline edit row ----------

function EditableRow({
  sale,
  onSave,
  onCancel,
  isSaving,
}: {
  sale: MetaAdsSale;
  onSave: (numSales: number, salesValue: number) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [numSales, setNumSales] = useState(String(sale.num_sales));
  const [salesValue, setSalesValue] = useState(String(sale.sales_value));

  return (
    <tr className="border-b border-border/30 bg-primary/5">
      <td className="px-3 py-2.5 text-xs truncate max-w-[200px]">{sale.campaign_name}</td>
      <td className="px-3 py-2.5 text-xs">{sale.sale_date}</td>
      <td className="px-3 py-1.5">
        <Input
          type="number"
          min="0"
          value={numSales}
          onChange={(e) => setNumSales(e.target.value)}
          className="h-7 text-xs w-20"
        />
      </td>
      <td className="px-3 py-1.5">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={salesValue}
          onChange={(e) => setSalesValue(e.target.value)}
          className="h-7 text-xs w-28"
        />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(parseInt(numSales, 10), parseFloat(salesValue || '0'))}
            disabled={isSaving}
            className="h-6 w-6 p-0"
          >
            <Check size={12} className="text-success" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0">
            <X size={12} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ---------- Main tab ----------

export default function MetaAdsSalesTab({ dateFrom, dateTo, accountId, aggregates }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: sales = [], isLoading } = useMetaAdsSales({ dateFrom, dateTo, accountId });
  const { createSale, updateSale, deleteSale } = useMetaAdsSalesMutation();

  // Compute metrics
  const totalSales = sales.reduce((s, r) => s + r.num_sales, 0);
  const totalSalesValue = sales.reduce((s, r) => s + r.sales_value, 0);
  const metrics = computeSalesMetrics(aggregates.totalSpend, totalSales, totalSalesValue);

  // Campaign breakdown: merge sales with insights
  const campaignBreakdown = useMemo(() => {
    const salesMap = new Map<string, { numSales: number; salesValue: number }>();
    for (const sale of sales) {
      const existing = salesMap.get(sale.campaign_id);
      if (existing) {
        existing.numSales += sale.num_sales;
        existing.salesValue += sale.sales_value;
      } else {
        salesMap.set(sale.campaign_id, { numSales: sale.num_sales, salesValue: sale.sales_value });
      }
    }

    return aggregates.campaignData
      .map(c => {
        const s = salesMap.get(c.campaign_id);
        return {
          ...c,
          numSales: s?.numSales ?? 0,
          salesValue: s?.salesValue ?? 0,
          costPerPurchase: s && s.numSales > 0 ? c.spend / s.numSales : 0,
          roi: c.spend > 0 && s ? s.salesValue / c.spend : 0,
        };
      })
      .filter(c => c.numSales > 0 || c.spend > 0)
      .sort((a, b) => b.numSales - a.numSales);
  }, [aggregates.campaignData, sales]);

  const handleCreateSale = (data: {
    ad_account_id: string;
    campaign_id: string;
    campaign_name: string;
    sale_date: string;
    num_sales: number;
    sales_value: number;
  }) => {
    createSale.mutate(data, {
      onSuccess: () => setShowModal(false),
    });
  };

  const resolvedAccountId = accountId === 'all'
    ? aggregates.campaignData[0]?.campaign_id ? 'act_738610258782410' : ''
    : accountId;

  return (
    <div className="space-y-6">
      {/* Hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={ShoppingCart}
          label="Nro de Vendas"
          value={formatNumber(metrics.numSales)}
          variant="success"
          animDelay={0}
        />
        <MetricCard
          icon={Target}
          label="Custo / Compra"
          value={metrics.costPerPurchase > 0 ? formatCurrency(metrics.costPerPurchase) : '--'}
          variant={metrics.costPerPurchase > 0 ? 'warning' : 'default'}
          animDelay={80}
        />
        <MetricCard
          icon={Coins}
          label="Valor Vendas"
          value={formatCurrency(metrics.salesValue)}
          variant="info"
          animDelay={160}
        />
        <MetricCard
          icon={TrendingUp}
          label="ROI"
          value={metrics.roi > 0 ? `${metrics.roi.toFixed(1)}x` : '--'}
          subValue={formatCurrency(metrics.spend) + ' investido'}
          variant={metrics.roi >= 1 ? 'success' : metrics.roi > 0 ? 'warning' : 'default'}
          animDelay={240}
        />
      </div>

      {/* Campaign breakdown */}
      {campaignBreakdown.length > 0 && (
        <section>
          <SectionHeader title="Breakdown por Campanha" icon={ShoppingCart} color="primary" />
          <div className="dashboard-card dash-card-animate overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campanha</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendas</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor Vendas</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Investido</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custo/Compra</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ROI</th>
                </tr>
              </thead>
              <tbody>
                {campaignBreakdown.map(c => (
                  <tr key={c.campaign_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 max-w-[250px]"><span className="truncate block">{c.campaign_name}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(c.numSales)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(c.salesValue)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(c.spend)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {c.costPerPurchase > 0 ? formatCurrency(c.costPerPurchase) : '--'}
                    </td>
                    <td className={cn(
                      'px-3 py-2.5 font-mono text-xs font-semibold',
                      c.roi >= 1 ? 'text-success' : c.roi > 0 ? 'text-amber-500' : 'text-muted-foreground'
                    )}>
                      {c.roi > 0 ? `${c.roi.toFixed(1)}x` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sales entries */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Registros de Vendas" icon={ShoppingCart} color="success" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-1.5"
          >
            <Plus size={14} />
            Registrar Vendas
          </Button>
        </div>

        <div className="dashboard-card dash-card-animate overflow-x-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : sales.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Nenhum registro de vendas. Clique em "Registrar Vendas" para adicionar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campanha</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendas</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => {
                  if (editingId === sale.id) {
                    return (
                      <EditableRow
                        key={sale.id}
                        sale={sale}
                        onSave={(numSales, salesValue) => {
                          updateSale.mutate({ id: sale.id, num_sales: numSales, sales_value: salesValue }, {
                            onSuccess: () => setEditingId(null),
                          });
                        }}
                        onCancel={() => setEditingId(null)}
                        isSaving={updateSale.isPending}
                      />
                    );
                  }
                  return (
                    <tr key={sale.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <span className="truncate block text-xs">{sale.campaign_name}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{sale.sale_date}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(sale.num_sales)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(sale.sales_value)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(sale.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('Remover este registro de venda?')) {
                                deleteSale.mutate(sale.id);
                              }
                            }}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Modal */}
      {showModal && (
        <RegisterSaleModal
          campaigns={aggregates.campaignData}
          accountId={resolvedAccountId}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateSale}
          isSubmitting={createSale.isPending}
        />
      )}
    </div>
  );
}
