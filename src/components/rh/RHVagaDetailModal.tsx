import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Building,
  FileText,
  MessageSquare,
  Activity,
  AlertTriangle,
  Clock,
  Send,
  CheckCircle,
  Target,
  Wrench,
  GraduationCap,
  Megaphone,
  Users,
  ExternalLink
} from 'lucide-react';
import { 
  RHVaga, 
  RHVagaBriefing, 
  useRHComentarios, 
  useRHAtividades,
  useCreateRHComentario,
  isVagaOverdue,
  getStatusLabel,
  getStatusColor
} from '@/hooks/useRH';
import { useRHVagaPlataformasQuery } from '@/hooks/useRHPlataformas';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface RHVagaDetailModalProps {
  vaga: RHVaga;
  briefing?: RHVagaBriefing;
  isOpen: boolean;
  onClose: () => void;
  permissions: {
    canCreate: boolean;
    canMove: boolean;
    canComment: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isViewOnly: boolean;
  };
}

function BriefingField({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  if (!value) return null;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        <span>{label}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function RHVagaDetailModal({ vaga, briefing, isOpen, onClose, permissions }: RHVagaDetailModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('briefing');
  const [newComment, setNewComment] = useState('');
  
  const { data: comentarios = [] } = useRHComentarios(vaga.id);
  const { data: atividades = [] } = useRHAtividades(vaga.id);
  const { data: plataformas = [] } = useRHVagaPlataformasQuery(vaga.id);
  const createComentario = useCreateRHComentario();

  const isOverdue = isVagaOverdue(vaga, briefing);

  const handleAddComment = async () => {
    if (!newComment.trim() || !permissions.canComment) return;
    
    try {
      await createComentario.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        content: newComment.trim(),
      });
      setNewComment('');
      toast.success('Comentário adicionado');
    } catch (error) {
      toast.error('Erro ao adicionar comentário');
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'created': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'moved': return <Activity className="w-4 h-4 text-info" />;
      case 'archived': return <FileText className="w-4 h-4 text-muted-foreground" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityText = (action: string, details?: Record<string, any>) => {
    switch (action) {
      case 'created': return 'criou esta vaga';
      case 'moved': return `moveu para ${getStatusLabel(details?.to_status || '')}`;
      case 'archived': return 'arquivou esta vaga';
      default: return action;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl">{vaga.title}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  style={{ backgroundColor: getStatusColor(vaga.status) }}
                  className="text-white"
                >
                  {getStatusLabel(vaga.status)}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Atrasada
                  </Badge>
                )}
                {briefing?.data_limite && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Prazo: {format(new Date(briefing.data_limite), 'dd/MM/yyyy', { locale: ptBR })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="briefing" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Briefing
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comentários ({comentarios.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Atividade
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="briefing" className="h-full m-0">
              <ScrollArea className="h-[400px] pr-4">
                {briefing ? (
                  <div className="space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl">
                      <BriefingField label="Solicitado por" value={briefing.solicitado_por} icon={User} />
                      <BriefingField label="Área / Squad" value={briefing.area_squad} icon={Building} />
                      <BriefingField label="Cidade/UF" value={briefing.cidade_uf} icon={MapPin} />
                      <BriefingField label="Modelo" value={briefing.modelo} icon={Briefcase} />
                      <BriefingField label="Regime" value={briefing.regime} icon={FileText} />
                      <BriefingField label="Nível" value={briefing.nivel} icon={GraduationCap} />
                      <BriefingField label="Faixa Salarial" value={briefing.faixa_salarial} icon={DollarSign} />
                      <BriefingField label="Data Limite" value={briefing.data_limite ? format(new Date(briefing.data_limite), 'dd/MM/yyyy', { locale: ptBR }) : undefined} icon={Calendar} />
                    </div>

                    <Separator />

                    {/* Objective */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold">Objetivo da Vaga</h4>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/20 rounded-lg">
                        {briefing.objetivo_vaga || 'Não informado'}
                      </p>
                    </div>

                    {/* Responsibilities */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <h4 className="font-semibold">Principais Responsabilidades</h4>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/20 rounded-lg">
                        {briefing.principais_responsabilidades || 'Não informado'}
                      </p>
                    </div>

                    {/* Requirements */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          <h4 className="font-semibold text-sm">Requisitos Obrigatórios</h4>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/20 rounded-lg min-h-[100px]">
                          {briefing.requisitos_obrigatorios || 'Não informado'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-info" />
                          <h4 className="font-semibold text-sm">Requisitos Desejáveis</h4>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/20 rounded-lg min-h-[100px]">
                          {briefing.requisitos_desejaveis || 'Não informado'}
                        </p>
                      </div>
                    </div>

                    {/* Tools */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-purple" />
                        <h4 className="font-semibold">Ferramentas Obrigatórias</h4>
                      </div>
                      <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
                        {briefing.ferramentas_obrigatorias || 'Não informado'}
                      </p>
                    </div>

                    {/* Notes */}
                    {briefing.observacoes && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <h4 className="font-semibold">Observações</h4>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/20 rounded-lg">
                          {briefing.observacoes}
                        </p>
                      </div>
                    )}

                    {/* Plataformas de Divulgação */}
                    {plataformas.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-primary" />
                            <h4 className="font-semibold">Plataformas de Divulgação</h4>
                            <Badge variant="secondary">{plataformas.length}</Badge>
                          </div>
                          
                          <div className="grid gap-3">
                            {plataformas.map(plataforma => (
                              <div key={plataforma.id} className="p-4 border rounded-xl bg-muted/10 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-medium text-sm">{plataforma.plataforma}</h5>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    {plataforma.budget && (
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" />
                                        <span>R$ {Number(plataforma.budget).toLocaleString('pt-BR')}</span>
                                      </div>
                                    )}
                                    {plataforma.expectativa_curriculos && (
                                      <div className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        <span>{plataforma.expectativa_curriculos} CVs</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {plataforma.descricao && (
                                  <p className="text-sm text-muted-foreground">{plataforma.descricao}</p>
                                )}
                                
                                {plataforma.observacoes && (
                                  <p className="text-xs text-muted-foreground/80 italic">
                                    Obs: {plataforma.observacoes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {/* Totals */}
                          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Total: R$ {plataformas.reduce((sum, p) => sum + (Number(p.budget) || 0), 0).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                Expectativa: {plataformas.reduce((sum, p) => sum + (Number(p.expectativa_curriculos) || 0), 0)} CVs
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FileText className="w-12 h-12 mb-2 opacity-50" />
                    <p>Nenhum briefing cadastrado para esta vaga</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="comments" className="h-full m-0 flex flex-col">
              <ScrollArea className="flex-1 h-[320px] pr-4">
                <div className="space-y-4">
                  {comentarios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                      <p>Nenhum comentário ainda</p>
                    </div>
                  ) : (
                    comentarios.map(comment => (
                      <div key={comment.id} className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{comment.user_name || 'Usuário'}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              {permissions.canComment && (
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Textarea 
                    placeholder="Escreva um comentário..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button 
                    onClick={handleAddComment} 
                    disabled={!newComment.trim() || createComentario.isPending}
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="h-full m-0">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {atividades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Activity className="w-12 h-12 mb-2 opacity-50" />
                      <p>Nenhuma atividade registrada</p>
                    </div>
                  ) : (
                    atividades.map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted/10 rounded-lg">
                        {getActivityIcon(activity.action)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.user_name || 'Usuário'}</span>
                            {' '}
                            <span className="text-muted-foreground">{getActivityText(activity.action, activity.details)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
