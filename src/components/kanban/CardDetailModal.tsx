import { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  MessageSquare, 
  FileText, 
  Paperclip, 
  Clock,
  Send,
  Loader2,
  Activity,
  Video,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Trash2,
  ExternalLink
} from 'lucide-react';
import CardAttachmentsTab from '@/components/design/CardAttachmentsTab';
import { cn } from '@/lib/utils';
import { KanbanCard, useArchiveCard } from '@/hooks/useKanban';
import { 
  useBriefing, 
  useUpsertBriefing, 
  useCardComments, 
  useAddComment,
  useCardAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  useCardActivities,
  canEditDesignBriefing,
  canArchiveDesignCard
} from '@/hooks/useDesignKanban';
import {
  useVideoBriefing,
  useUpsertVideoBriefing,
  canEditVideoBriefing,
  canArchiveVideoCard,
  VIDEO_STATUS_LABELS,
} from '@/hooks/useVideoKanban';
import {
  useDevBriefing,
  useUpsertDevBriefing,
  canEditDevBriefing,
  canArchiveDevCard,
} from '@/hooks/useDevsKanban';
import {
  useProdutoraBriefing,
  useUpsertProdutoraBriefing,
  canEditProdutoraBriefing,
  canArchiveProdutoraCard,
  PRODUTORA_STATUS_LABELS,
} from '@/hooks/useProdutoraKanban';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CardDetailModalProps {
  card: KanbanCard;
  isOpen: boolean;
  onClose: () => void;
  isDesignBoard?: boolean;
  isVideoBoard?: boolean;
  isDevBoard?: boolean;
  isAtrizesBoard?: boolean;
  isProdutoraBoard?: boolean;
  onDelete?: () => void;
  onArchive?: () => void;
  boardId?: string;
}

type TabType = 'briefing' | 'comments' | 'attachments' | 'activity';

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-success/10 text-success border-success/20' },
  medium: { label: 'Média', color: 'bg-info/10 text-info border-info/20' },
  high: { label: 'Alta', color: 'bg-warning/10 text-warning border-warning/20' },
  urgent: { label: 'Urgente', color: 'bg-danger/10 text-danger border-danger/20' },
};

export default function CardDetailModal({ 
  card, 
  isOpen, 
  onClose, 
  isDesignBoard = false,
  isVideoBoard = false,
  isDevBoard = false,
  isProdutoraBoard = false,
  onDelete,
  onArchive,
  boardId
}: CardDetailModalProps) {
  const isSpecialBoard = isDesignBoard || isVideoBoard || isDevBoard || isProdutoraBoard;
  const archiveCard = useArchiveCard();
  const { user } = useAuth();
  const userRole = user?.role || null;
  const [activeTab, setActiveTab] = useState<TabType>(isSpecialBoard ? 'briefing' : 'comments');
  const [newComment, setNewComment] = useState('');
  
  // Design Briefing
  const { data: designBriefing, isLoading: designBriefingLoading } = useBriefing(isDesignBoard ? card.id : undefined);
  const upsertDesignBriefing = useUpsertBriefing();
  
  // Video Briefing
  const { data: videoBriefing, isLoading: videoBriefingLoading } = useVideoBriefing(isVideoBoard ? card.id : undefined);
  const upsertVideoBriefing = useUpsertVideoBriefing();
  
  // Dev Briefing
  const { data: devBriefing, isLoading: devBriefingLoading } = useDevBriefing(isDevBoard ? card.id : undefined);
  const upsertDevBriefing = useUpsertDevBriefing();
  
  // Produtora Briefing
  const { data: produtoraBriefing, isLoading: produtoraBriefingLoading } = useProdutoraBriefing(isProdutoraBoard ? card.id : undefined);
  const upsertProdutoraBriefing = useUpsertProdutoraBriefing();
  
  const briefingLoading = isDesignBoard ? designBriefingLoading : isVideoBoard ? videoBriefingLoading : isDevBoard ? devBriefingLoading : isProdutoraBoard ? produtoraBriefingLoading : false;
  
  // Design briefing form
  const [designBriefingForm, setDesignBriefingForm] = useState({
    description: '',
    references_url: '',
    identity_url: '',
    client_instagram: '',
    script_url: '',
  });
  
  // Video briefing form
  const [videoBriefingForm, setVideoBriefingForm] = useState({
    script_url: '',
    observations: '',
    materials_url: '',
    reference_video_url: '',
    identity_url: '',
  });
  
  // Dev briefing form
  const [devBriefingForm, setDevBriefingForm] = useState({
    script_url: '',
    observations: '',
    materials_url: '',
    reference_video_url: '',
    identity_url: '',
  });
  
  // Produtora briefing form
  const [produtoraBriefingForm, setProdutoraBriefingForm] = useState({
    script_url: '',
    observations: '',
    reference_video_url: '',
  });
  
  const [briefingEditing, setBriefingEditing] = useState(false);

  // Reset all local state when card changes to prevent data bleeding between cards
  useEffect(() => {
    setNewComment('');
    setBriefingEditing(false);
    setActiveTab(isSpecialBoard ? 'briefing' : 'comments');
    setDesignBriefingForm({
      description: '',
      references_url: '',
      identity_url: '',
      client_instagram: '',
      script_url: '',
    });
    setVideoBriefingForm({
      script_url: '',
      observations: '',
      materials_url: '',
      reference_video_url: '',
      identity_url: '',
    });
    setDevBriefingForm({
      script_url: '',
      observations: '',
      materials_url: '',
      reference_video_url: '',
      identity_url: '',
    });
    setProdutoraBriefingForm({
      script_url: '',
      observations: '',
      reference_video_url: '',
    });
  }, [card.id, isSpecialBoard]);

  // Comments
  const { data: comments = [], isLoading: commentsLoading } = useCardComments(card.id);
  const addComment = useAddComment();

  // Attachments
  const { data: attachments = [], isLoading: attachmentsLoading } = useCardAttachments(card.id);

  // Activities
  const { data: activities = [], isLoading: activitiesLoading } = useCardActivities(card.id);

  const canEditBriefing = isDesignBoard 
    ? canEditDesignBriefing(userRole) 
    : isVideoBoard 
      ? canEditVideoBriefing(userRole) 
      : isDevBoard
        ? canEditDevBriefing(userRole)
        : isProdutoraBoard
          ? canEditProdutoraBriefing(userRole)
          : false;
  const canDelete = isDesignBoard 
    ? canArchiveDesignCard(userRole) 
    : isVideoBoard 
      ? canArchiveVideoCard(userRole) 
      : isDevBoard
        ? canArchiveDevCard(userRole)
        : isProdutoraBoard
          ? canArchiveProdutoraCard(userRole)
          : false;

  const handleStartEditBriefing = () => {
    if (isDesignBoard) {
      setDesignBriefingForm({
        description: designBriefing?.description || '',
        references_url: designBriefing?.references_url || '',
        identity_url: designBriefing?.identity_url || '',
        client_instagram: designBriefing?.client_instagram || '',
        script_url: designBriefing?.script_url || '',
      });
    } else if (isVideoBoard) {
      setVideoBriefingForm({
        script_url: videoBriefing?.script_url || '',
        observations: videoBriefing?.observations || '',
        materials_url: videoBriefing?.materials_url || '',
        reference_video_url: videoBriefing?.reference_video_url || '',
        identity_url: videoBriefing?.identity_url || '',
      });
    } else if (isDevBoard) {
      setDevBriefingForm({
        script_url: devBriefing?.script_url || '',
        observations: devBriefing?.observations || '',
        materials_url: devBriefing?.materials_url || '',
        reference_video_url: devBriefing?.reference_video_url || '',
        identity_url: devBriefing?.identity_url || '',
      });
    } else if (isProdutoraBoard) {
      setProdutoraBriefingForm({
        script_url: produtoraBriefing?.script_url || '',
        observations: produtoraBriefing?.observations || '',
        reference_video_url: produtoraBriefing?.reference_video_url || '',
      });
    }
    setBriefingEditing(true);
  };

  const handleSaveBriefing = async () => {
    try {
      if (isDesignBoard) {
        await upsertDesignBriefing.mutateAsync({
          cardId: card.id,
          briefing: designBriefingForm,
        });
      } else if (isVideoBoard) {
        await upsertVideoBriefing.mutateAsync({
          cardId: card.id,
          briefing: videoBriefingForm,
        });
      } else if (isDevBoard) {
        await upsertDevBriefing.mutateAsync({
          cardId: card.id,
          briefing: devBriefingForm,
        });
      } else if (isProdutoraBoard) {
        await upsertProdutoraBriefing.mutateAsync({
          cardId: card.id,
          briefing: produtoraBriefingForm,
        });
      }
      setBriefingEditing(false);
      toast.success('Briefing salvo!');
    } catch (error) {
      toast.error('Erro ao salvar briefing');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await addComment.mutateAsync({
        cardId: card.id,
        content: newComment,
      });
      setNewComment('');
      toast.success('Comentário adicionado!');
    } catch (error) {
      toast.error('Erro ao adicionar comentário');
    }
  };

  if (!isOpen) return null;

  const priority = priorityConfig[card.priority];
  const isOverdue = card.due_date && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    ...(isSpecialBoard ? [{ id: 'briefing' as TabType, label: 'Briefing', icon: <FileText size={16} /> }] : []),
    { id: 'comments', label: 'Comentários', icon: <MessageSquare size={16} /> },
    { id: 'attachments', label: 'Anexos', icon: <Paperclip size={16} /> },
    { id: 'activity', label: 'Atividade', icon: <Activity size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-3xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border",
                priority.color
              )}>
                {priority.label}
              </span>
              {card.due_date && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar size={12} />
                  {format(new Date(card.due_date), "dd MMM yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {card.title}
            </h2>
            {card.description && (
              <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
            )}
            
            {/* Overdue & Justification Badge */}
            {isOverdue && (
              <div className="mt-3">
                {card.justification ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium cursor-help">
                          <CheckCircle2 size={14} />
                          Atraso justificado
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[350px]">
                        <p className="text-sm font-medium mb-1">Justificativa:</p>
                        <p className="text-xs">{card.justification}</p>
                        {card.justification_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Em {format(new Date(card.justification_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-medium">
                    <AlertTriangle size={14} />
                    Tarefa atrasada - aguardando justificativa
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-border shrink-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
          {/* Briefing Tab */}
          {activeTab === 'briefing' && isDesignBoard && (
            <div className="space-y-6">
              {briefingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : briefingEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Descrição das artes
                    </label>
                    <textarea
                      value={designBriefingForm.description}
                      onChange={e => setDesignBriefingForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva o que precisa ser criado..."
                      rows={4}
                      className="input-apple resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Referências (link)
                    </label>
                    <input
                      type="url"
                      value={designBriefingForm.references_url}
                      onChange={e => setDesignBriefingForm(prev => ({ ...prev, references_url: e.target.value }))}
                      placeholder="https://drive.google.com/..."
                      className="input-apple"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Identidade visual do cliente (link)
                    </label>
                    <input
                      type="url"
                      value={designBriefingForm.identity_url}
                      onChange={e => setDesignBriefingForm(prev => ({ ...prev, identity_url: e.target.value }))}
                      placeholder="https://drive.google.com/..."
                      className="input-apple"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      @ do cliente no Instagram
                    </label>
                    <input
                      type="text"
                      value={designBriefingForm.client_instagram}
                      onChange={e => setDesignBriefingForm(prev => ({ ...prev, client_instagram: e.target.value }))}
                      placeholder="@cliente"
                      className="input-apple"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Roteiro para as artes (link)
                    </label>
                    <input
                      type="url"
                      value={designBriefingForm.script_url}
                      onChange={e => setDesignBriefingForm(prev => ({ ...prev, script_url: e.target.value }))}
                      placeholder="https://docs.google.com/..."
                      className="input-apple"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      onClick={() => setBriefingEditing(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveBriefing}
                      disabled={upsertDesignBriefing.isPending}
                      className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {upsertDesignBriefing.isPending && <Loader2 size={16} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {designBriefing ? (
                    <>
                      <BriefingField 
                        label="Descrição das artes" 
                        value={designBriefing.description} 
                        isText 
                      />
                      <BriefingField 
                        label="Referências" 
                        value={designBriefing.references_url} 
                        isLink 
                      />
                      <BriefingField 
                        label="Identidade visual do cliente" 
                        value={designBriefing.identity_url} 
                        isLink 
                      />
                      <BriefingField 
                        label="@ do cliente no Instagram" 
                        value={designBriefing.client_instagram} 
                      />
                      <BriefingField 
                        label="Roteiro para as artes" 
                        value={designBriefing.script_url} 
                        isLink 
                      />
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText size={40} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhum briefing cadastrado</p>
                    </div>
                  )}

                  {canEditBriefing && (
                    <button
                      onClick={handleStartEditBriefing}
                      className="w-full mt-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {designBriefing ? 'Editar Briefing' : 'Criar Briefing'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Video Briefing Tab */}
          {activeTab === 'briefing' && isVideoBoard && (
            <div className="space-y-6">
              {briefingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : briefingEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Link dos Roteiros</label>
                    <input type="url" value={videoBriefingForm.script_url} onChange={e => setVideoBriefingForm(prev => ({ ...prev, script_url: e.target.value }))} placeholder="https://docs.google.com/..." className="input-apple" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Materiais do editor (links)</label>
                    <input type="url" value={videoBriefingForm.materials_url} onChange={e => setVideoBriefingForm(prev => ({ ...prev, materials_url: e.target.value }))} placeholder="https://drive.google.com/..." className="input-apple" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Vídeo de referência</label>
                    <input type="url" value={videoBriefingForm.reference_video_url} onChange={e => setVideoBriefingForm(prev => ({ ...prev, reference_video_url: e.target.value }))} placeholder="https://youtube.com/..." className="input-apple" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Identidade visual do cliente</label>
                    <input type="url" value={videoBriefingForm.identity_url} onChange={e => setVideoBriefingForm(prev => ({ ...prev, identity_url: e.target.value }))} placeholder="https://drive.google.com/..." className="input-apple" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Observações</label>
                    <textarea value={videoBriefingForm.observations} onChange={e => setVideoBriefingForm(prev => ({ ...prev, observations: e.target.value }))} placeholder="Detalhes importantes..." rows={3} className="input-apple resize-none" />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button onClick={() => setBriefingEditing(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
                    <button onClick={handleSaveBriefing} disabled={upsertVideoBriefing.isPending} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2">
                      {upsertVideoBriefing.isPending && <Loader2 size={16} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {videoBriefing ? (
                    <>
                      <BriefingField label="Link dos Roteiros" value={videoBriefing.script_url} isLink />
                      <BriefingField label="Materiais do editor" value={videoBriefing.materials_url} isLink />
                      <BriefingField label="Vídeo de referência" value={videoBriefing.reference_video_url} isLink />
                      <BriefingField label="Identidade visual" value={videoBriefing.identity_url} isLink />
                      <BriefingField label="Observações" value={videoBriefing.observations} isText />
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video size={40} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhum briefing cadastrado</p>
                    </div>
                  )}
                  {canEditBriefing && (
                    <button onClick={handleStartEditBriefing} className="w-full mt-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      {videoBriefing ? 'Editar Briefing' : 'Criar Briefing'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dev Briefing Tab */}
          {activeTab === 'briefing' && isDevBoard && (
            <div className="space-y-6">
              {briefingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : briefingEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Materiais e recursos (links)</label>
                    <input type="url" value={devBriefingForm.materials_url} onChange={e => setDevBriefingForm(prev => ({ ...prev, materials_url: e.target.value }))} placeholder="https://drive.google.com/..." className="input-apple" />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button onClick={() => setBriefingEditing(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
                    <button onClick={handleSaveBriefing} disabled={upsertDevBriefing.isPending} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2">
                      {upsertDevBriefing.isPending && <Loader2 size={16} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Description field (from card) */}
                  {card.description && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição da demanda</label>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{card.description}</p>
                    </div>
                  )}
                  
                  {devBriefing && (
                    <>
                      <BriefingField label="Materiais e recursos" value={devBriefing.materials_url} isLink />
                    </>
                  )}
                  
                  {canEditBriefing && (
                    <button onClick={handleStartEditBriefing} className="w-full mt-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      {devBriefing ? 'Editar Briefing' : 'Adicionar Materiais'}
                    </button>
                  )}

                  {/* Attachments section directly in Dev board briefing tab */}
                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <Paperclip size={14} />
                      Anexos
                    </h4>
                    <CardAttachmentsTab
                      cardId={card.id}
                      attachments={attachments}
                      isLoading={attachmentsLoading}
                      canDelete={canDelete}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Produtora Briefing Tab */}
          {activeTab === 'briefing' && isProdutoraBoard && (
            <div className="space-y-6">
              {briefingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : briefingEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Link dos Roteiros</label>
                    <input type="url" value={produtoraBriefingForm.script_url} onChange={e => setProdutoraBriefingForm(prev => ({ ...prev, script_url: e.target.value }))} placeholder="https://docs.google.com/..." className="input-apple" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Observações sobre o vídeo</label>
                    <textarea value={produtoraBriefingForm.observations} onChange={e => setProdutoraBriefingForm(prev => ({ ...prev, observations: e.target.value }))} placeholder="Detalhes importantes sobre a gravação..." rows={4} className="input-apple resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Vídeo de Referência (Mínimo 1)</label>
                    <input type="url" value={produtoraBriefingForm.reference_video_url} onChange={e => setProdutoraBriefingForm(prev => ({ ...prev, reference_video_url: e.target.value }))} placeholder="https://youtube.com/..." className="input-apple" />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button onClick={() => setBriefingEditing(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
                    <button onClick={handleSaveBriefing} disabled={upsertProdutoraBriefing.isPending} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2">
                      {upsertProdutoraBriefing.isPending && <Loader2 size={16} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {produtoraBriefing ? (
                    <>
                      <BriefingField label="Link dos Roteiros" value={produtoraBriefing.script_url} isLink />
                      <BriefingField label="Vídeo de Referência" value={produtoraBriefing.reference_video_url} isLink />
                      <BriefingField label="Observações" value={produtoraBriefing.observations} isText />
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video size={40} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhum briefing cadastrado</p>
                    </div>
                  )}
                  {canEditBriefing && (
                    <button onClick={handleStartEditBriefing} className="w-full mt-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      {produtoraBriefing ? 'Editar Briefing' : 'Criar Briefing'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-elegant">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare size={40} className="mx-auto mb-3 opacity-50" />
                        <p>Nenhum comentário ainda</p>
                      </div>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-semibold shrink-0">
                            {comment.user?.avatar ? (
                              <img 
                                src={comment.user.avatar} 
                                alt={comment.user.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              comment.user?.name?.charAt(0) || 'U'
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {comment.user?.name || 'Usuário'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border">
                    <input
                      type="text"
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Escreva um comentário..."
                      className="input-apple flex-1"
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addComment.isPending}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:brightness-105 transition-all disabled:opacity-50"
                    >
                      {addComment.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <CardAttachmentsTab
              cardId={card.id}
              attachments={attachments}
              isLoading={attachmentsLoading}
              canDelete={canDelete}
            />
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity size={40} className="mx-auto mb-3 opacity-50" />
                  <p>Nenhuma atividade registrada</p>
                </div>
              ) : (
                activities.map((activity: any) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-muted-foreground" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        {activity.user?.name || 'Usuário'}
                      </span>
                      {' '}
                      <span className="text-muted-foreground">
                        {getActivityText(activity)}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(activity.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer with Archive/Delete */}
        {(canDelete || boardId) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-muted/30">
            <div className="flex items-center gap-3">
              {boardId && (
                <button
                  onClick={() => {
                    archiveCard.mutate({ cardId: card.id, boardId });
                    onClose();
                  }}
                  disabled={archiveCard.isPending}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Archive size={16} />
                  {archiveCard.isPending ? 'Arquivando...' : 'Arquivar'}
                </button>
              )}
            </div>
            <div>
              {canDelete && onDelete && (
                <button
                  onClick={onDelete}
                  className="flex items-center gap-2 text-sm text-danger hover:text-danger/80 transition-colors"
                >
                  <Trash2 size={16} />
                  Excluir tarefa
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function BriefingField({ 
  label, 
  value, 
  isLink = false,
  isText = false 
}: { 
  label: string; 
  value: string | null; 
  isLink?: boolean;
  isText?: boolean;
}) {
  if (!value) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <p className="text-sm text-muted-foreground/50 italic">Não informado</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {isLink ? (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {value.length > 50 ? value.substring(0, 50) + '...' : value}
          <ExternalLink size={12} />
        </a>
      ) : isText ? (
        <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-foreground">{value}</p>
      )}
    </div>
  );
}

// Design status labels for display
const DESIGN_STATUS_LABELS: Record<string, string> = {
  'em_producao': 'EM PRODUÇÃO',
  'arrumar': 'ARRUMAR',
  'enviar_aprovacao': 'ENVIAR / APROVAÇÃO',
  'aprovados': 'APROVADOS',
};

function getActivityText(activity: any): string {
  const details = activity.details || {};
  
  switch (activity.action) {
    case 'created':
      return `criou esta tarefa${details.to ? ` em "${details.to}"` : ''}`;
    case 'moved': {
      // Handle status changes (design board subcategories)
      if (details.from_status || details.to_status) {
        const fromLabel = DESIGN_STATUS_LABELS[details.from_status] || details.from_status || '';
        const toLabel = DESIGN_STATUS_LABELS[details.to_status] || details.to_status || '';
        
        // If also changed column
        if (details.from_column && details.to_column && details.from_column !== details.to_column) {
          return `moveu de "${details.from_column}" para "${details.to_column}" (${fromLabel} → ${toLabel})`;
        }
        
        return `moveu de "${fromLabel}" para "${toLabel}"`;
      }
      
      // Handle column changes (regular kanban)
      if (details.from_column && details.to_column) {
        return `moveu de "${details.from_column}" para "${details.to_column}"`;
      }
      
      // Fallback for old format
      if (details.from && details.to) {
        return `moveu de "${details.from}" para "${details.to}"`;
      }
      
      return 'moveu esta tarefa';
    }
    case 'updated':
      return 'atualizou esta tarefa';
    case 'archived':
      return 'arquivou esta tarefa';
    case 'restored':
      return 'restaurou esta tarefa';
    default:
      return activity.action;
  }
}
