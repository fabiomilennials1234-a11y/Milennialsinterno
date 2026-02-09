import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
import {
  Plus,
  MoreHorizontal,
  Trash2,
  User,
  Mail,
  Phone,
  FileText,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Star,
  X,
  Link as LinkIcon,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import {
  useRHCandidatos,
  useCreateCandidato,
  useMoveCandidato,
  useDeleteCandidato,
  useUpdateCandidato,
  CANDIDATO_STATUSES,
  RHCandidato,
  getCandidatoStatusLabel,
} from '@/hooks/useRHCandidatos';
import { RHVaga, RHVagaBriefing } from '@/hooks/useRH';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProcessoSeletivoModalProps {
  vaga: RHVaga;
  briefing?: RHVagaBriefing;
  isOpen: boolean;
  onClose: () => void;
}

interface CandidatoCardProps {
  candidato: RHCandidato;
  index: number;
  onDelete: () => void;
  onClick: () => void;
  canMove: boolean;
}

function CandidatoCard({ candidato, index, onDelete, onClick, canMove }: CandidatoCardProps) {
  return (
    <Draggable draggableId={candidato.id} index={index} isDragDisabled={!canMove}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`
            group bg-card border rounded-lg p-3 cursor-pointer transition-all
            hover:shadow-md hover:border-primary/30
            ${snapshot.isDragging ? 'shadow-lg rotate-1 scale-105' : ''}
          `}
          onClick={onClick}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {canMove && (
                <div {...provided.dragHandleProps} className="opacity-0 group-hover:opacity-50 transition-opacity">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{candidato.nome}</h4>
                {candidato.email && (
                  <p className="text-xs text-muted-foreground truncate">{candidato.email}</p>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-danger"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Rating */}
          {candidato.avaliacao && candidato.avaliacao > 0 && (
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < candidato.avaliacao! ? 'text-warning fill-warning' : 'text-muted-foreground'}`}
                />
              ))}
            </div>
          )}

          {/* Contact info */}
          <div className="mt-2 flex items-center gap-2">
            {candidato.telefone && (
              <Phone className="w-3 h-3 text-muted-foreground" />
            )}
            {candidato.linkedin && (
              <LinkIcon className="w-3 h-3 text-muted-foreground" />
            )}
            {candidato.curriculo_url && (
              <FileText className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

interface ColumnProps {
  status: typeof CANDIDATO_STATUSES[number];
  candidatos: RHCandidato[];
  onCardClick: (candidato: RHCandidato) => void;
  onDelete: (candidato: RHCandidato) => void;
  canMove: boolean;
  onCreateCard?: () => void;
}

function Column({ status, candidatos, onCardClick, onDelete, canMove, onCreateCard }: ColumnProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex-shrink-0 w-64 bg-muted/30 rounded-xl border border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div 
            className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl"
            style={{ borderLeft: `4px solid ${status.color}` }}
          >
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h3 className="font-semibold text-xs">{status.label}</h3>
              <Badge variant="secondary" className="text-xs">{candidatos.length}</Badge>
            </div>
            {status.id === 'aplicados' && onCreateCard && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onCreateCard(); }}>
                <Plus className="w-3 h-3" />
              </Button>
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <Droppable droppableId={status.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`
                  p-2 min-h-[80px] space-y-2 transition-colors
                  ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}
                `}
              >
                {candidatos.map((candidato, index) => (
                  <CandidatoCard
                    key={candidato.id}
                    candidato={candidato}
                    index={index}
                    onClick={() => onCardClick(candidato)}
                    onDelete={() => onDelete(candidato)}
                    canMove={canMove}
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

// Add Candidate Modal
interface AddCandidatoModalProps {
  vagaId: string;
  isOpen: boolean;
  onClose: () => void;
}

function AddCandidatoModal({ vagaId, isOpen, onClose }: AddCandidatoModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [curriculo_url, setCurriculoUrl] = useState('');
  const [notas, setNotas] = useState('');
  
  const createCandidato = useCreateCandidato();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      await createCandidato.mutateAsync({
        vaga_id: vagaId,
        nome: nome.trim(),
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        curriculo_url: curriculo_url.trim() || undefined,
        notas: notas.trim() || undefined,
      });
      toast.success('Candidato adicionado!');
      setNome('');
      setEmail('');
      setTelefone('');
      setLinkedin('');
      setCurriculoUrl('');
      setNotas('');
      onClose();
    } catch (error) {
      toast.error('Erro ao adicionar candidato');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Adicionar Candidato
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do candidato"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> Telefone
              </label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> Perfil/Portfólio (URL)
            </label>
            <Input
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" /> Currículo (URL)
            </label>
            <Input
              value={curriculo_url}
              onChange={(e) => setCurriculoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="De onde veio o candidato, experiência prévia, etc..."
              className="min-h-[60px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCandidato.isPending}>
              {createCandidato.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Candidate Detail Modal
interface CandidatoDetailModalProps {
  candidato: RHCandidato;
  isOpen: boolean;
  onClose: () => void;
}

function CandidatoDetailModal({ candidato, isOpen, onClose }: CandidatoDetailModalProps) {
  const [nome, setNome] = useState(candidato.nome || '');
  const [email, setEmail] = useState(candidato.email || '');
  const [telefone, setTelefone] = useState(candidato.telefone || '');
  const [linkedin, setLinkedin] = useState(candidato.linkedin || '');
  const [curriculo_url, setCurriculoUrl] = useState(candidato.curriculo_url || '');
  const [avaliacao, setAvaliacao] = useState(candidato.avaliacao || 0);
  const [notas, setNotas] = useState(candidato.notas || '');
  const updateCandidato = useUpdateCandidato();

  // Reset form when candidato changes
  React.useEffect(() => {
    setNome(candidato.nome || '');
    setEmail(candidato.email || '');
    setTelefone(candidato.telefone || '');
    setLinkedin(candidato.linkedin || '');
    setCurriculoUrl(candidato.curriculo_url || '');
    setAvaliacao(candidato.avaliacao || 0);
    setNotas(candidato.notas || '');
  }, [candidato]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    try {
      await updateCandidato.mutateAsync({
        id: candidato.id,
        vaga_id: candidato.vaga_id,
        nome: nome.trim(),
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        curriculo_url: curriculo_url.trim() || undefined,
        avaliacao,
        notas: notas.trim() || undefined,
      });
      toast.success('Candidato atualizado!');
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar candidato');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby="candidato-detail-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Detalhes do Candidato
          </DialogTitle>
          <p id="candidato-detail-description" className="text-sm text-muted-foreground">
            Edite as informações do candidato
          </p>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Nome */}
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do candidato"
            />
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> Telefone
              </label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> Perfil/Portfólio (URL)
            </label>
            <Input
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" /> Link do Currículo
            </label>
            <Input
              value={curriculo_url}
              onChange={(e) => setCurriculoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Rating */}
          <div>
            <label className="text-sm font-medium">Avaliação</label>
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAvaliacao(i + 1)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-5 h-5 ${i < avaliacao ? 'text-warning fill-warning' : 'text-muted-foreground'}`}
                  />
                </button>
              ))}
              {avaliacao > 0 && (
                <button
                  type="button"
                  onClick={() => setAvaliacao(0)}
                  className="ml-2 text-xs text-muted-foreground hover:text-danger"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Notas e Observações</label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Adicione observações sobre o candidato, feedback de entrevistas, pontos fortes/fracos..."
              className="min-h-[100px] mt-1"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm font-medium">Status atual:</span>
            <Badge variant="secondary">{getCandidatoStatusLabel(candidato.status)}</Badge>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateCandidato.isPending}>
            {updateCandidato.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProcessoSeletivoModal({ vaga, briefing, isOpen, onClose }: ProcessoSeletivoModalProps) {
  const { user } = useAuth();
  const { data: candidatos = [], isLoading } = useRHCandidatos(vaga.id);
  const moveCandidato = useMoveCandidato();
  const deleteCandidato = useDeleteCandidato();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCandidato, setSelectedCandidato] = useState<RHCandidato | null>(null);
  
  // Contratados confirmation modal state
  const [contratadosConfirmOpen, setContratadosConfirmOpen] = useState(false);
  const [pendingContratadosMove, setPendingContratadosMove] = useState<{
    candidatoId: string;
    candidatoName: string;
    destinationIndex: number;
  } | null>(null);
  const [contratadosStep, setContratadosStep] = useState<'question' | 'success' | 'blocked'>('question');

  const canMove = user?.role === 'ceo' || user?.role === 'gestor_projetos';

  // Group candidatos by status
  const candidatosByStatus = useMemo(() => {
    const grouped = new Map<string, RHCandidato[]>();
    CANDIDATO_STATUSES.forEach(status => grouped.set(status.id, []));
    
    candidatos.forEach(candidato => {
      const statusCandidatos = grouped.get(candidato.status) || [];
      statusCandidatos.push(candidato);
      grouped.set(candidato.status, statusCandidatos);
    });
    
    return grouped;
  }, [candidatos]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canMove) return;
    
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    
    // If moving to "contratados", show confirmation modal
    if (newStatus === 'contratados') {
      const candidato = candidatos.find(c => c.id === draggableId);
      setPendingContratadosMove({
        candidatoId: draggableId,
        candidatoName: candidato?.nome || 'candidato',
        destinationIndex: destination.index,
      });
      setContratadosStep('question');
      setContratadosConfirmOpen(true);
      return;
    }
    
    try {
      await moveCandidato.mutateAsync({
        id: draggableId,
        vaga_id: vaga.id,
        status: newStatus,
        position: destination.index,
      });
      
      toast.success(`Candidato movido para ${getCandidatoStatusLabel(newStatus)}`);
    } catch (error) {
      console.error('Error moving candidato:', error);
      toast.error('Erro ao mover candidato');
    }
  };

  const handleContratadosConfirmYes = async () => {
    if (!pendingContratadosMove) return;
    
    try {
      await moveCandidato.mutateAsync({
        id: pendingContratadosMove.candidatoId,
        vaga_id: vaga.id,
        status: 'contratados',
        position: pendingContratadosMove.destinationIndex,
      });
      
      setContratadosStep('success');
    } catch (error) {
      console.error('Error moving candidato:', error);
      toast.error('Erro ao mover candidato');
      setContratadosConfirmOpen(false);
      setPendingContratadosMove(null);
    }
  };

  const handleContratadosConfirmNo = () => {
    setContratadosStep('blocked');
  };

  const handleContratadosClose = () => {
    setContratadosConfirmOpen(false);
    setPendingContratadosMove(null);
    setContratadosStep('question');
  };

  const handleDelete = async (candidato: RHCandidato) => {
    if (!confirm('Tem certeza que deseja excluir este candidato?')) return;
    
    try {
      await deleteCandidato.mutateAsync({ id: candidato.id, vaga_id: vaga.id });
      toast.success('Candidato excluído');
    } catch (error) {
      toast.error('Erro ao excluir candidato');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">
                Processo Seletivo: {briefing?.nome_vaga || vaga.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {candidatos.length} candidato{candidatos.length !== 1 ? 's' : ''} • 
                {briefing?.area_squad && ` ${briefing.area_squad} •`}
                {briefing?.nivel && ` ${briefing.nivel}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Candidato
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="h-full overflow-x-auto overflow-y-hidden">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-3 p-2 h-full" style={{ minWidth: 'max-content' }}>
                  {CANDIDATO_STATUSES.map(status => (
                    <Column
                      key={status.id}
                      status={status}
                      candidatos={candidatosByStatus.get(status.id) || []}
                      onCardClick={setSelectedCandidato}
                      onDelete={handleDelete}
                      canMove={canMove}
                      onCreateCard={status.id === 'aplicados' ? () => setIsAddModalOpen(true) : undefined}
                    />
                  ))}
                </div>
              </DragDropContext>
            </div>
          )}
        </div>

        {/* Add Candidate Modal */}
        <AddCandidatoModal
          vagaId={vaga.id}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

        {/* Candidate Detail Modal */}
        {selectedCandidato && (
          <CandidatoDetailModal
            candidato={selectedCandidato}
            isOpen={!!selectedCandidato}
            onClose={() => setSelectedCandidato(null)}
          />
        )}

        {/* Contratados Confirmation Modal */}
        <AlertDialog open={contratadosConfirmOpen} onOpenChange={handleContratadosClose}>
          <AlertDialogContent className="max-w-md">
            {contratadosStep === 'question' && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-center">
                    Confirmação de Contratação
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-base">
                    Você já preencheu o forms para criação do contrato de contratação?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-center gap-3 sm:justify-center">
                  <Button
                    variant="outline"
                    onClick={handleContratadosConfirmNo}
                  >
                    Não
                  </Button>
                  <Button
                    onClick={handleContratadosConfirmYes}
                    className="bg-success hover:bg-success/90"
                  >
                    Sim
                  </Button>
                </AlertDialogFooter>
              </>
            )}

            {contratadosStep === 'success' && (
              <>
                <AlertDialogHeader>
                  <div className="flex justify-center mb-4">
                    <CheckCircle2 className="w-16 h-16 text-success" />
                  </div>
                  <AlertDialogTitle className="text-center text-success">
                    Perfeito!
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-base">
                    Não esqueça de comunicar o jurídico agora, imprimir o contrato e assinar com{' '}
                    <strong>{pendingContratadosMove?.candidatoName}</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-center sm:justify-center">
                  <Button onClick={handleContratadosClose}>
                    Entendi
                  </Button>
                </AlertDialogFooter>
              </>
            )}

            {contratadosStep === 'blocked' && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-center text-destructive">
                    Antes de mover, preencha o formulário de contratação
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-base space-y-4">
                    <p>Ao preencher, volte aqui e movimente para contratado.</p>
                    <a
                      href="https://forms.gle/2QHJmCbRTuctH2Ri6"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir formulário de contratação
                    </a>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-center sm:justify-center">
                  <Button variant="outline" onClick={handleContratadosClose}>
                    Fechar
                  </Button>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
