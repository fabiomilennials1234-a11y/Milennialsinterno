import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useClientNps,
  useDeleteClientNps,
  getNpsClassification,
  getNpsColor,
  getNpsBgColor,
  getNpsLabel,
} from '@/hooks/useClientNps';
import ClientNpsFormModal from './ClientNpsFormModal';
import { ThumbsUp, Plus, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface Props {
  clientId: string;
  clientName: string;
}

export default function ClientNpsSection({ clientId, clientName }: Props) {
  const { data: npsResponses, isLoading } = useClientNps(clientId);
  const deleteNps = useDeleteClientNps();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const latestNps = npsResponses?.[0] ?? null;
  const latestClassification = latestNps ? getNpsClassification(latestNps.nps_score) : null;

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteNps.mutateAsync({ id: deleteConfirmId, clientId });
    setDeleteConfirmId(null);
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
        {/* Header */}
        <div className="section-header section-header-teal">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <ThumbsUp size={18} className="text-foreground" />
              <h3 className="font-semibold text-foreground">NPS do Cliente</h3>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              Registrar NPS
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Latest NPS */}
          {latestNps && latestClassification && (
            <div className={`p-3 rounded-lg border flex items-center justify-between ${getNpsBgColor(latestClassification)}`}>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-black tabular-nums ${getNpsColor(latestClassification)}`}>
                  {latestNps.nps_score}
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${getNpsColor(latestClassification)} border-current/30`}
                  >
                    {getNpsLabel(latestClassification)}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {latestNps.reference_month}
                  </p>
                </div>
              </div>
              {latestNps.score_reason && (
                <p className="text-xs text-muted-foreground max-w-[200px] truncate ml-2">
                  {latestNps.score_reason}
                </p>
              )}
            </div>
          )}

          {/* NPS History */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : !npsResponses || npsResponses.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <ThumbsUp className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-sm">Nenhum NPS registrado</p>
              <p className="text-xs mt-1">Clique em "Registrar NPS" para comecar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {npsResponses.map((nps) => {
                const classification = getNpsClassification(nps.nps_score);
                return (
                  <div
                    key={nps.id}
                    className="p-3 rounded-lg border bg-card border-subtle hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`text-lg font-bold tabular-nums ${getNpsColor(classification)}`}>
                          {nps.nps_score}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${getNpsColor(classification)} border-current/30`}
                            >
                              {getNpsLabel(classification)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {nps.reference_month}
                            </span>
                          </div>
                          {nps.score_reason && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {nps.score_reason}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {nps.created_at
                              ? format(new Date(nps.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })
                              : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive flex-shrink-0"
                        onClick={() => setDeleteConfirmId(nps.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <ClientNpsFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        clientId={clientId}
        clientName={clientName}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de NPS? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
