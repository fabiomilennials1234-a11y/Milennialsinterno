import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, Plus, Eye, Edit, Trash2, Loader2, ExternalLink, Copy, Check, Globe, GlobeLock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import {
  useClientDiagnosticos,
  useDeleteDiagnostico,
  usePublishDiagnostico,
  calcAreaScores,
  calcNotaGeral,
  calcPrioridade,
  type DiagnosticoRecord,
} from '@/hooks/useMktplaceDiagnostico';
import DiagnosticoFormModal from './DiagnosticoFormModal';
import DiagnosticoResultView from './DiagnosticoResultView';

interface Props {
  clientId: string;
  clientName: string;
}

export default function MktplaceDiagnosticoSection({ clientId, clientName }: Props) {
  const { data: diagnosticos, isLoading } = useClientDiagnosticos(clientId);
  const deleteDiag = useDeleteDiagnostico();
  const publishDiag = usePublishDiagnostico();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiagnosticoRecord | undefined>(undefined);
  const [viewing, setViewing] = useState<DiagnosticoRecord | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleEdit = (d: DiagnosticoRecord) => {
    setEditing(d);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditing(undefined);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteDiag.mutateAsync({ id: deleteConfirmId, clientId });
    setDeleteConfirmId(null);
  };

  const getDiagUrl = (d: DiagnosticoRecord) => `${window.location.origin}/diagnostico-mktplace/${d.public_token}`;

  const handleCopyLink = async (d: DiagnosticoRecord) => {
    try {
      await navigator.clipboard.writeText(getDiagUrl(d));
      setCopiedId(d.id);
      toast.success('Link copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleTogglePublish = async (d: DiagnosticoRecord) => {
    await publishDiag.mutateAsync({ id: d.id, clientId, publish: !d.is_published });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 rounded-xl p-5 border border-purple-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">
              Diagnóstico de MKT Place
            </h3>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie diagnósticos de marketplace para este cliente
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Diagnóstico
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : diagnosticos && diagnosticos.length > 0 ? (
          <div className="space-y-3">
            {diagnosticos.map((diag) => {
              const areas = calcAreaScores(diag);
              const nota = calcNotaGeral(areas);
              const prioridade = calcPrioridade(nota);
              const notaColor = nota >= 8 ? 'text-emerald-600' : nota >= 5 ? 'text-amber-600' : 'text-red-600';
              const prioStyles: Record<string, string> = {
                Baixa: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                Média: 'bg-amber-100 text-amber-700 border-amber-300',
                Alta: 'bg-orange-100 text-orange-700 border-orange-300',
                Urgente: 'bg-red-100 text-red-700 border-red-300',
              };

              return (
                <div
                  key={diag.id}
                  className="bg-card rounded-lg border border-border p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">
                        {diag.marketplace_principal || 'Diagnóstico'}
                      </span>
                      <span className={`text-xs font-bold ${notaColor}`}>
                        {nota}/10
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${prioStyles[prioridade] || ''}`}>
                        {prioridade}
                      </Badge>
                      {diag.is_published && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                          Publicado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {diag.data_consultoria
                        ? format(new Date(diag.data_consultoria + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : 'Data não informada'}
                      {diag.responsavel_diagnostico ? ` — ${diag.responsavel_diagnostico}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Publicar / Despublicar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTogglePublish(diag)}
                      title={diag.is_published ? 'Despublicar' : 'Publicar'}
                    >
                      {diag.is_published ? <Globe className="w-4 h-4 text-emerald-500" /> : <GlobeLock className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    {/* Copiar link (só se publicado) */}
                    {diag.is_published && (
                      <Button variant="ghost" size="icon" onClick={() => handleCopyLink(diag)} title="Copiar link">
                        {copiedId === diag.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    )}
                    {/* Abrir página pública */}
                    {diag.is_published && (
                      <Button variant="ghost" size="icon" onClick={() => window.open(getDiagUrl(diag), '_blank')} title="Abrir relatório">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setViewing(diag)} className="gap-1">
                      <Eye className="w-4 h-4" />
                      Ver
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(diag)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(diag.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum diagnóstico criado ainda. Clique em "Novo Diagnóstico" para começar.
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      {isFormOpen && (
        <DiagnosticoFormModal
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          clientId={clientId}
          clientName={clientName}
          editing={editing}
        />
      )}

      {/* Modal de visualização */}
      {viewing && (
        <DiagnosticoResultView
          isOpen={!!viewing}
          onClose={() => setViewing(undefined)}
          diagnostico={viewing}
        />
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir diagnóstico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O diagnóstico será excluído permanentemente.
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
    </div>
  );
}
