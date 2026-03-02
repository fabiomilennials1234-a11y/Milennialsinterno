import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOutboundStrategies, useDeleteOutboundStrategy, OutboundStrategy } from '@/hooks/useOutboundStrategies';
import OutboundStrategyBuilderModal from './OutboundStrategyBuilderModal';
import { Target, Plus, Edit, Trash2, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
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

export default function OutboundStrategyBuilderSection({ clientId, clientName }: Props) {
  const { data: strategies, isLoading } = useOutboundStrategies(clientId);
  const deleteStrategy = useDeleteOutboundStrategy();

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<OutboundStrategy | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleEdit = (strategy: OutboundStrategy) => {
    setEditingStrategy(strategy);
    setIsBuilderOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteStrategy.mutateAsync({ id: deleteConfirmId, clientId });
    setDeleteConfirmId(null);
  };

  const handleCloseBuilder = () => {
    setIsBuilderOpen(false);
    setEditingStrategy(undefined);
  };

  const getStrategyUrl = (strategy: OutboundStrategy) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/estrategia-outbound/${strategy.public_token}`;
  };

  const copyToClipboard = async (strategy: OutboundStrategy) => {
    const url = getStrategyUrl(strategy);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(strategy.id);
      toast.success('Link copiado!', { description: 'O link foi copiado para a área de transferência.' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar', { description: 'Não foi possível copiar o link.' });
    }
  };

  const openStrategy = (strategy: OutboundStrategy) => {
    const url = getStrategyUrl(strategy);
    window.open(url, '_blank');
  };

  const countEnabledSubStrategies = (strategy: OutboundStrategy) => {
    let count = 0;
    if (strategy.pa_linkedin_prospecting?.enabled) count++;
    if (strategy.pa_cold_calling?.enabled) count++;
    if (strategy.pa_cold_email?.enabled) count++;
    if (strategy.pa_whatsapp_outreach?.enabled) count++;
    if (strategy.rb_email_reactivation?.enabled) count++;
    if (strategy.rb_whatsapp_nurturing?.enabled) count++;
    if (strategy.rb_upsell_crosssell?.enabled) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl p-5 border border-orange-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">
              Estratégia Outbound PRO+
            </h3>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie estratégias de outbound para este cliente
            </p>
          </div>
          <Button onClick={() => setIsBuilderOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Estratégia
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : strategies && strategies.length > 0 ? (
          <div className="space-y-3">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="bg-card rounded-lg border border-border p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">
                      Estratégia #{strategy.id.slice(0, 8)}
                    </span>
                    <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                      {countEnabledSubStrategies(strategy)} canais ativos
                    </span>
                    {strategy.is_published && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Publicada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Criada em {format(new Date(strategy.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {(strategy.prospeccao_ativa_enabled || strategy.ambos_enabled) && (
                      <span className="text-xs bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded">Prospecção Ativa</span>
                    )}
                    {(strategy.remarketing_base_enabled || strategy.ambos_enabled) && (
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">Remarketing de Base</span>
                    )}
                    {strategy.ambos_enabled && (
                      <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded">Ambos</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStrategy(strategy)}
                    className="gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(strategy)}
                    className="gap-1"
                  >
                    {copiedId === strategy.id ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copiar Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(strategy)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(strategy.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma estratégia outbound criada ainda</p>
            <p className="text-sm">Clique em "Criar Estratégia" para começar</p>
          </div>
        )}
      </div>

      {/* Builder Modal */}
      <OutboundStrategyBuilderModal
        isOpen={isBuilderOpen}
        onClose={handleCloseBuilder}
        clientId={clientId}
        clientName={clientName}
        existingStrategy={editingStrategy}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Estratégia Outbound</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta estratégia? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStrategy.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
