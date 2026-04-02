import { useState } from 'react';
import { ShieldAlert, Search, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import CSColumnScroll from './CSColumnScroll';
import { useApproveCXValidation, type CXPendingClient } from '@/hooks/useCXValidation';

interface Props {
  clients: CXPendingClient[];
}

export default function CSPendenciaCXColumn({ clients }: Props) {
  const [search, setSearch] = useState('');
  const [confirmClientId, setConfirmClientId] = useState<string | null>(null);
  const approveValidation = useApproveCXValidation();

  // Filtrar apenas clientes pendente_aprovacao (que passaram pelo "Não")
  const pendingClients = clients.filter(c => c.cx_validation_status === 'pendente_aprovacao');

  const filtered = pendingClients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.razao_social?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async () => {
    if (!confirmClientId) return;
    await approveValidation.mutateAsync({ clientId: confirmClientId });
    setConfirmClientId(null);
  };

  return (
    <>
      <div className="w-[360px] shrink-0 flex flex-col h-full">
        {/* Header */}
        <div className="section-header section-header-danger rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-white" />
            <h3 className="font-semibold text-white">Pendência CX</h3>
          </div>
          <Badge variant="secondary" className="text-xs font-bold">
            {pendingClients.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="p-3 bg-card border-x border-subtle">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Client list */}
        <CSColumnScroll>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldAlert className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-sm">Nenhum cliente pendente</p>
              <p className="text-xs mt-1">Clientes rejeitados no CX aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(client => (
                <div
                  key={client.id}
                  className="p-3 bg-card border border-destructive/30 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{client.name}</p>
                      {client.razao_social && (
                        <p className="text-xs text-muted-foreground truncate">{client.razao_social}</p>
                      )}
                      {client.niche && (
                        <p className="text-xs text-muted-foreground mt-0.5">{client.niche}</p>
                      )}
                    </div>
                    <Badge variant="destructive" className="text-[10px] shrink-0 animate-pulse">
                      Pendente
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-2 h-7 text-xs gap-1"
                    onClick={() => setConfirmClientId(client.id)}
                    disabled={approveValidation.isPending}
                  >
                    <CheckCircle size={12} />
                    Aprovar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CSColumnScroll>
      </div>

      {/* Confirmação de aprovação */}
      <AlertDialog open={!!confirmClientId} onOpenChange={() => setConfirmClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao aprovar, o cliente será liberado para início do projeto e a etiqueta
              "ESPERAR VALIDAÇÃO" será removida do Gestor de ADS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveValidation.isPending}>
              Sim, aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
