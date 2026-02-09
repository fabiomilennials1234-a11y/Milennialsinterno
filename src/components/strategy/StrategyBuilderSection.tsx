import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClientStrategies, useDeleteStrategy, ClientStrategy } from '@/hooks/useClientStrategies';
import StrategyBuilderModal from './StrategyBuilderModal';
import { Rocket, Plus, Eye, Edit, Trash2, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
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

interface StrategyBuilderSectionProps {
  clientId: string;
  clientName: string;
}

export default function StrategyBuilderSection({ clientId, clientName }: StrategyBuilderSectionProps) {
  const { data: strategies, isLoading } = useClientStrategies(clientId);
  const deleteStrategy = useDeleteStrategy();
  
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<ClientStrategy | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleEdit = (strategy: ClientStrategy) => {
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

  const getStrategyUrl = (strategy: ClientStrategy) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/estrategia/${strategy.public_token}`;
  };

  const copyToClipboard = async (strategy: ClientStrategy) => {
    const url = getStrategyUrl(strategy);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(strategy.id);
      toast.success('Link copiado!', { description: 'O link foi copiado para a área de transferência.' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar', { description: 'Não foi possível copiar o link.' });
    }
  };

  const openStrategy = (strategy: ClientStrategy) => {
    const url = getStrategyUrl(strategy);
    window.open(url, '_blank');
  };

  const countEnabledFunnels = (strategy: ClientStrategy) => {
    let count = 0;
    if (strategy.meta_millennials_mensagem?.enabled) count++;
    if (strategy.meta_millennials_cadastro?.enabled) count++;
    if (strategy.meta_millennials_call?.enabled) count++;
    if (strategy.meta_captacao_representantes?.enabled) count++;
    if (strategy.meta_captacao_sdr?.enabled) count++;
    if (strategy.meta_disparo_email?.enabled) count++;
    if (strategy.meta_grupo_vip?.enabled) count++;
    if (strategy.meta_aumento_base?.enabled) count++;
    if (strategy.google_pmax?.enabled) count++;
    if (strategy.google_pesquisa?.enabled) count++;
    if (strategy.google_display?.enabled) count++;
    if (strategy.linkedin_vagas?.enabled) count++;
    if (strategy.linkedin_cadastro?.enabled) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-5 border border-primary/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">
              🚀 Estratégia de Funis PRO+
            </h3>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie estratégias de funis para este cliente
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
                      {countEnabledFunnels(strategy)} funis ativos
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
                    {strategy.meta_enabled && (
                      <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">📘 Meta</span>
                    )}
                    {strategy.google_enabled && (
                      <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded">🔍 Google</span>
                    )}
                    {strategy.linkedin_enabled && (
                      <span className="text-xs bg-blue-700/10 text-blue-800 px-2 py-0.5 rounded">💼 LinkedIn</span>
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
            <Rocket className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma estratégia criada ainda</p>
            <p className="text-sm">Clique em "Criar Estratégia" para começar</p>
          </div>
        )}
      </div>

      {/* Builder Modal */}
      <StrategyBuilderModal
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
            <AlertDialogTitle>Excluir Estratégia</AlertDialogTitle>
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
