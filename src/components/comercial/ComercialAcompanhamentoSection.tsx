import { useState } from 'react';
import { Users, Eye, AlertTriangle, GripVertical, Calendar, HelpCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  useComercialTracking,
  useMoveClientToDay,
  DAY_LABELS,
  WEEK_DAYS,
  WeekDay,
  isTrackingDelayed,
  ComercialTracking,
} from '@/hooks/useComercialTracking';
import { useUpsertComercialClientDoc, useCreateComercialCombinadoTask } from '@/hooks/useComercialClientDocumentation';
import { useSquadManagers } from '@/hooks/useSquadManagers';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DocForm {
  helped_client: 'sim' | 'nao' | null;
  help_description: string;
  has_combinado: 'sim' | 'nao' | null;
  combinado_description: string;
  combinado_deadline: Date | undefined;
}

const INITIAL_DOC_FORM: DocForm = {
  helped_client: null,
  help_description: '',
  has_combinado: null,
  combinado_description: '',
  combinado_deadline: undefined,
};

function ClientItem({ 
  tracking, 
  onViewClient 
}: { 
  tracking: ComercialTracking; 
  onViewClient: (id: string) => void;
}) {
  const isDelayed = isTrackingDelayed(tracking);

  return (
    <div 
      className={`p-2 rounded-lg border text-xs ${
        isDelayed 
          ? 'bg-destructive/10 border-destructive/30' 
          : 'bg-card border-subtle'
      }`}
    >
      {/* Overdue Invoice Badge - Full width at top */}
      <OverdueInvoiceBadge clientId={tracking.client_id} className="w-full justify-center mb-1" />
      {/* Contract Status Badge */}
      <ContractStatusBadge clientId={tracking.client_id} className="w-full justify-center mb-1" />
      
      <div className="flex items-center gap-2">
        <GripVertical size={12} className="text-muted-foreground cursor-grab flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary mb-1 truncate max-w-full">
            {tracking.manager_name}
          </span>
          <p className={`truncate font-medium ${isDelayed ? 'text-destructive' : ''}`}>
            {tracking.client?.name || 'Cliente'}
          </p>
          <ClientLabelBadge label={(tracking.client?.client_label ?? null) as ClientLabel} size="sm" />
        </div>
        {isDelayed && <AlertTriangle size={12} className="text-destructive flex-shrink-0" />}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onViewClient(tracking.client_id);
          }}
        >
          <Eye size={10} />
        </Button>
      </div>
    </div>
  );
}

function ManagerColumn({ 
  manager, 
  allTracking,
  onMoveClient,
}: { 
  manager: { user_id: string; name: string }; 
  allTracking: ComercialTracking[];
  onMoveClient: (trackingId: string, newDay: WeekDay, clientName: string, clientId: string) => void;
}) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Filter tracking for this manager
  const managerTracking = allTracking.filter(t => t.manager_id === manager.user_id);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const trackingId = result.draggableId;
    const newDay = result.destination.droppableId.replace(`${manager.user_id}-`, '') as WeekDay;
    const currentDay = result.source.droppableId.replace(`${manager.user_id}-`, '');
    
    // Only open modal if moving to a different day
    if (currentDay === newDay) return;
    
    const trackingItem = managerTracking.find(t => t.id === trackingId);
    const clientName = trackingItem?.client?.name || 'Cliente';
    const clientId = trackingItem?.client_id || '';
    
    onMoveClient(trackingId, newDay, clientName, clientId);
  };

  const getTrackingByDay = (day: WeekDay) => {
    return managerTracking.filter(t => t.current_day === day);
  };

  const delayedCount = managerTracking.filter(t => isTrackingDelayed(t)).length;

  return (
    <>
      <div className="bg-card rounded-xl border border-subtle overflow-hidden min-w-[260px] flex-shrink-0">
        <div className="section-header section-header-blue">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-white" />
            <span className="font-medium text-sm truncate">{manager.name.toUpperCase()}</span>
          </div>
          {delayedCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {delayedCount}
            </Badge>
          )}
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="p-2 space-y-2">
            {WEEK_DAYS.map((day) => {
              const dayTracking = getTrackingByDay(day);
              const droppableId = `${manager.user_id}-${day}`;
              
              return (
                <div key={day} className="bg-muted/30 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {DAY_LABELS[day]}
                    </span>
                    <Badge variant="secondary" className="text-xs h-4 px-1">
                      {dayTracking.length}
                    </Badge>
                  </div>
                  <Droppable droppableId={droppableId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[32px] space-y-1 ${snapshot.isDraggingOver ? 'bg-primary/10 rounded p-1' : ''}`}
                      >
                        {dayTracking.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <ClientItem 
                                  tracking={item} 
                                  onViewClient={setSelectedClientId}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {dayTracking.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-1">
                            -
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <ClientViewModal
        isOpen={!!selectedClientId}
        clientId={selectedClientId || ''}
        onClose={() => setSelectedClientId(null)}
      />
    </>
  );
}

export default function ComercialAcompanhamentoSection() {
  const { data: managers = [], isLoading: managersLoading } = useSquadManagers();
  const { data: allTracking = [], isLoading: trackingLoading } = useComercialTracking();
  const moveClient = useMoveClientToDay();
  const upsertDoc = useUpsertComercialClientDoc();
  const createCombinadoTask = useCreateComercialCombinadoTask();

  const [docModal, setDocModal] = useState<{ 
    open: boolean; 
    trackingId?: string;
    clientId?: string; 
    clientName?: string; 
    newDay?: WeekDay;
  }>({ open: false });
  const [docForm, setDocForm] = useState<DocForm>(INITIAL_DOC_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const isLoading = managersLoading || trackingLoading;

  const handleMoveClient = (trackingId: string, newDay: WeekDay, clientName: string, clientId: string) => {
    setDocModal({ open: true, trackingId, clientId, clientName, newDay });
  };

  const handleDocSubmit = async () => {
    if (!docModal.trackingId || !docModal.newDay || !docModal.clientId) return;

    // Validate helped_client selection
    if (docForm.helped_client === null) {
      toast.error('Selecione se ajudou o cliente hoje');
      return;
    }

    // Validate help_description
    if (!docForm.help_description.trim()) {
      toast.error(docForm.helped_client === 'sim' 
        ? 'Descreva o que foi feito com o cliente' 
        : 'Explique o motivo de não ter ajudado o cliente');
      return;
    }

    // Validate combinado selection
    if (docForm.has_combinado === null) {
      toast.error('Selecione se foi combinado algo com o cliente');
      return;
    }

    // Validate combinado fields if has_combinado is 'sim'
    if (docForm.has_combinado === 'sim') {
      if (!docForm.combinado_description.trim()) {
        toast.error('Informe o que foi combinado');
        return;
      }
      if (!docForm.combinado_deadline) {
        toast.error('Selecione o prazo do combinado');
        return;
      }
    }

    setIsSaving(true);

    try {
      // Save documentation
      await upsertDoc.mutateAsync({
        clientId: docModal.clientId,
        helpedClient: docForm.helped_client === 'sim',
        helpDescription: docForm.help_description,
        hasCombinado: docForm.has_combinado === 'sim',
        combinadoDescription: docForm.combinado_description,
        combinadoDeadline: docForm.combinado_deadline,
      });

      // Create task if there was a combinado
      if (docForm.has_combinado === 'sim' && docForm.combinado_description && docForm.combinado_deadline) {
        await createCombinadoTask.mutateAsync({
          title: docForm.combinado_description,
          dueDate: docForm.combinado_deadline.toISOString(),
          clientId: docModal.clientId,
          clientName: docModal.clientName || 'Cliente',
        });
      }

      // Move client to new day (silent to avoid duplicate toast)
      await moveClient.mutateAsync({
        trackingId: docModal.trackingId,
        newDay: docModal.newDay,
        silent: true,
      });

      toast.success('Documentação salva e cliente movido!');

      // Reset form and close modal
      handleCloseModal();
    } catch (error) {
      console.error('Error saving documentation:', error);
      toast.error('Erro ao salvar documentação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setDocModal({ open: false });
    setDocForm(INITIAL_DOC_FORM);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4">
        <Skeleton className="h-64 w-[260px]" />
        <Skeleton className="h-64 w-[260px]" />
      </div>
    );
  }

  if (managers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="mx-auto mb-2 opacity-50" size={32} />
        <p className="text-sm font-medium">Nenhum gestor encontrado</p>
        <p className="text-xs mt-1">Gestores de Ads aparecerão aqui automaticamente</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {managers.map((manager) => (
            <ManagerColumn 
              key={manager.user_id} 
              manager={manager}
              allTracking={allTracking}
              onMoveClient={handleMoveClient}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Documentation Modal */}
      <Dialog open={docModal.open} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              📋 Documentação: {docModal.clientName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Preencha a documentação antes de mover o cliente.
            </p>

            {/* Pergunta 1: Ajudou o cliente? */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <HelpCircle size={16} className="text-primary" />
                  Você ajudou esse cliente hoje de alguma forma? <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={docForm.helped_client || ''}
                  onValueChange={(value: 'sim' | 'nao') =>
                    setDocForm(prev => ({
                      ...prev,
                      helped_client: value,
                      help_description: '',
                    }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="helped_sim" />
                    <Label htmlFor="helped_sim" className="cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="helped_nao" />
                    <Label htmlFor="helped_nao" className="cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {docForm.helped_client !== null && (
                <div className="pt-2 border-t border-border">
                  <Label className="text-sm font-medium">
                    {docForm.helped_client === 'sim'
                      ? 'O que foi feito com o cliente hoje?'
                      : 'Por que não ajudou o cliente hoje?'}
                    <span className="text-destructive"> *</span>
                  </Label>
                  <Textarea
                    value={docForm.help_description}
                    onChange={e => setDocForm(prev => ({ ...prev, help_description: e.target.value }))}
                    placeholder={docForm.helped_client === 'sim'
                      ? 'Descreva as ações realizadas...'
                      : 'Explique o motivo...'}
                    className="mt-2 min-h-[80px] resize-none"
                  />
                </div>
              )}
            </div>

            {/* Pergunta 2: Foi combinado algo? */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare size={16} className="text-primary" />
                  Foi combinado algo com o cliente? <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={docForm.has_combinado || ''}
                  onValueChange={(value: 'sim' | 'nao') =>
                    setDocForm(prev => ({
                      ...prev,
                      has_combinado: value,
                      combinado_description: value === 'sim' ? prev.combinado_description : '',
                      combinado_deadline: value === 'sim' ? prev.combinado_deadline : undefined,
                    }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="combinado_sim" />
                    <Label htmlFor="combinado_sim" className="cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="combinado_nao" />
                    <Label htmlFor="combinado_nao" className="cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {docForm.has_combinado === 'sim' && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div>
                    <Label className="text-sm font-medium">O que foi combinado?</Label>
                    <Textarea
                      value={docForm.combinado_description}
                      onChange={e => setDocForm(prev => ({ ...prev, combinado_description: e.target.value }))}
                      placeholder="Descreva o que foi combinado com o cliente..."
                      className="mt-2 min-h-[60px] resize-none"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Qual o prazo combinado?</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal mt-2',
                            !docForm.combinado_deadline && 'text-muted-foreground'
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {docForm.combinado_deadline
                            ? format(docForm.combinado_deadline, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                            : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={docForm.combinado_deadline}
                          onSelect={(date) => setDocForm(prev => ({ ...prev, combinado_deadline: date }))}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <p className="text-xs text-muted-foreground bg-warning/10 p-2 rounded-lg">
                    ⚠️ Uma tarefa será criada automaticamente para lembrar deste combinado.
                  </p>
                </div>
              )}
            </div>

            {/* Submit button */}
            <Button
              className="w-full"
              onClick={handleDocSubmit}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar e Mover Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
