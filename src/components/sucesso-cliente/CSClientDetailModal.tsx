import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  CheckCircle,
  Phone,
  Building2,
  DollarSign,
  Clock,
  ExternalLink,
  User,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CSClient, CSClassification, useCSPermissions } from '@/hooks/useSucessoCliente';
import ActionPlanSection from './ActionPlanSection';
import CSContactHistory from './CSContactHistory';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import { cn } from '@/lib/utils';

interface CSClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: CSClient;
}

const CLASSIFICATION_CONFIG: Record<CSClassification, { 
  label: string; 
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ElementType;
}> = {
  normal: { 
    label: 'Normal', 
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/20',
    icon: CheckCircle,
  },
  alerta: { 
    label: 'Em Alerta', 
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/20',
    icon: AlertTriangle,
  },
  critico: { 
    label: 'Crítico', 
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/20',
    icon: AlertCircle,
  },
  encerrado: { 
    label: 'Encerrado', 
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    borderColor: 'border-muted',
    icon: XCircle,
  },
};

const formatCurrency = (value: number | null) => {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function CSClientDetailModal({ isOpen, onClose, client }: CSClientDetailModalProps) {
  const { canSetLabels } = useCSPermissions();
  const classification = client.cs_classification || 'normal';
  const config = CLASSIFICATION_CONFIG[classification];
  const Icon = config.icon;

  const daysSinceContact = client.last_cs_contact_at
    ? Math.floor((Date.now() - new Date(client.last_cs_contact_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                config.bgColor
              )}>
                <Icon className={cn("w-5 h-5", config.textColor)} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {client.name}
                  <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                </DialogTitle>
                {client.razao_social && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {client.razao_social}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canSetLabels && (
                <ClientLabelSelector
                  clientId={client.id}
                  currentLabel={client.client_label as ClientLabel}
                />
              )}
              <Badge 
                variant="outline" 
                className={cn("text-sm", config.bgColor, config.textColor, config.borderColor)}
              >
                <Icon className="h-4 w-4 mr-1" />
                {config.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* Client Info Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="text-sm font-semibold text-foreground">Investimento</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(client.expected_investment)}
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-info" />
                  <span className="text-sm font-semibold text-foreground">Último Contato</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {client.last_cs_contact_at 
                    ? formatDistanceToNow(new Date(client.last_cs_contact_at), { addSuffix: true, locale: ptBR })
                    : 'Sem contato registrado'
                  }
                </p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-warning" />
                  <span className="text-sm font-semibold text-foreground">Dias sem Contato</span>
                </div>
                <p className={cn(
                  "text-sm font-semibold",
                  daysSinceContact !== null && daysSinceContact >= 14 
                    ? "text-destructive" 
                    : daysSinceContact !== null && daysSinceContact >= 7 
                      ? "text-warning" 
                      : "text-muted-foreground"
                )}>
                  {daysSinceContact !== null ? `${daysSinceContact} dias` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Classification Reason */}
            {client.cs_classification_reason && (
              <div className={cn(
                "rounded-xl p-4 border",
                config.bgColor,
                config.borderColor
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("w-4 h-4", config.textColor)} />
                  <span className={cn("text-sm font-semibold", config.textColor)}>
                    Motivo da Classificação
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {client.cs_classification_reason}
                </p>
              </div>
            )}

            {client.niche && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Nicho:</span>
                <Badge variant="secondary">{client.niche}</Badge>
              </div>
            )}

            <Separator />

            {/* Action Plans Section - Main Feature */}
            <ActionPlanSection clientId={client.id} clientName={client.name} />

            <Separator />

            {/* Contact History */}
            <CSContactHistory clientId={client.id} clientName={client.name} canEdit />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}