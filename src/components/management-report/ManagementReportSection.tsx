import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useManagementReports,
  useDeleteManagementReport,
  useManagementReportStatus,
} from '@/hooks/useManagementReports';
import ManagementReportFormModal from './ManagementReportFormModal';
import { ClipboardList, Plus, Eye, Trash2, Loader2, Clock, AlertTriangle, FileQuestion } from 'lucide-react';
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

export default function ManagementReportSection({ clientId, clientName }: Props) {
  const { data: reports, isLoading } = useManagementReports(clientId);
  const { daysSince, daysRemaining, severity, lastReportDate } = useManagementReportStatus(clientId);
  const deleteReport = useDeleteManagementReport();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isOverdue = severity === 'red' && daysRemaining === 0;
  const isUrgent = severity === 'orange' || severity === 'yellow';
  const isPending = !lastReportDate && daysSince === 0;

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteReport.mutateAsync({ id: deleteConfirmId, clientId });
    setDeleteConfirmId(null);
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
        {/* Header */}
        <div className="section-header section-header-cyan">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <ClipboardList size={18} className="text-foreground" />
              <h3 className="font-semibold text-foreground">Relatorio de Gestao (MENSAL)</h3>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              Gerar Relatorio
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 30-day cycle counter */}
          {isPending ? (
            <div className="p-3 rounded-lg border bg-muted/30 border-muted-foreground/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileQuestion size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Relatorio pendente</p>
                  <p className="text-[10px] text-muted-foreground">
                    Nenhum relatorio de gestao criado ainda
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-sm font-bold px-3">
                --
              </Badge>
            </div>
          ) : (
            <div className={`p-3 rounded-lg border flex items-center justify-between ${
              isOverdue
                ? 'bg-destructive/10 border-destructive/20'
                : isUrgent
                  ? 'bg-warning/10 border-warning/20'
                  : 'bg-primary/10 border-primary/20'
            }`}>
              <div className="flex items-center gap-2">
                {isOverdue ? (
                  <AlertTriangle size={16} className="text-destructive" />
                ) : (
                  <Clock size={16} className={isUrgent ? 'text-warning' : 'text-primary'} />
                )}
                <div>
                  <p className="text-xs font-medium">
                    {isOverdue ? 'Relatorio vencido!' : 'Proximo relatorio'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {daysSince} dia{daysSince !== 1 ? 's' : ''} desde o ultimo relatorio
                  </p>
                </div>
              </div>
              <Badge
                variant={isOverdue ? 'destructive' : 'secondary'}
                className="text-sm font-bold px-3"
              >
                {isOverdue ? `+${daysSince - 30}d` : `${daysRemaining}d`}
              </Badge>
            </div>
          )}

          {/* Reports list */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-sm">Nenhum relatorio criado ainda</p>
              <p className="text-xs mt-1">Clique em "Gerar Relatorio" para comecar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-3 rounded-lg border bg-card border-subtle hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        Gestao — {report.reference_month}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {report.created_at
                          ? format(new Date(report.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {report.public_token && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            const url = `${window.location.origin}/relatorio-gestao/${report.public_token}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <Eye size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteConfirmId(report.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <ManagementReportFormModal
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
              Tem certeza que deseja excluir este relatorio de gestao? Esta acao nao pode ser desfeita.
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
