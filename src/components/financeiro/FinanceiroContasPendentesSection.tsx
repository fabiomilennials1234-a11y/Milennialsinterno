import { useState } from 'react';
import { Receipt, CheckCircle, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  usePendingInvoices,
  useUpdateInvoiceStatus,
  ClientInvoice,
} from '@/hooks/useFinanceiro';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function PendingInvoiceCard({ invoice }: { invoice: ClientInvoice }) {
  const updateStatus = useUpdateInvoiceStatus();

  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();
  const daysUntilDue = invoice.due_date
    ? differenceInDays(parseISO(invoice.due_date), new Date())
    : null;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        isOverdue
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-card border-subtle'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium truncate', isOverdue && 'text-destructive')}>
            {invoice.client?.name}
          </p>
          {invoice.client?.razao_social && (
            <p className="text-xs text-muted-foreground truncate">
              {invoice.client.razao_social}
            </p>
          )}
        </div>
        {isOverdue ? (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 gap-1">
            <AlertTriangle size={10} />
            Atrasado
          </Badge>
        ) : (
          <Badge className="text-[10px] px-1.5 py-0.5 gap-1 bg-warning/20 text-warning">
            <Clock size={10} />
            Pendente
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-lg font-bold text-primary">
          {formatCurrency(Number(invoice.invoice_value))}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs gap-1"
          onClick={() => updateStatus.mutate({ invoiceId: invoice.id, status: 'paid' })}
          disabled={updateStatus.isPending}
        >
          <CheckCircle size={10} />
          Marcar Pago
        </Button>
      </div>

      {invoice.due_date && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          <Calendar size={10} className="text-muted-foreground" />
          <span className={cn('text-muted-foreground', isOverdue && 'text-destructive font-medium')}>
            {isOverdue ? (
              <>Venceu há {Math.abs(daysUntilDue!)} dias</>
            ) : daysUntilDue === 0 ? (
              'Vence hoje'
            ) : (
              <>Vence em {daysUntilDue} dias ({format(parseISO(invoice.due_date), 'dd/MM')})</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export default function FinanceiroContasSection() {
  const { data: invoices = [], isLoading } = usePendingInvoices();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const overdueInvoices = invoices.filter(
    (inv) => inv.due_date && new Date(inv.due_date) < new Date()
  );
  const pendingInvoices = invoices.filter(
    (inv) => !inv.due_date || new Date(inv.due_date) >= new Date()
  );

  const totalPending = invoices.reduce((sum, inv) => sum + Number(inv.invoice_value), 0);
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.invoice_value), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-warning/10 rounded-lg text-center">
          <p className="text-lg font-bold text-warning">{formatCurrency(totalPending)}</p>
          <p className="text-[10px] text-muted-foreground">Total a Receber</p>
        </div>
        <div className="p-3 bg-destructive/10 rounded-lg text-center">
          <p className="text-lg font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
          <p className="text-[10px] text-muted-foreground">Em Atraso</p>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Receipt className="mx-auto mb-2 opacity-50" size={28} />
          <p className="text-sm">Nenhuma conta pendente</p>
          <p className="text-xs mt-1">Todos os pagamentos estão em dia!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Overdue first */}
          {overdueInvoices.length > 0 && (
            <>
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertTriangle size={12} />
                Em Atraso ({overdueInvoices.length})
              </p>
              {overdueInvoices.map((invoice) => (
                <PendingInvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </>
          )}

          {/* Then pending */}
          {pendingInvoices.length > 0 && (
            <>
              {overdueInvoices.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground pt-2">
                  A Vencer ({pendingInvoices.length})
                </p>
              )}
              {pendingInvoices.map((invoice) => (
                <PendingInvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
