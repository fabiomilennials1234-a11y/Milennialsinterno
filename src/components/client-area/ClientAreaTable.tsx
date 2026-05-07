import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Filter, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductBadges from '@/components/shared/ProductBadges';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import type { ClientAreaItem } from '@/hooks/useClientArea';

interface Props {
  clients: ClientAreaItem[];
  onSelectClient: (client: ClientAreaItem) => void;
}

type SortKey = 'name' | 'entry_date' | 'monthly_value' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'aguardando_validacao', label: 'Aguardando Aprovacao' },
  { value: 'validado', label: 'Aprovados' },
  { value: 'reprovado', label: 'Reprovados' },
];

export default function ClientAreaTable({ clients, onSelectClient }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('entry_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Available products for filter
  const productOptions = useMemo(() => {
    const products = new Set<string>();
    clients.forEach(c => {
      (c.contracted_products || []).forEach(p => products.add(p));
    });
    return Array.from(products).sort();
  }, [clients]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = clients;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.razao_social?.toLowerCase().includes(q) ||
        c.cnpj?.includes(q) ||
        c.niche?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.cx_validation_status === statusFilter);
    }

    // Product filter
    if (productFilter !== 'all') {
      result = result.filter(c =>
        (c.contracted_products || []).includes(productFilter)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'entry_date': {
          const da = a.entry_date ? new Date(a.entry_date).getTime() : 0;
          const db = b.entry_date ? new Date(b.entry_date).getTime() : 0;
          return dir * (da - db);
        }
        case 'monthly_value':
          return dir * ((a.monthly_value || 0) - (b.monthly_value || 0));
        case 'status': {
          const order: Record<string, number> = {
            aguardando_validacao: 0,
            validado: 1,
            reprovado: 2,
          };
          return dir * ((order[a.cx_validation_status || ''] || 9) - (order[b.cx_validation_status || ''] || 9));
        }
        default:
          return 0;
      }
    });

    return result;
  }, [clients, search, statusFilter, productFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const pendingCount = clients.filter(c => c.cx_validation_status === 'aguardando_validacao').length;

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nome, CNPJ ou nicho..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 h-9 text-sm"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm bg-background/50 border-border/50">
              <Filter size={14} className="mr-1.5 text-muted-foreground/50" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.value === 'aguardando_validacao' && pendingCount > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      {pendingCount}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {productOptions.length > 0 && (
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm bg-background/50 border-border/50">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {productOptions.map(p => (
                  <SelectItem key={p} value={p}>{formatProductName(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <span className="text-xs text-muted-foreground/50 ml-auto">
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/40 overflow-hidden bg-card/30 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider"
                onClick={() => toggleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status <SortIcon column="status" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider"
                onClick={() => toggleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Cliente <SortIcon column="name" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Produtos
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Gestor ADS
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-right"
                onClick={() => toggleSort('monthly_value')}
              >
                <div className="flex items-center gap-1 justify-end">
                  Valor Mensal <SortIcon column="monthly_value" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider"
                onClick={() => toggleSort('entry_date')}
              >
                <div className="flex items-center gap-1">
                  Entrada <SortIcon column="entry_date" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Label
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground/50">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            )}
            {filtered.map(client => (
              <TableRow
                key={client.id}
                className={cn(
                  'cursor-pointer transition-colors border-border/20',
                  'hover:bg-accent/30',
                  client.cx_validation_status === 'aguardando_validacao' &&
                    'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]'
                )}
                onClick={() => onSelectClient(client)}
              >
                <TableCell>
                  <ValidationBadge status={client.cx_validation_status} />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm text-foreground">{client.name}</p>
                    {client.cnpj && (
                      <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">
                        {formatCNPJ(client.cnpj)}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {client.contracted_products && client.contracted_products.length > 0 ? (
                    <ProductBadges products={client.contracted_products} size="sm" />
                  ) : (
                    <span className="text-xs text-muted-foreground/40 italic">Sem produto</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {client.ads_manager_name || (
                      <span className="text-muted-foreground/30 italic">Nao atribuido</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-mono font-medium">
                    {client.monthly_value
                      ? `R$ ${client.monthly_value.toLocaleString('pt-BR')}`
                      : '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {client.entry_date
                      ? format(new Date(client.entry_date + 'T12:00:00'), "dd MMM yyyy", { locale: ptBR })
                      : '-'}
                  </span>
                </TableCell>
                <TableCell>
                  {client.client_label && (
                    <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ValidationBadge({ status }: { status: string | null }) {
  if (status === 'aguardando_validacao') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
        <Clock size={10} />
        Pendente
      </span>
    );
  }
  if (status === 'validado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={10} />
        Aprovado
      </span>
    );
  }
  if (status === 'reprovado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
        <XCircle size={10} />
        Reprovado
      </span>
    );
  }
  return <span className="text-[10px] text-muted-foreground/30">--</span>;
}

function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
}

function formatProductName(slug: string): string {
  const map: Record<string, string> = {
    'millennials-growth': 'Growth',
    'millennials-outbound': 'Outbound',
    'millennials-paddock': 'Paddock',
    'torque-crm': 'Torque CRM',
    'millennials-hunting': 'Hunting',
    'gestor-mktplace': 'MKT Place',
    'on-demand': 'ON Demand',
  };
  return map[slug] || slug;
}
