import { useState } from 'react';
import { useFinanceiroActiveClients, FinanceiroActiveClient } from '@/hooks/useFinanceiroActiveClients';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, RefreshCw, UserX, Calendar, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ContractExpirationModal from './ContractExpirationModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClientCardProps {
  client: FinanceiroActiveClient;
  onRenew: (clientId: string, clientName: string) => void;
  onChurn: (clientId: string, clientName: string, isExpired: boolean) => void;
}

function ClientCard({ client, onRenew, onChurn }: ClientCardProps) {
  const displayName = client.client?.razao_social || client.client?.name || 'Cliente';
  const expiresAt = client.contract_expires_at ? new Date(client.contract_expires_at) : null;
  const daysUntilExpiration = expiresAt ? differenceInDays(expiresAt, new Date()) : 0;
  
  const isExpired = daysUntilExpiration < 0;
  const isUrgent = daysUntilExpiration <= 7 && daysUntilExpiration >= 0;

  return (
    <Card 
      className={cn(
        "border-subtle hover:shadow-apple-hover transition-shadow",
        isExpired && "border-destructive bg-destructive/5",
        isUrgent && !isExpired && "border-warning bg-warning/5"
      )}
    >
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Client Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground line-clamp-2">
                {displayName}
              </h4>
            </div>
            <Badge 
              variant={isExpired ? "destructive" : isUrgent ? "outline" : "secondary"}
              className={cn(
                "shrink-0 text-xs",
                isUrgent && !isExpired && "border-warning text-warning bg-warning/10"
              )}
            >
              <Clock size={10} className="mr-1" />
              {isExpired 
                ? `Expirado há ${Math.abs(daysUntilExpiration)}d`
                : `${daysUntilExpiration}d restantes`
              }
            </Badge>
          </div>

          {/* Expiration Date */}
          {expiresAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar size={12} />
              <span>Expira em: {format(expiresAt, "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
              onClick={() => onRenew(client.client_id, displayName)}
            >
              <RefreshCw size={12} />
              Renovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onChurn(client.client_id, displayName, isExpired)}
            >
              <UserX size={12} />
              Churn
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinanceiroContratosExpirandoSection() {
  const { expiringContracts, isLoading, updateContractExpiration, moveToChurn } = useFinanceiroActiveClients();
  
  const [renewModal, setRenewModal] = useState<{ open: boolean; clientId: string; clientName: string }>({
    open: false,
    clientId: '',
    clientName: '',
  });
  
  const [churnDialog, setChurnDialog] = useState<{ 
    open: boolean; 
    clientId: string; 
    clientName: string;
    hasValidContract: boolean;
  }>({
    open: false,
    clientId: '',
    clientName: '',
    hasValidContract: true,
  });

  const handleRenew = (clientId: string, clientName: string) => {
    setRenewModal({ open: true, clientId, clientName });
  };

  const handleChurn = (clientId: string, clientName: string, isExpired: boolean) => {
    // If contract is expired, it goes directly to "churn efetivado"
    // If contract is still valid (just expiring soon), it needs full distrato process
    setChurnDialog({ 
      open: true, 
      clientId, 
      clientName,
      hasValidContract: !isExpired, // Valid if NOT expired
    });
  };

  const confirmRenewal = (expirationDate: Date) => {
    updateContractExpiration.mutate({
      clientId: renewModal.clientId,
      contractExpiresAt: expirationDate.toISOString().split('T')[0],
    });
    setRenewModal({ open: false, clientId: '', clientName: '' });
  };

  const confirmChurn = () => {
    moveToChurn.mutate({ 
      clientId: churnDialog.clientId,
      hasValidContract: churnDialog.hasValidContract,
    });
    setChurnDialog({ open: false, clientId: '', clientName: '', hasValidContract: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-4 pr-2">
          {/* Stats Card */}
          <Card className={cn(
            "border-subtle",
            expiringContracts.length > 0 
              ? "bg-warning/10 border-warning/30" 
              : "bg-muted/30"
          )}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  expiringContracts.length > 0 
                    ? "bg-warning/20" 
                    : "bg-muted"
                )}>
                  <AlertTriangle size={16} className={cn(
                    expiringContracts.length > 0 
                      ? "text-warning" 
                      : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contratos Expirando</p>
                  <p className={cn(
                    "text-lg font-bold",
                    expiringContracts.length > 0 
                      ? "text-warning" 
                      : "text-muted-foreground"
                  )}>
                    {expiringContracts.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contracts List */}
          <div className="space-y-2">
            {expiringContracts.length > 0 ? (
              expiringContracts.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onRenew={handleRenew}
                  onChurn={handleChurn}
                />
              ))
            ) : (
              <div className="py-8 text-center">
                <Calendar size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum contrato próximo ao vencimento
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contratos aparecerão aqui 30 dias antes de expirar
                </p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Renewal Modal */}
      <ContractExpirationModal
        open={renewModal.open}
        onOpenChange={(open) => setRenewModal({ ...renewModal, open })}
        clientName={renewModal.clientName}
        onConfirm={confirmRenewal}
        isLoading={updateContractExpiration.isPending}
        title="Renovar Contrato"
      />

      {/* Churn Confirmation Dialog */}
      <AlertDialog open={churnDialog.open} onOpenChange={(open) => setChurnDialog({ ...churnDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-warning" size={20} />
              Confirmar Churn
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tem certeza que deseja mover <strong>{churnDialog.clientName}</strong> para Churn?
                </p>
                
                {churnDialog.hasValidContract ? (
                  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                    <p className="text-sm font-medium text-warning">
                      ⚠️ Contrato ainda válido
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O cliente será movido para <strong>"Churn Solicitado"</strong> e passará pelo fluxo completo de distrato.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm font-medium text-destructive">
                      ❌ Contrato expirado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O cliente será movido diretamente para <strong>"Churn Efetivado"</strong>.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmChurn}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Churn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
