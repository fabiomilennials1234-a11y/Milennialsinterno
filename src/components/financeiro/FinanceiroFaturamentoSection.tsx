import { useState } from 'react';
import { DollarSign, Plus, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCurrentMonthInvoices,
  useCreateInvoice,
  useUpdateInvoiceStatus,
  calculateMonthlyTotals,
  ClientInvoice,
} from '@/hooks/useFinanceiro';
import { useFinanceiroClients } from '@/hooks/useDepartmentManager';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-warning/20 text-warning', icon: Clock },
  paid: { label: 'Pago', color: 'bg-green-500/20 text-green-500', icon: CheckCircle },
  overdue: { label: 'Atrasado', color: 'bg-destructive/20 text-destructive', icon: AlertCircle },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground', icon: AlertCircle },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function InvoiceCard({ invoice }: { invoice: ClientInvoice }) {
  const updateStatus = useUpdateInvoiceStatus();
  const config = STATUS_CONFIG[invoice.status];
  const Icon = config.icon;

  return (
    <div className="p-3 rounded-lg border bg-card border-subtle">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{invoice.client?.name}</p>
          {invoice.invoice_number && (
            <p className="text-xs text-muted-foreground">NF: {invoice.invoice_number}</p>
          )}
        </div>
        <Badge className={cn('text-[10px] px-1.5 py-0.5 gap-1', config.color)}>
          <Icon size={10} />
          {config.label}
        </Badge>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-lg font-bold text-primary">
          {formatCurrency(Number(invoice.invoice_value))}
        </span>
        {invoice.status === 'pending' && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs gap-1"
            onClick={() => updateStatus.mutate({ invoiceId: invoice.id, status: 'paid' })}
            disabled={updateStatus.isPending}
          >
            <CheckCircle size={10} />
            Pago
          </Button>
        )}
      </div>

      {invoice.due_date && (
        <p className="text-xs text-muted-foreground mt-1">
          Vencimento: {format(new Date(invoice.due_date), 'dd/MM/yyyy')}
        </p>
      )}
    </div>
  );
}

function NewInvoiceModal() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [value, setValue] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: clients = [] } = useFinanceiroClients();
  const createInvoice = useCreateInvoice();

  const currentMonth = startOfMonth(new Date()).toISOString().split('T')[0];

  const handleSubmit = async () => {
    if (!clientId || !value) return;

    const numValue = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) return;

    await createInvoice.mutateAsync({
      clientId,
      invoiceMonth: currentMonth,
      invoiceValue: numValue,
      invoiceNumber: invoiceNumber || undefined,
      dueDate: dueDate || undefined,
    });

    setOpen(false);
    setClientId('');
    setValue('');
    setInvoiceNumber('');
    setDueDate('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-2">
          <Plus size={14} />
          Novo Faturamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Faturamento - {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Número da NF (opcional)</Label>
            <Input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ex: NF-00123"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Data de Vencimento (opcional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={!clientId || !value || createInvoice.isPending}
          >
            {createInvoice.isPending ? 'Salvando...' : 'Salvar Faturamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FinanceiroFaturamentoSection() {
  const { data: invoices = [], isLoading } = useCurrentMonthInvoices();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const { total, paid, pending } = calculateMonthlyTotals(invoices);

  return (
    <div className="space-y-4">
      {/* Add new invoice */}
      <NewInvoiceModal />

      {/* Month header */}
      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-primary" />
          <span className="text-sm font-medium">
            {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{formatCurrency(total)}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-500">{formatCurrency(paid)}</p>
            <p className="text-[10px] text-muted-foreground">Recebido</p>
          </div>
          <div>
            <p className="text-lg font-bold text-warning">{formatCurrency(pending)}</p>
            <p className="text-[10px] text-muted-foreground">Pendente</p>
          </div>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <DollarSign className="mx-auto mb-2 opacity-50" size={28} />
          <p className="text-sm">Nenhum faturamento este mês</p>
          <p className="text-xs mt-1">Clique acima para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
    </div>
  );
}
