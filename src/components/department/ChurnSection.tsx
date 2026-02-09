import { useState } from 'react';
import { DepartmentClient } from '@/hooks/useDepartmentManager';
import { UserX, Archive, AlertTriangle, Timer, Building2, FileText } from 'lucide-react';
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

interface ChurnSectionProps {
  clients: DepartmentClient[];
  isLoading: boolean;
  department: 'sucesso_cliente' | 'consultor_comercial' | 'financeiro';
  // Financeiro shows distrato option instead of archive
  showDistrato?: boolean;
}

export default function ChurnSection({ 
  clients, 
  isLoading, 
  department,
  showDistrato = false 
}: ChurnSectionProps) {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<DepartmentClient | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [showGoodbyeMessage, setShowGoodbyeMessage] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [distratoDialogOpen, setDistratoDialogOpen] = useState(false);

  // Filter churned clients that are NOT archived
  const churnedClients = clients.filter(c => c.status === 'churned' && !c.archived);

  const handleOpenArchiveDialog = (client: DepartmentClient) => {
    setSelectedClient(client);
    setShowGoodbyeMessage(false);
    setConfirmDialogOpen(true);
  };

  const handleOpenDistratoDialog = (client: DepartmentClient) => {
    setSelectedClient(client);
    setDistratoDialogOpen(true);
  };

  const handleConfirmGoodbye = async (hasGoodbye: boolean) => {
    if (!hasGoodbye) {
      setShowGoodbyeMessage(true);
      return;
    }

    setIsArchiving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedClient!.id);

      if (error) throw error;

      toast.success('Cliente arquivado', {
        description: `${selectedClient!.name} foi arquivado com sucesso.`,
      });

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['comercial-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['sucesso-clients'] });
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

  const handleDistrato = async () => {
    setIsArchiving(true);
    try {
      // For financeiro, we archive the client directly (distrato process)
      const { error } = await supabase
        .from('clients')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedClient!.id);

      if (error) throw error;

      toast.success('Distrato realizado', {
        description: `${selectedClient!.name} foi arquivado após distrato.`,
      });

      queryClient.invalidateQueries({ queryKey: ['financeiro-churned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      
      setDistratoDialogOpen(false);
      setSelectedClient(null);
    } catch (error: any) {
      toast.error('Erro ao realizar distrato', {
        description: error.message,
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCloseDialog = () => {
    setConfirmDialogOpen(false);
    setDistratoDialogOpen(false);
    setSelectedClient(null);
    setShowGoodbyeMessage(false);
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

  if (churnedClients.length === 0) {
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
        {/* Info Box */}
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle size={14} />
            {showDistrato ? 'Clientes para Distrato' : 'Atenção: Clientes em Churn'}
          </div>
          <p className="text-muted-foreground">
            {churnedClients.length} cliente{churnedClients.length !== 1 ? 's' : ''} em churn 
            {showDistrato ? ' aguardando processo de distrato.' : ' aguardando despedida e arquivamento.'}
          </p>
        </div>

        {/* Churned Clients List */}
        <div className="space-y-2">
          {churnedClients.map(client => {
            const daysSinceChurn = client.updated_at 
              ? differenceInDays(new Date(), new Date(client.updated_at))
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

                  {showDistrato ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full gap-1.5 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                      onClick={() => handleOpenDistratoDialog(client)}
                    >
                      <FileText size={14} />
                      Realizar Distrato
                    </Button>
                  ) : (
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

      {/* Distrato Dialog (Financeiro) */}
      <Dialog open={distratoDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <FileText size={20} />
              Realizar Distrato
            </DialogTitle>
            <DialogDescription className="pt-2">
              <div className="space-y-3">
                <p>
                  Você está prestes a realizar o distrato do cliente <strong className="text-foreground">{selectedClient?.name}</strong>.
                </p>
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                  <p className="font-medium text-warning mb-1">Atenção:</p>
                  <p className="text-muted-foreground">
                    Após o distrato, o cliente será arquivado e poderá ser restaurado apenas pela lista de clientes.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDistrato}
              disabled={isArchiving}
              className="bg-danger hover:bg-danger/90"
            >
              {isArchiving ? 'Processando...' : 'Confirmar Distrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
