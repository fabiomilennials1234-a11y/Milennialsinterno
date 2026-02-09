import { Badge } from '@/components/ui/badge';
import { FileText, FileCheck, AlertTriangle, XCircle } from 'lucide-react';
import { useContractStatus } from '@/hooks/useContractStatus';
import { cn } from '@/lib/utils';

interface ContractStatusBadgeProps {
  clientId: string;
  className?: string;
  compact?: boolean;
  showOnlyCritical?: boolean; // Only show expiring/expired
}

/**
 * Badge component that shows contract status for clients:
 * - "Contrato não assinado" - Contract not yet signed
 * - "Contrato assinado" - Contract is signed and valid
 * - "Contrato expirando" - Contract is expiring soon (within 30 days)
 * - "Contrato expirado" - Contract has expired
 */
export default function ContractStatusBadge({ 
  clientId, 
  className, 
  compact = false,
  showOnlyCritical = false 
}: ContractStatusBadgeProps) {
  const { getContractStatus } = useContractStatus();
  const contractInfo = getContractStatus(clientId);

  // If showOnlyCritical is true, only show expiring or expired badges
  if (showOnlyCritical && contractInfo.status !== 'expiring' && contractInfo.status !== 'expired') {
    return null;
  }

  const statusConfig = {
    not_signed: {
      label: 'Contrato não assinado',
      shortLabel: '📄',
      icon: FileText,
      variant: 'secondary' as const,
      bgClass: 'bg-muted text-muted-foreground',
    },
    signed: {
      label: 'Contrato assinado',
      shortLabel: '✓',
      icon: FileCheck,
      variant: 'default' as const,
      bgClass: 'bg-success/20 text-success border-success/30',
    },
    expiring: {
      label: `Contrato expirando (${contractInfo.daysUntilExpiration}d)`,
      shortLabel: `⚠️ ${contractInfo.daysUntilExpiration}d`,
      icon: AlertTriangle,
      variant: 'destructive' as const,
      bgClass: 'bg-warning/20 text-warning border-warning/30 animate-pulse',
    },
    expired: {
      label: 'Contrato expirado',
      shortLabel: '❌',
      icon: XCircle,
      variant: 'destructive' as const,
      bgClass: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse',
    },
  };

  const config = statusConfig[contractInfo.status];
  const Icon = config.icon;

  if (compact) {
    return (
      <Badge 
        variant={config.variant}
        className={cn(
          'text-[8px] px-1 py-0 gap-0.5',
          config.bgClass,
          className
        )}
      >
        <Icon size={8} />
        {config.shortLabel}
      </Badge>
    );
  }

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        'text-[10px] px-1.5 py-0.5 gap-1',
        config.bgClass,
        className
      )}
    >
      <Icon size={10} />
      {config.label}
    </Badge>
  );
}
