import { useState } from 'react';
import { useAssignedClients } from '@/hooks/useAdsManager';
import { useAuth } from '@/contexts/AuthContext';
import { UserX, Archive, AlertTriangle, Timer, Building2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdsChurnSection() {
  const { data: clients = [], isLoading } = useAssignedClients();
  const { user, isCEO } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [showGoodbyeMessage, setShowGoodbyeMessage] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  // Check if user can archive (CEO, gestor_projetos, gestor_ads, sucesso_cliente)
  const canArchive = isCEO || ['gestor_projetos', 'gestor_ads', 'sucesso_cliente'].includes(user?.role || '');
  
  // Check if user can unarchive (only CEO)
  const canUnarchive = isCEO;

  // Filter churned clients that are NOT archived
  const churnedClients = clients.filter(c => c.status === 'churned' && !(c as any).archived);
  
  // Filter archived churned clients (for CEO unarchive feature)
  const archivedChurnedClients = clients.filter(c => c.status === 'churned' && (c as any).archived);

  const handleOpenArchiveDialog = (client: any) => {
    setSelectedClient(client);
    setShowGoodbyeMessage(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmGoodbye = async (hasGoodbye: boolean) => {
    if (!hasGoodbye) {
      setShowGoodbyeMessage(true);
      return;
    }

    // User confirmed they said goodbye - archive the client
    // IMPORTANT: We only set archived=true and archived_at. We do NOT change the status!
    // This way, when the client is restored from the client list, they return to the correct status.
    setIsArchiving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedClient.id);

      if (error) throw error;

      toast.success('Cliente arquivado', {
        description: `${selectedClient.name} foi arquivado com sucesso.`,
      });

      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      setConfirmDialogOpen(false);
      setSelectedClient(null);
    } catch (error: any) {
      toast.error('Erro ao arquivar cliente', {
        description: error.message,
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCloseDialog = () => {
    setConfirmDialogOpen(false);
    setSelectedClient(null);
    setShowGoodbyeMessage(false);
  };

  const handleUnarchiveClient = async (client: any) => {
    setIsUnarchiving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          archived: false,
          archived_at: null,
        } as any)
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Cliente restaurado', {
        description: `${client.name} foi desarquivado e voltou para a lista de churn.`,
      });

      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
    } catch (error: any) {
      toast.error('Erro ao desarquivar cliente', {
        description: error.message,
      });
    } finally {
      setIsUnarchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (churnedClients.length === 0 && archivedChurnedClients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserX className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">Nenhum cliente em churn</p>
        <p className="text-xs mt-1">Todos os clientes estão ativos</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Info Box - Only show if there are churned clients */}
        {churnedClients.length > 0 && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertTriangle size={14} />
              Atenção: Clientes em Churn
            </div>
            <p className="text-muted-foreground">
              {churnedClients.length} cliente{churnedClients.length !== 1 ? 's' : ''} em churn aguardando despedida e arquivamento.
            </p>
          </div>
        )}

        {/* Churned Clients List */}
        <div className="space-y-2">
          {churnedClients.length === 0 && archivedChurnedClients.length > 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-xs">Nenhum cliente em churn aguardando arquivamento</p>
            </div>
          )}
          {churnedClients.map(client => {
            const clientAny = client as any;
            const daysSinceChurn = clientAny.updated_at 
              ? differenceInDays(new Date(), new Date(clientAny.updated_at))
              : 0;

            return (
              <div
                key={client.id}
                className="p-3 bg-card border border-danger/30 rounded-lg"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                        <UserX size={14} className="text-danger" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{client.name}</h4>
                        {client.razao_social && (
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {client.razao_social}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                      daysSinceChurn > 7 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                    )}>
                      <Timer size={10} />
                      {daysSinceChurn} {daysSinceChurn === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {client.cnpj && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        CNPJ
                      </span>
                    )}
                    <span className="text-danger font-medium">CHURN</span>
                  </div>

                  {canArchive && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full gap-1.5 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                      onClick={() => handleOpenArchiveDialog(client)}
                    >
                      <Archive size={14} />
                      Arquivar Cliente
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Archived Churned Clients - Only visible for CEO */}
        {canUnarchive && archivedChurnedClients.length > 0 && (
          <>
            <div className="pt-4 border-t border-subtle">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Archive size={14} />
                Clientes Arquivados ({archivedChurnedClients.length})
              </h4>
            </div>
            <div className="space-y-2">
              {archivedChurnedClients.map(client => (
                <div
                  key={client.id}
                  className="p-3 bg-muted/50 border border-muted rounded-lg opacity-75 hover:opacity-100 transition-opacity"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Archive size={14} className="text-muted-foreground" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-muted-foreground">{client.name}</h4>
                          {client.razao_social && (
                            <p className="text-xs text-muted-foreground/70 truncate max-w-[150px]">
                              {client.razao_social}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        Arquivado
                      </span>
                    </div>

                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full gap-1.5"
                      onClick={() => handleUnarchiveClient(client)}
                      disabled={isUnarchiving}
                    >
                      <RotateCcw size={14} />
                      {isUnarchiving ? 'Restaurando...' : 'Desarquivar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Goodbye Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Archive size={20} />
              Arquivar Cliente
            </DialogTitle>
            <DialogDescription className="pt-2">
              {showGoodbyeMessage ? (
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg text-warning">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertTriangle size={16} />
                    Importante!
                  </div>
                  <p className="text-sm text-foreground">
                    Por favor, entre em contato com o cliente <strong>{selectedClient?.name}</strong> para se despedir antes de arquivá-lo.
                  </p>
                  <p className="text-xs mt-2 text-muted-foreground">
                    Isso é importante para manter um bom relacionamento, mesmo com clientes que estão saindo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Você está prestes a arquivar o cliente <strong className="text-foreground">{selectedClient?.name}</strong>.
                  </p>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium text-foreground text-center">
                      Você já se despediu do cliente?
                    </p>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {showGoodbyeMessage ? (
              <Button
                onClick={handleCloseDialog}
                className="w-full"
              >
                Entendi, vou me despedir
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleConfirmGoodbye(false)}
                >
                  Não
                </Button>
                <Button
                  onClick={() => handleConfirmGoodbye(true)}
                  disabled={isArchiving}
                  className="bg-danger hover:bg-danger/90"
                >
                  {isArchiving ? 'Arquivando...' : 'Sim, já me despedi'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
