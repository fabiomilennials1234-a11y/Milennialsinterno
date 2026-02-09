import React, { useState, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Plus, 
  MoreHorizontal, 
  Archive, 
  Trash2, 
  AlertTriangle,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  GripVertical,
  Users,
  FileText,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useRHVagas, 
  useRHVagaBriefings, 
  useMoveRHVaga, 
  useArchiveRHVaga, 
  useUnarchiveRHVaga,
  useDeleteRHVaga,
  useCreateRHAtividade,
  useRHJustificativas,
  RH_STATUSES,
  RHVaga,
  RHVagaBriefing,
  RHJustificativa,
  isVagaOverdue,
  getStatusLabel,
} from '@/hooks/useRH';
import { useCandidatoCounts } from '@/hooks/useRHCandidatos';
import { useRHDelayNotifications } from '@/hooks/useRHDelayNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateRHVagaModal from './CreateRHVagaModal';
import RHVagaDetailModal from './RHVagaDetailModal';
import RHDelayModal from './RHDelayModal';
import RHDashboard from './RHDashboard';
import VagaRegistradaModal from './VagaRegistradaModal';
import ProcessoSeletivoModal from './ProcessoSeletivoModal';
import RHTarefasSection from './RHTarefasSection';

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-danger/10 text-danger',
};

// Check if user can create/move/comment
function useRHPermissions() {
  const { user } = useAuth();
  const role = user?.role;
  
  return {
    canCreate: role === 'ceo' || role === 'gestor_projetos',
    canMove: role === 'ceo' || role === 'gestor_projetos',
    canComment: role === 'ceo' || role === 'gestor_projetos',
    canEdit: role === 'ceo',
    canDelete: role === 'ceo',
    isViewOnly: role !== 'ceo' && role !== 'gestor_projetos',
  };
}

interface VagaCardProps {
  vaga: RHVaga;
  briefing?: RHVagaBriefing;
  onClick: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onVagasPreenchidas?: () => void;
  permissions: ReturnType<typeof useRHPermissions>;
  index: number;
  isProcessoSeletivo?: boolean;
  isArchived?: boolean;
}

function VagaCard({ vaga, briefing, onClick, onArchive, onUnarchive, onDelete, onVagasPreenchidas, permissions, index, isProcessoSeletivo, isArchived }: VagaCardProps) {
  const isOverdue = isVagaOverdue(vaga, briefing);
  const { counts, total } = useCandidatoCounts(isProcessoSeletivo ? vaga.id : '');
  
  return (
    <Draggable draggableId={vaga.id} index={index} isDragDisabled={!permissions.canMove || isProcessoSeletivo || isArchived}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`
            group bg-card border rounded-xl p-3 cursor-pointer transition-all
            hover:shadow-md hover:border-primary/30
            ${snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : ''}
            ${isOverdue && !isArchived ? 'border-l-4 border-l-danger' : ''}
            ${isProcessoSeletivo ? 'hover:bg-primary/5' : ''}
            ${isArchived ? 'opacity-60 bg-muted/50' : ''}
          `}
          onClick={onClick}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {permissions.canMove && !isProcessoSeletivo && !isArchived && (
                <div {...provided.dragHandleProps} className="opacity-0 group-hover:opacity-50 transition-opacity">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <h4 className={`font-medium text-sm truncate ${isArchived ? 'line-through text-muted-foreground' : ''}`}>
                {briefing?.nome_vaga || vaga.title}
              </h4>
            </div>
            
            {!permissions.isViewOnly && !isProcessoSeletivo && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isArchived ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnarchive(); }}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Desarquivar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
                      <Archive className="w-4 h-4 mr-2" />
                      Arquivar
                    </DropdownMenuItem>
                  )}
                  {permissions.canDelete && (
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="text-danger"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Briefing info */}
          {briefing && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span className="truncate">{briefing.area_squad}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="w-3 h-3" />
                <span>{briefing.nivel} • {briefing.regime}</span>
              </div>
            </div>
          )}

          {/* Candidate count for processo seletivo */}
          {isProcessoSeletivo && (
            <div className="mt-2 flex items-center gap-2 text-xs text-primary">
              <Users className="w-3 h-3" />
              <span>{total} candidato{total !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            {!isProcessoSeletivo ? (
              <Badge variant="outline" className={PRIORITY_COLORS[vaga.priority] || PRIORITY_COLORS.medium}>
                {vaga.priority === 'urgent' ? 'Urgente' : vaga.priority === 'high' ? 'Alta' : vaga.priority === 'medium' ? 'Média' : 'Baixa'}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Clique para gerenciar
              </Badge>
            )}
            
            {briefing?.data_limite && (
              <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-danger' : 'text-muted-foreground'}`}>
                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(briefing.data_limite), 'dd/MM', { locale: ptBR })}</span>
              </div>
            )}
          </div>

          {/* Vagas Preenchidas button for processo seletivo */}
          {isProcessoSeletivo && !permissions.isViewOnly && onVagasPreenchidas && (
            <Button
              variant="default"
              size="sm"
              className="w-full mt-3 bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 text-success-foreground shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                onVagasPreenchidas();
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              ✓ Vagas Preenchidas
            </Button>
          )}
        </div>
      )}
    </Draggable>
  );
}

interface ColumnProps {
  status: typeof RH_STATUSES[number];
  vagas: RHVaga[];
  briefings: Map<string, RHVagaBriefing>;
  onCardClick: (vaga: RHVaga) => void;
  onArchive: (vaga: RHVaga) => void;
  onUnarchive: (vaga: RHVaga) => void;
  onDelete: (vaga: RHVaga) => void;
  onVagasPreenchidas?: (vaga: RHVaga) => void;
  permissions: ReturnType<typeof useRHPermissions>;
  onCreateCard?: () => void;
  isProcessoSeletivo?: boolean;
  isArchived?: boolean;
}

function Column({ status, vagas, briefings, onCardClick, onArchive, onUnarchive, onDelete, onVagasPreenchidas, permissions, onCreateCard, isProcessoSeletivo, isArchived }: ColumnProps) {
  const [isOpen, setIsOpen] = useState(true);
  const overdueCount = vagas.filter(v => isVagaOverdue(v, briefings.get(v.id))).length;

  return (
    <div className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div 
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl"
            style={{ borderLeft: `4px solid ${status.color}` }}
          >
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h3 className="font-semibold text-sm">{status.label}</h3>
              <Badge variant="secondary" className="text-xs">{vagas.length}</Badge>
              {overdueCount > 0 && !isProcessoSeletivo && !isArchived && (
                <Badge variant="destructive" className="text-xs">{overdueCount}</Badge>
              )}
            </div>
            {permissions.canCreate && status.id === 'solicitacao_vaga' && onCreateCard && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onCreateCard(); }}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <Droppable droppableId={status.id} isDropDisabled={isProcessoSeletivo || isArchived}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`
                  p-2 min-h-[100px] space-y-2 transition-colors
                  ${snapshot.isDraggingOver && !isProcessoSeletivo && !isArchived ? 'bg-primary/5' : ''}
                `}
              >
                {vagas.map((vaga, index) => (
                  <VagaCard
                    key={vaga.id}
                    vaga={vaga}
                    briefing={briefings.get(vaga.id)}
                    onClick={() => onCardClick(vaga)}
                    onArchive={() => onArchive(vaga)}
                    onUnarchive={() => onUnarchive(vaga)}
                    onDelete={() => onDelete(vaga)}
                    onVagasPreenchidas={isProcessoSeletivo && onVagasPreenchidas ? () => onVagasPreenchidas(vaga) : undefined}
                    permissions={permissions}
                    index={index}
                    isProcessoSeletivo={isProcessoSeletivo}
                    isArchived={isArchived}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function RHKanbanBoard() {
  const { user } = useAuth();
  const permissions = useRHPermissions();
  
  const { data: vagas = [], isLoading } = useRHVagas();
  const { data: briefingsData = [] } = useRHVagaBriefings();
  const { data: justificativas = [] } = useRHJustificativas();
  
  const moveVaga = useMoveRHVaga();
  const archiveVaga = useArchiveRHVaga();
  const unarchiveVaga = useUnarchiveRHVaga();
  const deleteVaga = useDeleteRHVaga();
  const createAtividade = useCreateRHAtividade();

  // Delay notifications hook
  const { 
    currentNotification, 
    pendingCount, 
    dismissCurrent, 
    markAsJustified 
  } = useRHDelayNotifications();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedVaga, setSelectedVaga] = useState<RHVaga | null>(null);
  const [delayModalVaga, setDelayModalVaga] = useState<RHVaga | null>(null);
  const [autoDelayModalOpen, setAutoDelayModalOpen] = useState(false);
  
  // New states for the new flow
  const [vagaRegistradaModal, setVagaRegistradaModal] = useState<RHVaga | null>(null);
  const [processoSeletivoModal, setProcessoSeletivoModal] = useState<RHVaga | null>(null);
  const [pendingMove, setPendingMove] = useState<{ vagaId: string; newStatus: string; position: number } | null>(null);

  // Show auto delay modal when there's a pending notification
  useEffect(() => {
    if (currentNotification && !autoDelayModalOpen && !delayModalVaga) {
      setAutoDelayModalOpen(true);
      setDelayModalVaga(currentNotification.vaga);
    }
  }, [currentNotification, autoDelayModalOpen, delayModalVaga]);

  // Create briefings map
  const briefingsMap = useMemo(() => {
    const map = new Map<string, RHVagaBriefing>();
    briefingsData.forEach(b => map.set(b.vaga_id, b));
    return map;
  }, [briefingsData]);

  // Group vagas by status
  const vagasByStatus = useMemo(() => {
    const grouped = new Map<string, RHVaga[]>();
    RH_STATUSES.forEach(status => grouped.set(status.id, []));
    
    vagas.forEach(vaga => {
      const statusVagas = grouped.get(vaga.status) || [];
      statusVagas.push(vaga);
      grouped.set(vaga.status, statusVagas);
    });
    
    return grouped;
  }, [vagas]);

  // Get vagas that need justification (overdue and not yet in justificativa)
  const overdueVagas = useMemo(() => {
    return vagas.filter(v => {
      const briefing = briefingsMap.get(v.id);
      return isVagaOverdue(v, briefing) && v.status !== 'justificativa' && v.status !== 'processo_seletivo' && v.status !== 'arquivados';
    });
  }, [vagas, briefingsMap]);

  // Get vagas in justificativa status (already justified)
  const justifiedVagas = useMemo(() => {
    return vagas.filter(v => v.status === 'justificativa');
  }, [vagas]);

  // Create a map of latest justification for each vaga
  const latestJustificativas = useMemo(() => {
    const map = new Map<string, RHJustificativa>();
    justificativas.forEach(j => {
      const existing = map.get(j.vaga_id);
      if (!existing || new Date(j.created_at) > new Date(existing.created_at)) {
        map.set(j.vaga_id, j);
      }
    });
    return map;
  }, [justificativas]);

  // Protected statuses - cannot be moved manually between these
  const PROTECTED_STATUSES = ['solicitacao_vaga', 'vaga_registrada', 'anuncio_publicado'];

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !permissions.canMove) return;
    
    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;
    const vaga = vagas.find(v => v.id === draggableId);
    
    if (!vaga) return;

    // Block manual movement between protected statuses
    const isFromProtected = PROTECTED_STATUSES.includes(oldStatus);
    const isToProtected = PROTECTED_STATUSES.includes(newStatus);
    
    if (isFromProtected && isToProtected && oldStatus !== newStatus) {
      toast.error('Movimentação automática: complete as tarefas para avançar a vaga.');
      return;
    }

    // Block moving INTO protected statuses (except from same status for reordering)
    if (isToProtected && !isFromProtected) {
      toast.error('Vagas só podem entrar neste status através do fluxo de tarefas.');
      return;
    }

    // Block moving OUT OF protected statuses to other protected statuses
    if (isFromProtected && PROTECTED_STATUSES.includes(newStatus) && oldStatus !== newStatus) {
      toast.error('Use as tarefas do RH para avançar as vagas entre etapas.');
      return;
    }

    // If trying to move to "vaga_registrada" directly (shouldn't happen with blocks above, but just in case)
    if (newStatus === 'vaga_registrada' && vaga.status !== 'vaga_registrada') {
      toast.error('Complete a tarefa "Registrar VAGA" para mover para Vaga Registrada.');
      return;
    }

    // If moving to "anuncio_publicado", also move to "processo_seletivo"
    if (newStatus === 'anuncio_publicado') {
      toast.error('A publicação do anúncio é feita automaticamente através das tarefas.');
      return;
    }
    
    try {
      await moveVaga.mutateAsync({
        id: draggableId,
        status: newStatus,
        position: destination.index,
      });
      
      await createAtividade.mutateAsync({
        vaga_id: draggableId,
        user_id: user?.id,
        user_name: user?.name,
        action: 'moved',
        details: { to_status: newStatus },
      });
      
      toast.success(`Vaga movida para ${getStatusLabel(newStatus)}`);
    } catch (error) {
      console.error('Error moving vaga:', error);
      toast.error('Erro ao mover vaga');
    }
  };

  const handleVagaRegistradaComplete = async () => {
    if (!pendingMove) return;
    
    try {
      await moveVaga.mutateAsync({
        id: pendingMove.vagaId,
        status: pendingMove.newStatus,
        position: pendingMove.position,
      });
      
      await createAtividade.mutateAsync({
        vaga_id: pendingMove.vagaId,
        user_id: user?.id,
        user_name: user?.name,
        action: 'moved',
        details: { to_status: pendingMove.newStatus },
      });
      
      toast.success('Vaga registrada com sucesso!');
    } catch (error) {
      console.error('Error moving vaga:', error);
      toast.error('Erro ao mover vaga');
    } finally {
      setPendingMove(null);
      setVagaRegistradaModal(null);
    }
  };

  const handleCardClick = (vaga: RHVaga) => {
    // If it's in processo_seletivo, open the processo seletivo modal
    if (vaga.status === 'processo_seletivo') {
      setProcessoSeletivoModal(vaga);
    } else {
      setSelectedVaga(vaga);
    }
  };

  const handleArchive = async (vaga: RHVaga) => {
    try {
      await archiveVaga.mutateAsync(vaga.id);
      await createAtividade.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        action: 'archived',
      });
      toast.success('Vaga arquivada');
    } catch (error) {
      toast.error('Erro ao arquivar vaga');
    }
  };

  const handleUnarchive = async (vaga: RHVaga) => {
    try {
      await unarchiveVaga.mutateAsync(vaga.id);
      await createAtividade.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        action: 'unarchived',
      });
      toast.success('Vaga desarquivada e movida para Processo Seletivo');
    } catch (error) {
      toast.error('Erro ao desarquivar vaga');
    }
  };

  const handleDelete = async (vaga: RHVaga) => {
    if (!confirm('Tem certeza que deseja excluir esta vaga?')) return;
    
    try {
      await deleteVaga.mutateAsync(vaga.id);
      toast.success('Vaga excluída');
    } catch (error) {
      toast.error('Erro ao excluir vaga');
    }
  };

  const handleVagasPreenchidas = async (vaga: RHVaga) => {
    if (!confirm('Confirma que todas as vagas foram preenchidas? O card será movido para Arquivados.')) return;
    
    try {
      await archiveVaga.mutateAsync(vaga.id);
      await createAtividade.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        action: 'vagas_preenchidas',
        details: { message: 'Todas as vagas foram preenchidas' },
      });
      toast.success('🎉 Parabéns! Vagas preenchidas com sucesso!');
    } catch (error) {
      toast.error('Erro ao arquivar vaga');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Filter statuses for display - exclude justificativa from main columns
  const mainStatuses = RH_STATUSES.filter(s => s.id !== 'justificativa');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">RH | Fábrica de Talentos</h1>
          <p className="text-sm text-muted-foreground">
            {vagas.length} vagas • {overdueVagas.length} atrasadas
          </p>
        </div>
        
        {permissions.canCreate && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Vaga
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Dashboard + Tasks Side by Side */}
        <div className="flex border-r overflow-hidden">
          {/* Dashboard Column */}
          <div className="w-[320px] overflow-y-auto border-r">
            <RHDashboard />
          </div>
          {/* Tasks Column */}
          <div className="w-[320px] overflow-y-auto">
            <RHTarefasSection />
          </div>
        </div>

        {/* Kanban Columns */}
        <ScrollArea className="flex-1">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 p-4 min-w-max">
              {mainStatuses.map(status => (
                <Column
                  key={status.id}
                  status={status}
                  vagas={vagasByStatus.get(status.id) || []}
                  briefings={briefingsMap}
                  onCardClick={handleCardClick}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onDelete={handleDelete}
                  onVagasPreenchidas={status.id === 'processo_seletivo' ? handleVagasPreenchidas : undefined}
                  permissions={permissions}
                  onCreateCard={status.id === 'solicitacao_vaga' ? () => setIsCreateModalOpen(true) : undefined}
                  isProcessoSeletivo={status.id === 'processo_seletivo'}
                  isArchived={status.id === 'arquivados'}
                />
              ))}
              
              {/* Justification Column - Always visible, shows both pending and justified */}
              <div className="flex-shrink-0 w-80 bg-danger/5 rounded-xl border border-danger/20">
                <div 
                  className="p-3 flex items-center justify-between"
                  style={{ borderLeft: '4px solid #dc2626' }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger" />
                    <h3 className="font-semibold text-sm text-danger">Justificativa</h3>
                    {(overdueVagas.length + justifiedVagas.length) > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {overdueVagas.length + justifiedVagas.length}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-2 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto min-h-[100px]">
                  {/* Pending justifications (overdue) */}
                  {overdueVagas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-danger px-1">Aguardando Justificativa</p>
                      {overdueVagas.map(vaga => (
                        <div 
                          key={vaga.id}
                          className="bg-card border border-danger/30 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all"
                          onClick={() => {
                            setDelayModalVaga(vaga);
                            setAutoDelayModalOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-danger" />
                            <span className="font-medium text-sm truncate">{briefingsMap.get(vaga.id)?.nome_vaga || vaga.title}</span>
                          </div>
                          <p className="text-xs text-danger mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Clique para justificar o atraso
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Already justified */}
                  {justifiedVagas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground px-1">Justificados</p>
                      {justifiedVagas.map(vaga => {
                        const justification = latestJustificativas.get(vaga.id);
                        const briefing = briefingsMap.get(vaga.id);
                        return (
                          <div 
                            key={vaga.id}
                            className="bg-card border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all"
                            onClick={() => setSelectedVaga(vaga)}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-sm truncate">{briefing?.nome_vaga || vaga.title}</span>
                            </div>
                            {justification && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {justification.motivo}
                                </p>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    Por: {justification.user_name || 'Usuário'}
                                  </span>
                                  {justification.nova_data && (
                                    <Badge variant="outline" className="text-xs">
                                      <ArrowRight className="w-3 h-3 mr-1" />
                                      {format(new Date(justification.nova_data), 'dd/MM', { locale: ptBR })}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state */}
                  {overdueVagas.length === 0 && justifiedVagas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-xs text-center">Nenhuma vaga com atraso</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DragDropContext>
        </ScrollArea>
      </div>

      {/* Modals */}
      <CreateRHVagaModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
      
      {selectedVaga && (
        <RHVagaDetailModal
          vaga={selectedVaga}
          briefing={briefingsMap.get(selectedVaga.id)}
          isOpen={!!selectedVaga}
          onClose={() => setSelectedVaga(null)}
          permissions={permissions}
        />
      )}

      {delayModalVaga && (
        <RHDelayModal
          vaga={delayModalVaga}
          briefing={briefingsMap.get(delayModalVaga.id)}
          isOpen={!!delayModalVaga}
          onClose={() => {
            setDelayModalVaga(null);
            setAutoDelayModalOpen(false);
            if (currentNotification?.vaga.id === delayModalVaga.id) {
              dismissCurrent();
            }
          }}
          onJustified={() => {
            if (currentNotification?.vaga.id === delayModalVaga.id) {
              markAsJustified(delayModalVaga.id);
            }
            setAutoDelayModalOpen(false);
          }}
        />
      )}

      {/* Vaga Registrada Modal - opens when moving to vaga_registrada */}
      {vagaRegistradaModal && (
        <VagaRegistradaModal
          vaga={vagaRegistradaModal}
          isOpen={!!vagaRegistradaModal}
          onClose={() => {
            setVagaRegistradaModal(null);
            setPendingMove(null);
          }}
          onComplete={handleVagaRegistradaComplete}
        />
      )}

      {/* Processo Seletivo Modal - opens when clicking a card in processo_seletivo */}
      {processoSeletivoModal && (
        <ProcessoSeletivoModal
          vaga={processoSeletivoModal}
          briefing={briefingsMap.get(processoSeletivoModal.id)}
          isOpen={!!processoSeletivoModal}
          onClose={() => setProcessoSeletivoModal(null)}
        />
      )}
    </div>
  );
}
