import { useState } from 'react';
import { toast } from 'sonner';
import { CSClient, CSClassification, useUpdateClientClassification, useUpdateClientLastContact } from '@/hooks/useSucessoCliente';
import { CSOnboardingTask, CSClientTracking } from '@/hooks/useCSOnboardingTracking';
import { useExitReasonByClient, useCreateExitReason } from '@/hooks/useCSExitReasons';
import CSClientOnboardingBadge from './CSClientOnboardingBadge';
import CSClientTrackingBadge from './CSClientTrackingBadge';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import InternalExitFormModal from './InternalExitFormModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  MoreVertical, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  CheckCircle,
  MessageSquare,
  Phone,
  Calendar,
  DollarSign,
  PhoneCall,
  Building2,
  Clock,
  Link2,
  Copy,
  ExternalLink,
  Loader2,
  ClipboardEdit,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCSPermissions } from '@/hooks/useSucessoCliente';
import { cn } from '@/lib/utils';

const MAIN_REASON_LABELS: Record<string, string> = {
  preco: 'Preço muito alto',
  resultados: 'Resultados abaixo do esperado',
  atendimento: 'Atendimento insatisfatório',
  comunicacao: 'Problemas de comunicação',
  mudanca_estrategia: 'Mudança de estratégia interna',
  orcamento: 'Corte de orçamento',
  concorrente: 'Migração para concorrente',
  outro: 'Outro motivo',
};
interface ActiveActionPlan {
  dueDate: string;
  severity: 'leve' | 'moderado' | 'critico';
  problemLabel: string;
  status: 'active' | 'completed' | 'cancelled';
}

interface CSClientCardProps {
  client: CSClient;
  onClick?: () => void;
  showSuggestion?: {
    suggestedClassification: CSClassification;
    reason: string;
  } | null;
  onboardingTasks?: CSOnboardingTask[];
  tracking?: CSClientTracking | null;
  showContactPulse?: boolean;  // Show pulsing button when contact is needed
  activeActionPlan?: ActiveActionPlan | null;  // Active action plan to show prominently
}

const CLASSIFICATION_CONFIG: Record<CSClassification, { 
  label: string; 
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ElementType;
  cardBorder: string;
}> = {
  normal: { 
    label: 'Normal', 
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/20',
    icon: CheckCircle,
    cardBorder: 'border-l-success',
  },
  alerta: { 
    label: 'Em Alerta', 
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/20',
    icon: AlertTriangle,
    cardBorder: 'border-l-warning',
  },
  critico: { 
    label: 'Crítico', 
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/20',
    icon: AlertCircle,
    cardBorder: 'border-l-destructive',
  },
  encerrado: { 
    label: 'Encerrado', 
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    borderColor: 'border-muted',
    icon: XCircle,
    cardBorder: 'border-l-muted-foreground',
  },
};

export default function CSClientCard({ client, onClick, showSuggestion, onboardingTasks = [], tracking, showContactPulse = false, activeActionPlan = null }: CSClientCardProps) {
  const [isClassificationDialogOpen, setIsClassificationDialogOpen] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<CSClassification | null>(null);
  const [reason, setReason] = useState('');
  const [isInternalExitFormOpen, setIsInternalExitFormOpen] = useState(false);
  
  const updateClassification = useUpdateClientClassification();
  const updateLastContact = useUpdateClientLastContact();
  const { canMove, canSetLabels } = useCSPermissions();
  
  // Check if client is closed (churned, encerrado, or in distrato)
  const isClientClosed = client.cs_classification === 'encerrado' || 
                         client.status === 'churned' || 
                         !!client.distrato_step;

  // Exit form hooks - activate for any closed client
  const { data: exitReason } = useExitReasonByClient(isClientClosed ? client.id : null);
  const createExitReason = useCreateExitReason();

  const handleOpenInternalExitForm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInternalExitFormOpen(true);
  };

  const classification = client.cs_classification || 'normal';
  const config = CLASSIFICATION_CONFIG[classification];
  const Icon = config.icon;

  const handleClassificationChange = (newClassification: CSClassification) => {
    setSelectedClassification(newClassification);
    setReason('');
    setIsClassificationDialogOpen(true);
  };

  const confirmClassification = () => {
    if (selectedClassification) {
      updateClassification.mutate({
        clientId: client.id,
        classification: selectedClassification,
        reason,
      });
      setIsClassificationDialogOpen(false);
      setSelectedClassification(null);
      setReason('');
    }
  };

  const handleAcceptSuggestion = () => {
    if (showSuggestion) {
      updateClassification.mutate({
        clientId: client.id,
        classification: showSuggestion.suggestedClassification,
        reason: showSuggestion.reason,
      });
    }
  };

  const handleRegisterContact = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLastContact.mutate(client.id, {
      onSuccess: () => {
        toast.success(`Contato registrado para ${client.name}`, {
          description: 'O último contato foi atualizado com sucesso.',
        });
      },
    });
  };

  const handleCopyExitFormLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If there's already an exit reason, copy the link
    if (exitReason?.public_token) {
      const url = `${window.location.origin}/saida/${exitReason.public_token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!', {
        description: 'O link do formulário de saída foi copiado para a área de transferência.',
      });
      return;
    }
    
    // Otherwise, create a new exit reason first
    createExitReason.mutate(
      { clientId: client.id, clientName: client.name },
      {
        onSuccess: (data) => {
          const url = `${window.location.origin}/saida/${data.public_token}`;
          navigator.clipboard.writeText(url);
          toast.success('Formulário criado e link copiado!', {
            description: 'Envie o link para o cliente preencher os motivos da saída.',
          });
        },
      }
    );
  };

  const daysSinceContact = client.last_cs_contact_at
    ? Math.floor((Date.now() - new Date(client.last_cs_contact_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isUrgent = daysSinceContact !== null && daysSinceContact >= 7;
  const isCriticalContact = daysSinceContact !== null && daysSinceContact >= 14;
  
  // Show pulse if explicitly requested or if contact is overdue
  const shouldShowPulse = showContactPulse || (canMove && (isCriticalContact || isUrgent));

  // Action plan display data
  const actionPlanDisplay = activeActionPlan ? (() => {
    const due = new Date(activeActionPlan.dueDate);
    const daysRemaining = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysRemaining < 0 && activeActionPlan.status === 'active';
    const periodDays = activeActionPlan.severity === 'leve' ? 30 : activeActionPlan.severity === 'moderado' ? 60 : 90;
    return { daysRemaining, isOverdue, periodDays };
  })() : null;

  return (
    <>
      <Card
        className={cn(
          "bg-card hover:shadow-apple-hover transition-all cursor-pointer group border-l-4 relative",
          config.cardBorder,
          classification === 'critico' && "ring-1 ring-destructive/20",
          classification === 'alerta' && "ring-1 ring-warning/20",
        )}
        onClick={onClick}
      >
        {/* Pulsing Contact Button - Outside card content */}
        {shouldShowPulse && (
          <Button
            variant="default"
            size="sm"
            className={cn(
              "absolute top-2 right-2 z-10 h-7 px-2 gap-1 text-xs font-semibold shadow-lg",
              isCriticalContact
                ? "bg-destructive hover:bg-destructive/90 animate-pulse" 
                : "bg-warning hover:bg-warning/90 animate-pulse"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleRegisterContact(e);
            }}
            disabled={updateLastContact.isPending}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Contato
          </Button>
        )}

        <CardContent className="p-3 space-y-2.5">
          {/* Header with name and menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-foreground truncate">
                  {client.name}
                </h4>
                <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
              </div>
              {client.razao_social && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {client.razao_social}
                </p>
              )}
            </div>
            
            {(canMove || canSetLabels) && (
              <div className="flex items-center gap-1">
                {/* Etiquetas: sempre visível (sem depender de hover) */}
                {canSetLabels && (
                  <ClientLabelSelector
                    clientId={client.id}
                    currentLabel={client.client_label as ClientLabel}
                  />
                )}

                {/* Ações do CS podem continuar aparecendo no hover */}
                {canMove && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={handleRegisterContact}>
                          <PhoneCall className="h-4 w-4 mr-2 text-info" />
                          Registrar Contato
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleClassificationChange('normal')}>
                          <CheckCircle className="h-4 w-4 mr-2 text-success" />
                          Marcar como Normal
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassificationChange('alerta')}>
                          <AlertTriangle className="h-4 w-4 mr-2 text-warning" />
                          Marcar como Alerta
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassificationChange('critico')}>
                          <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                          Marcar como Crítico
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleClassificationChange('encerrado')}>
                          <XCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                          Marcar como Encerrado
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Niche */}
          {client.niche && (
            <Badge variant="secondary" className="text-xs font-normal">
              {client.niche}
            </Badge>
          )}

          {/* Classification and contact badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn("text-xs", config.bgColor, config.textColor, config.borderColor)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            
            {daysSinceContact !== null && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  isCriticalContact 
                    ? "bg-destructive/10 text-destructive border-destructive/20" 
                    : isUrgent 
                      ? "bg-warning/10 text-warning border-warning/20"
                      : "text-muted-foreground"
                )}
              >
                <Clock className="h-3 w-3 mr-1" />
                {daysSinceContact === 0 ? 'Hoje' : `${daysSinceContact}d`}
              </Badge>
            )}
          </div>

          {/* Onboarding and Tracking badges */}
          {(onboardingTasks.length > 0 || tracking) && (
            <div className="flex flex-wrap gap-2">
              {onboardingTasks.length > 0 && (
                <CSClientOnboardingBadge 
                  tasks={onboardingTasks}
                  isComplete={!!client.campaign_published_at}
                  compact
                />
              )}
              {tracking && (
                <CSClientTrackingBadge tracking={tracking} compact />
              )}
            </div>
          )}

          {/* Action Plan Badge - Inside card */}
          {activeActionPlan && actionPlanDisplay && (
            <div className={cn(
              'rounded-lg p-2.5 border-2',
              activeActionPlan.status === 'completed' && 'bg-success/10 border-success/30',
              activeActionPlan.status === 'cancelled' && 'bg-muted border-muted',
              activeActionPlan.status === 'active' && activeActionPlan.severity === 'leve' && 'bg-success/10 border-success/30',
              activeActionPlan.status === 'active' && activeActionPlan.severity === 'moderado' && 'bg-warning/10 border-warning/30',
              activeActionPlan.status === 'active' && activeActionPlan.severity === 'critico' && 'bg-destructive/10 border-destructive/30',
              actionPlanDisplay.isOverdue && 'animate-pulse border-destructive bg-destructive/10',
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                  activeActionPlan.status === 'completed' && 'bg-success/20 text-success',
                  activeActionPlan.status === 'cancelled' && 'bg-muted text-muted-foreground',
                  activeActionPlan.status === 'active' && activeActionPlan.severity === 'leve' && 'bg-success/20 text-success',
                  activeActionPlan.status === 'active' && activeActionPlan.severity === 'moderado' && 'bg-warning/20 text-warning',
                  activeActionPlan.status === 'active' && activeActionPlan.severity === 'critico' && 'bg-destructive/20 text-destructive',
                  actionPlanDisplay.isOverdue && 'bg-destructive/20 text-destructive',
                )}>
                  {activeActionPlan.status === 'completed' ? '✓' 
                    : activeActionPlan.status === 'cancelled' ? '✕'
                    : actionPlanDisplay.isOverdue ? '!' 
                    : actionPlanDisplay.daysRemaining}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={cn(
                      'text-xs font-bold',
                      activeActionPlan.severity === 'leve' && 'text-success',
                      activeActionPlan.severity === 'moderado' && 'text-warning',
                      activeActionPlan.severity === 'critico' && 'text-destructive',
                      actionPlanDisplay.isOverdue && 'text-destructive',
                    )}>
                      {activeActionPlan.status === 'completed' ? 'Plano Concluído'
                        : activeActionPlan.status === 'cancelled' ? 'Plano Cancelado'
                        : actionPlanDisplay.isOverdue ? 'ATRASADO!'
                        : `${actionPlanDisplay.daysRemaining}d restantes`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    📋 {activeActionPlan.problemLabel}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Investment info */}
          {client.expected_investment && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>R$ {client.expected_investment.toLocaleString('pt-BR')}</span>
            </div>
          )}

          {/* Last contact with quick action */}
          <div className="flex items-center justify-between gap-2">
            {client.last_cs_contact_at ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatDistanceToNow(new Date(client.last_cs_contact_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Sem contato registrado
              </p>
            )}
            
            {canMove && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRegisterContact}
                disabled={updateLastContact.isPending}
              >
                <PhoneCall className="h-3 w-3 mr-1" />
                Contato
              </Button>
            )}
          </div>

          {/* Classification reason */}
          {client.cs_classification_reason && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {client.cs_classification_reason}
            </div>
          )}

          {/* Exit Form Link - only for closed clients (encerrado, churned, or distrato) */}
          {isClientClosed && canMove && (
            <div className="bg-muted/50 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Motivo de Saída
                </p>
                {exitReason?.is_submitted && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                    Preenchido
                  </Badge>
                )}
              </div>
              
              {/* Show exit reason summary if filled */}
              {exitReason?.is_submitted && exitReason.main_reason && (
                <div className="text-xs space-y-1.5 bg-background/50 rounded p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Motivo:</span>
                    <span className="font-medium">
                      {MAIN_REASON_LABELS[exitReason.main_reason] || exitReason.main_reason}
                    </span>
                  </div>
                  {exitReason.satisfaction_score && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Satisfação:</span>
                      <span className="font-medium">{exitReason.satisfaction_score}/5</span>
                    </div>
                  )}
                  {exitReason.would_recommend !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Recomendaria:</span>
                      <span className={cn("font-medium", exitReason.would_recommend ? "text-success" : "text-destructive")}>
                        {exitReason.would_recommend ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Action buttons */}
              {!exitReason?.is_submitted ? (
                <div className="flex gap-2">
                  {/* Internal fill button - primary action */}
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs flex-1"
                    onClick={handleOpenInternalExitForm}
                  >
                    <ClipboardEdit className="h-3 w-3 mr-1" />
                    Preencher
                  </Button>
                  
                  {/* Generate/Copy link button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleCopyExitFormLink}
                    disabled={createExitReason.isPending}
                    title="Copiar link para o cliente preencher"
                  >
                    {createExitReason.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : exitReason?.public_token ? (
                      <Copy className="h-3 w-3" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                  </Button>
                  
                  {exitReason?.public_token && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/saida/${exitReason.public_token}`, '_blank');
                      }}
                      title="Abrir formulário"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1"
                    onClick={handleOpenInternalExitForm}
                  >
                    <ClipboardEdit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Alert suggestion */}
          {showSuggestion && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-2.5 space-y-2">
              <p className="text-xs text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Sugestão: Mover para {CLASSIFICATION_CONFIG[showSuggestion.suggestedClassification].label}
              </p>
              <p className="text-xs text-muted-foreground">
                {showSuggestion.reason}
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="default" 
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptSuggestion();
                  }}
                >
                  Aceitar
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ignorar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classification confirmation dialog */}
      <Dialog open={isClassificationDialogOpen} onOpenChange={setIsClassificationDialogOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedClassification && (
                <>
                  {(() => {
                    const SelectedIcon = CLASSIFICATION_CONFIG[selectedClassification].icon;
                    return <SelectedIcon className={cn("h-5 w-5", CLASSIFICATION_CONFIG[selectedClassification].textColor)} />;
                  })()}
                  Alterar para {CLASSIFICATION_CONFIG[selectedClassification].label}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{client.name}</span>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo da alteração..."
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClassificationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmClassification} disabled={updateClassification.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Internal Exit Form Modal */}
      <InternalExitFormModal
        open={isInternalExitFormOpen}
        onOpenChange={setIsInternalExitFormOpen}
        clientId={client.id}
        clientName={client.name}
        existingExitReasonId={exitReason?.id}
      />
    </>
  );
}
