import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useOverdueInvoices } from '@/hooks/useOverdueInvoices';

interface OverdueInvoiceBadgeProps {
  clientId: string;
  className?: string;
  compact?: boolean;
}

/**
 * Badge component that shows "Fatura Atrasada" for clients with overdue invoices
 * This component automatically checks the client's invoice status
 */
export default function OverdueInvoiceBadge({ clientId, className, compact = false }: OverdueInvoiceBadgeProps) {
  const { isClientOverdue } = useOverdueInvoices();

  if (!isClientOverdue(clientId)) {
    return null;
  }

  if (compact) {
    return (
      <Badge 
        variant="destructive" 
        className={`text-[8px] px-1 py-0 gap-0.5 animate-pulse ${className || ''}`}
      >
        <AlertTriangle size={8} />
        $
      </Badge>
    );
  }

  return (
    <Badge 
      variant="destructive" 
      className={`text-[10px] px-1.5 py-0.5 gap-1 animate-pulse ${className || ''}`}
    >
      <AlertTriangle size={10} />
      Fatura Atrasada
    </Badge>
  );
}
