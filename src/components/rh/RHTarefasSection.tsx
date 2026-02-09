import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  GripVertical,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Loader2,
  Archive,
  ArchiveRestore
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useRHTarefas,
  useCreateRHTarefa,
  useMoveRHTarefa,
  useDeleteRHTarefa,
  useUpdateRHTarefa,
  TAREFA_STATUSES,
  RHTarefa,
  TarefaStatus,
  getTarefaStatusLabel,
} from '@/hooks/useRHTarefas';
import { useRHVagas, useRHVagaBriefings, useMoveRHVaga, useCreateRHAtividade, RHVaga } from '@/hooks/useRH';
import RegistrarVagaModal from './RegistrarVagaModal';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { fireCelebration } from '@/lib/confetti';

const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-blue-500/10 text-blue-600',
  alta: 'bg-amber-500/10 text-amber-600',
  urgente: 'bg-danger/10 text-danger',
};

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const STATUS_HEADER_CLASSES: Record<string, string> = {
  a_fazer: 'kanban-header-todo',
  fazendo: 'kanban-header-doing',
  feitas: 'kanban-header-done',
};

interface TarefaCardProps {
  tarefa: RHTarefa;
  index: number;
  onDelete: () => void;
  onArchive: () => void;
  canMove: boolean;
}

function TarefaCard({ tarefa, index, onDelete, onArchive, canMove }: TarefaCardProps) {
  const isOverdue = tarefa.data_limite && new Date(tarefa.data_limite) < new Date() && tarefa.status !== 'feitas';
  const isDone = tarefa.status === 'feitas';

  return (
    <Draggable draggableId={tarefa.id} index={index} isDragDisabled={!canMove}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            'group bg-card border rounded-lg p-3 transition-all hover:shadow-md hover:border-primary/30',
            snapshot.isDragging && 'shadow-lg rotate-1 scale-105',
            isOverdue && 'border-l-4 border-l-danger',
            isDone && 'border-l-4 border-l-success opacity-75'
          )}
        >
          <div className="flex items-start gap-2">
            {canMove && (
              <div {...provided.dragHandleProps} className="opacity-0 group-hover:opacity-50 transition-opacity mt-0.5">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  ) : tarefa.status === 'fazendo' ? (
                    <Loader2 className="w-4 h-4 text-warning animate-spin flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <p className={cn(
                    'text-sm font-medium',
                    isDone && 'line-through text-muted-foreground'
                  )}>
                    {tarefa.titulo}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onArchive}>
                      <Archive className="w-4 h-4 mr-2" />
                      Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-danger">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {tarefa.descricao && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tarefa.descricao}</p>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[tarefa.prioridade])}>
                  {PRIORITY_LABELS[tarefa.prioridade]}
                </Badge>
                
                {tarefa.data_limite && (
                  <div className={cn(
                    'flex items-center gap-1 text-xs',
                    isOverdue ? 'text-danger' : 'text-muted-foreground'
                  )}>
                    <Calendar className="w-3 h-3" />
                    <span>{format(new Date(tarefa.data_limite), 'dd/MM', { locale: ptBR })}</span>
                  </div>
                )}

                {tarefa.responsavel_nome && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-[80px]">{tarefa.responsavel_nome}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// Add Task Modal
interface AddTarefaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AddTarefaModal({ isOpen, onClose }: AddTarefaModalProps) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [dataLimite, setDataLimite] = useState('');
  
  const createTarefa = useCreateRHTarefa();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    try {
      await createTarefa.mutateAsync({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        prioridade,
        data_limite: dataLimite || undefined,
        created_by: user?.id,
        created_by_name: user?.name,
      });
      toast.success('Tarefa criada!');
      setTitulo('');
      setDescricao('');
      setPrioridade('media');
      setDataLimite('');
      onClose();
    } catch (error) {
      toast.error('Erro ao criar tarefa');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa do RH</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Título *</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="O que precisa ser feito?"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes da tarefa..."
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Data Limite</label>
              <Input
                type="date"
                value={dataLimite}
                onChange={(e) => setDataLimite(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTarefa.isPending}>
              {createTarefa.isPending ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RHTarefasSection() {
  const { user } = useAuth();
  const { data: tarefas = [], isLoading } = useRHTarefas();
  const { data: vagas = [] } = useRHVagas();
  const { data: briefingsData = [] } = useRHVagaBriefings();
  const moveTarefa = useMoveRHTarefa();
  const deleteTarefa = useDeleteRHTarefa();
  const updateTarefa = useUpdateRHTarefa();
  const moveVaga = useMoveRHVaga();
  const createAtividade = useCreateRHAtividade();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingToColumn, setIsAddingToColumn] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  
  // State for registration modal
  const [registrarVagaModal, setRegistrarVagaModal] = useState<{ tarefa: RHTarefa; vaga: RHVaga } | null>(null);

  const canMove = user?.role === 'ceo' || user?.role === 'gestor_projetos';

  // Create briefings map
  const briefingsMap = useMemo(() => {
    const map = new Map<string, any>();
    briefingsData.forEach((b: any) => map.set(b.vaga_id, b));
    return map;
  }, [briefingsData]);

  // Group tarefas by status (excluding archived)
  const tarefasByStatus = useMemo(() => {
    const grouped = new Map<TarefaStatus, RHTarefa[]>();
    TAREFA_STATUSES.forEach(status => grouped.set(status.id, []));
    
    tarefas
      .filter(t => !t.archived)
      .forEach(tarefa => {
        const statusTarefas = grouped.get(tarefa.status as TarefaStatus) || [];
        statusTarefas.push(tarefa);
        grouped.set(tarefa.status as TarefaStatus, statusTarefas);
      });
    
    return grouped;
  }, [tarefas]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canMove) return;
    
    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId as TarefaStatus;
    const oldStatus = source.droppableId as TarefaStatus;
    
    // Find the tarefa being moved
    const tarefa = tarefas.find(t => t.id === draggableId);
    if (!tarefa) return;

    // If moving "Registrar VAGA" task to "feitas", open registration modal
    if (newStatus === 'feitas' && oldStatus !== 'feitas' && tarefa.tipo === 'registrar_vaga' && tarefa.vaga_id) {
      const vaga = vagas.find(v => v.id === tarefa.vaga_id);
      if (vaga) {
        setRegistrarVagaModal({ tarefa, vaga });
        return; // Don't move yet, wait for modal completion
      }
    }

    // If moving "Publicar Campanha" task to "feitas", move vaga to processo_seletivo
    if (newStatus === 'feitas' && oldStatus !== 'feitas' && tarefa.tipo === 'publicar_campanha' && tarefa.vaga_id) {
      const vaga = vagas.find(v => v.id === tarefa.vaga_id);
      if (vaga) {
        try {
          // Move task to feitas
          await moveTarefa.mutateAsync({
            id: draggableId,
            status: newStatus,
            position: destination.index,
          });
          
          // Update task with completion time
          await updateTarefa.mutateAsync({
            id: tarefa.id,
            completed_at: new Date().toISOString(),
          });
          
          // Move vaga to processo_seletivo
          await moveVaga.mutateAsync({
            id: vaga.id,
            status: 'processo_seletivo',
            position: 0,
          });
          
          // Log activity
          await createAtividade.mutateAsync({
            vaga_id: vaga.id,
            user_id: user?.id,
            user_name: user?.name,
            action: 'Campanha publicada - Processo seletivo iniciado',
            details: { from_status: 'vaga_registrada', to_status: 'processo_seletivo' },
          });
          
          fireCelebration();
          toast.success('Campanha publicada! Processo seletivo iniciado.');
          return;
        } catch (error) {
          console.error('Error completing publish campaign:', error);
          toast.error('Erro ao publicar campanha');
          return;
        }
      }
    }
    
    // Fire confetti when completing task
    if (newStatus === 'feitas' && oldStatus !== 'feitas') {
      fireCelebration();
    }
    
    try {
      await moveTarefa.mutateAsync({
        id: draggableId,
        status: newStatus,
        position: destination.index,
      });
      
      toast.success(`Tarefa movida para ${getTarefaStatusLabel(newStatus)}`);
    } catch (error) {
      console.error('Error moving tarefa:', error);
      toast.error('Erro ao mover tarefa');
    }
  };

  // Handler when vaga registration is completed
  const handleRegistrarVagaComplete = async () => {
    if (!registrarVagaModal) return;
    
    const { tarefa } = registrarVagaModal;
    
    try {
      // Move task to feitas
      await moveTarefa.mutateAsync({
        id: tarefa.id,
        status: 'feitas',
        position: 0,
      });
      
      // Update task with completion time
      await updateTarefa.mutateAsync({
        id: tarefa.id,
        completed_at: new Date().toISOString(),
      });
      
      // The modal already moved the vaga and logged activity
      fireCelebration();
    } catch (error) {
      console.error('Error completing registration:', error);
      toast.error('Erro ao atualizar tarefa');
    } finally {
      setRegistrarVagaModal(null);
    }
  };

  const handleDelete = async (tarefa: RHTarefa) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    
    try {
      await deleteTarefa.mutateAsync(tarefa.id);
      toast.success('Tarefa excluída');
    } catch (error) {
      toast.error('Erro ao excluir tarefa');
    }
  };

  const handleArchive = async (tarefa: RHTarefa) => {
    try {
      await updateTarefa.mutateAsync({
        id: tarefa.id,
        archived: true,
        archived_at: new Date().toISOString(),
      });
      toast.success('Tarefa arquivada');
    } catch (error) {
      toast.error('Erro ao arquivar tarefa');
    }
  };

  const handleArchiveAllDone = async () => {
    const doneTasks = tarefasByStatus.get('feitas') || [];
    if (doneTasks.length === 0) return;
    
    try {
      await Promise.all(
        doneTasks.map(t => 
          updateTarefa.mutateAsync({
            id: t.id,
            archived: true,
            archived_at: new Date().toISOString(),
          })
        )
      );
      toast.success(`${doneTasks.length} tarefa(s) arquivada(s)`);
    } catch (error) {
      toast.error('Erro ao arquivar tarefas');
    }
  };

  const handleQuickAdd = async (status: TarefaStatus) => {
    if (!quickAddTitle.trim()) return;
    
    const createTarefa = useCreateRHTarefa();
    try {
      // For now, we'll use the modal for creation
      setIsAddModalOpen(true);
      setIsAddingToColumn(null);
      setQuickAddTitle('');
    } catch (error) {
      toast.error('Erro ao criar tarefa');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Tarefas do RH</h2>
        </div>
      </div>

      {/* Vertical Kanban - Like Ads Manager */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {TAREFA_STATUSES.map(status => {
            const statusTarefas = tarefasByStatus.get(status.id) || [];
            const hasDoneTasks = status.id === 'feitas' && statusTarefas.length > 0;
            
            return (
              <div key={status.id}>
                {/* Status Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={STATUS_HEADER_CLASSES[status.id]}>
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                      {statusTarefas.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {status.id === 'a_fazer' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setIsAddModalOpen(true)}
                      >
                        <Plus size={12} />
                        Adicionar cartão
                      </Button>
                    )}
                    
                    {hasDoneTasks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={handleArchiveAllDone}
                        disabled={updateTarefa.isPending}
                      >
                        <Archive size={12} />
                        Arquivar concluídas
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tasks Droppable */}
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'min-h-[60px] rounded-xl p-2 transition-all duration-200',
                        snapshot.isDraggingOver && 'bg-primary/10 ring-2 ring-primary/30'
                      )}
                    >
                      <div className="space-y-2">
                        {statusTarefas.map((tarefa, index) => (
                          <TarefaCard
                            key={tarefa.id}
                            tarefa={tarefa}
                            index={index}
                            onDelete={() => handleDelete(tarefa)}
                            onArchive={() => handleArchive(tarefa)}
                            canMove={canMove}
                          />
                        ))}
                        {provided.placeholder}
                        
                        {/* Empty state */}
                        {statusTarefas.length === 0 && !snapshot.isDraggingOver && (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            Nenhuma tarefa
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Add Task Modal */}
      <AddTarefaModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Registrar Vaga Modal - opens when completing "Registrar VAGA" task */}
      {registrarVagaModal && (
        <RegistrarVagaModal
          vaga={registrarVagaModal.vaga}
          isOpen={!!registrarVagaModal}
          onClose={() => setRegistrarVagaModal(null)}
          onComplete={handleRegistrarVagaComplete}
        />
      )}
    </div>
  );
}
