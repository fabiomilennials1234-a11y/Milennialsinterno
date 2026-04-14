import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CRM_CONFIG_DEADLINE_DAYS, type CrmProduto } from '@/hooks/useCrmKanban';

interface Props {
  createdAt: string;
  produto: CrmProduto;
  finalizado?: boolean;
  className?: string;
}

/**
 * Badge de prazo máximo de uma configuração V8/Automation/Copilot.
 * Verde = folga confortável; amarelo = 24h restantes; vermelho = atrasado.
 * Caso `finalizado=true`, mostra badge neutra indicando entrega dentro ou
 * fora do prazo (informativo).
 */
export default function CrmDeadlineBadge({ createdAt, produto, finalizado, className }: Props) {
  const start = new Date(createdAt).getTime();
  const deadlineMs = start + CRM_CONFIG_DEADLINE_DAYS[produto] * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diffHours = (deadlineMs - now) / (1000 * 60 * 60);

  if (finalizado) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[9px] px-1.5 py-0 gap-0.5',
          'border-emerald-500/40 text-emerald-700 bg-emerald-500/10',
          className
        )}
      >
        <CheckCircle2 size={9} />
        Entregue
      </Badge>
    );
  }

  if (diffHours < 0) {
    const overdueDays = Math.abs(Math.floor(diffHours / 24));
    return (
      <Badge
        variant="destructive"
        className={cn('text-[9px] px-1.5 py-0 gap-0.5 animate-pulse', className)}
      >
        <AlertTriangle size={9} />
        Atrasado {overdueDays}d
      </Badge>
    );
  }

  if (diffHours <= 24) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[9px] px-1.5 py-0 gap-0.5 border-warning text-warning bg-warning/5',
          className
        )}
      >
        <Clock size={9} />
        {Math.ceil(diffHours)}h restantes
      </Badge>
    );
  }

  const diffDays = Math.ceil(diffHours / 24);
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[9px] px-1.5 py-0 gap-0.5 border-muted-foreground/30 text-muted-foreground',
        className
      )}
    >
      <Clock size={9} />
      {diffDays}d restantes
    </Badge>
  );
}
