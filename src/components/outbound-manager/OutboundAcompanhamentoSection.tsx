import { useState, useEffect, useRef } from 'react';
import { useOutboundAssignedClients, useOutboundClientTracking, useOutboundMoveClientDay, useOutboundUpsertClientDocumentation, useOutboundCreateCombinadoTask } from '@/hooks/useOutboundManager';
import { useTargetOutboundManager } from '@/contexts/OutboundManagerContext';
import { Clock, AlertCircle, CheckCircle, GripVertical, Eye, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  compact?: boolean;
}

const DAYS = [
  { id: 'segunda', label: 'SEG' },
  { id: 'terca', label: 'TER' },
  { id: 'quarta', label: 'QUA' },
  { id: 'quinta', label: 'QUI' },
  { id: 'sexta', label: 'SEX' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

interface DocForm {
  client_budget: string;
  metrics: string;
  actions_done: string;
  has_combinado: 'sim' | 'nao' | null; // null = not selected yet
  combinado_description: string;
  combinado_deadline: Date | undefined;
}

export default function OutboundAcompanhamentoSection({ compact }: Props) {
  const { user, isCEO } = useAuth();
  const canSetClientLabel = isCEO || user?.role === 'sucesso_cliente' || user?.role === 'gestor_projetos';

  const { targetUserId } = useTargetOutboundManager();
  const { data: clients = [] } = useOutboundAssignedClients();
  const { data: tracking = [] } = useOutboundClientTracking();
  const moveClient = useOutboundMoveClientDay();
  const upsertDoc = useOutboundUpsertClientDocumentation();
  const createCombinadoTask = useOutboundCreateCombinadoTask();

  // Log context for debugging

  const [docModal, setDocModal] = useState<{ open: boolean; clientId?: string; clientName?: string; newDay?: string }>({ open: false });
  const [docForm, setDocForm] = useState<DocForm>({
    client_budget: '',
    metrics: '',
    actions_done: '',
    has_combinado: null,
    combinado_description: '',
    combinado_deadline: undefined,
  });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get active clients (outbound doesn't use campaign_published_at)
  const activeClients = clients.filter(c => c.status === 'active');

  // Auto-create tracking for active clients that don't have a record yet
  const autoCreatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeClients.length || !tracking) return;

    const trackedClientIds = new Set(tracking.map(t => t.client_id));
    const untracked = activeClients.filter(c => !trackedClientIds.has(c.id) && !autoCreatedRef.current.has(c.id));

    if (untracked.length === 0) return;

    // Get current day of week in Brazil timezone
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(new Date());
    const dayMap: Record<string, string> = {
      'Monday': 'segunda', 'Tuesday': 'terca', 'Wednesday': 'quarta',
      'Thursday': 'quinta', 'Friday': 'sexta', 'Saturday': 'segunda', 'Sunday': 'segunda',
    };
    const currentDay = dayMap[dayOfWeek] || 'segunda';

    untracked.forEach(client => {
      autoCreatedRef.current.add(client.id);
      moveClient.mutate({ clientId: client.id, newDay: currentDay });
    });
  }, [activeClients, tracking]);

  // Get client position by day
  const getClientsByDay = (day: string) => {
    return tracking
      .filter(t => t.current_day === day)
      .map(t => ({
        ...t,
        client: t.clients,
        daysInPosition: Math.floor((new Date().getTime() - new Date(t.last_moved_at).getTime()) / (1000 * 60 * 60 * 24)),
      }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const clientId = result.draggableId;
    const newDay = result.destination.droppableId;
    const currentDay = result.source.droppableId;

    // Only open modal if moving to a different day
    if (currentDay === newDay) return;

    const clientName = tracking.find(t => t.client_id === clientId)?.clients?.name || 'Cliente';

    setDocModal({ open: true, clientId, clientName, newDay });
  };

  const handleDocSubmit = async () => {
    if (!docModal.clientId || !docModal.newDay) return;

    // Validate that combinado selection was made
    if (docForm.has_combinado === null) {
      toast.error('Selecione se foi combinado algo hoje');
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

      // Build the actions_done content with combinado info if applicable
      let actionsContent = docForm.actions_done;
      if (docForm.has_combinado === 'sim' && docForm.combinado_description && docForm.combinado_deadline) {
        actionsContent += `\n\n📌 COMBINADO: ${docForm.combinado_description}\n📅 Prazo: ${format(docForm.combinado_deadline, 'dd/MM/yyyy')}`;
      }

      // Save documentation (upsert - one card per client per day)
      await upsertDoc.mutateAsync({
        clientId: docModal.clientId,
        client_budget: docForm.client_budget,
        metrics: docForm.metrics,
        actions_done: actionsContent,
      });

      // Create task if there was a combinado
      if (docForm.has_combinado === 'sim' && docForm.combinado_description && docForm.combinado_deadline) {
        try {
          await createCombinadoTask.mutateAsync({
            title: docForm.combinado_description,
            dueDate: docForm.combinado_deadline.toISOString(),
            clientId: docModal.clientId,
            clientName: docModal.clientName || 'Cliente',
          });
        } catch (taskError) {
          console.error('[OutboundAcompanhamentoSection] Error creating combinado task:', taskError);
          toast.error('Erro ao criar tarefa de combinado');
        }
      }

      // Move client to new day
      await moveClient.mutateAsync({
        clientId: docModal.clientId,
        newDay: docModal.newDay,
      });

      toast.success('Documentação salva e cliente movido!');

      // Reset form and close modal
      setDocModal({ open: false });
      setDocForm({
        client_budget: '',
        metrics: '',
        actions_done: '',
        has_combinado: null,
        combinado_description: '',
        combinado_deadline: undefined,
      });
    } catch (error) {
      console.error('Error saving documentation:', error);
      toast.error('Erro ao salvar documentação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setDocModal({ open: false });
    setDocForm({
      client_budget: '',
      metrics: '',
      actions_done: '',
      has_combinado: null,
      combinado_description: '',
      combinado_deadline: undefined,
    });
  };

  if (compact) {
    const totalClients = activeClients.length;
    const delayedClients = tracking.filter(t => t.is_delayed).length;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <p className="text-cyan-400 font-bold">{totalClients}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
          <div className="p-2 bg-red-500/20 rounded-lg">
            <p className="text-red-400 font-bold">{delayedClients}</p>
            <p className="text-xs text-muted-foreground">Atraso</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DragDropContext onDragEnd={handleDragEnd}>
        {DAYS.map(day => (
          <div key={day.id}>
            {/* Day Header — fica vermelho quando há cliente atrasado na coluna */}
            {(() => {
              const dayClients = getClientsByDay(day.id);
              const hasDelayed = dayClients.some(item => item.is_delayed);
              return (
                <div className={cn(
                  'px-3 py-2 rounded-t-lg font-medium text-sm border border-b-0 transition-colors',
                  hasDelayed
                    ? 'bg-danger/10 border-danger/40 text-danger'
                    : 'bg-muted/50 border-border text-foreground'
                )}>
                  {day.label}
                  <Badge
                    variant={hasDelayed ? 'destructive' : 'secondary'}
                    className="ml-2 text-[10px]"
                  >
                    {dayClients.length}
                  </Badge>
                  {hasDelayed && (
                    <span className="ml-2 text-[10px] font-normal opacity-80">
                      ⚠️ atrasado
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Clients */}
            <Droppable droppableId={day.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'min-h-[40px] space-y-1 p-2 bg-muted/20 rounded-b-lg border border-t-0 border-border',
                    snapshot.isDraggingOver && 'bg-primary/10'
                  )}
                >
                  {getClientsByDay(day.id).map((item, index) => (
                    <Draggable key={item.client_id} draggableId={item.client_id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            'p-2 bg-card border rounded-lg cursor-grab active:cursor-grabbing',
                            snapshot.isDragging && 'shadow-lg',
                            item.is_delayed ? 'border-red-500' : 'border-border'
                          )}
                        >
                        <div className="flex flex-col gap-1">
                            {/* Overdue Invoice Badge - Full width at top */}
                            <OverdueInvoiceBadge clientId={item.client_id} className="w-full justify-center" />
                            {/* Contract Status Badge */}
                            <ContractStatusBadge clientId={item.client_id} className="w-full justify-center" />

                            <div className="flex items-center gap-2">
                              <GripVertical size={12} className="text-muted-foreground shrink-0" />
                              {/* Avatar com iniciais */}
                              <div className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold',
                                item.is_delayed ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary'
                              )}>
                                {getInitials(item.client?.name || 'C')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  {item.is_delayed ? (
                                    <Badge variant="destructive" className="text-[8px] px-1 py-0 gap-0.5 shrink-0">
                                      <AlertCircle size={8} />
                                      <span>Atrasado</span>
                                    </Badge>
                                  ) : (
                                    <Badge className="text-[8px] px-1 py-0 bg-emerald-500 shrink-0">
                                      <CheckCircle size={8} />
                                    </Badge>
                                  )}
                                  <p className="text-xs font-medium truncate">{item.client?.name || 'Cliente'}</p>
                                  <ClientLabelBadge label={(item.client as any)?.client_label as ClientLabel} size="sm" />

                                  <div className="ml-auto flex items-center gap-1">
                                    {canSetClientLabel && (
                                      <ClientLabelSelector
                                        clientId={item.client_id}
                                        currentLabel={(item.client as any)?.client_label as ClientLabel}
                                      />
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedClientId(item.client_id);
                                      }}
                                    >
                                      <Eye size={10} />
                                      Ver
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                  <span className={cn(
                                    'flex items-center gap-0.5 px-1 rounded',
                                    item.daysInPosition > 1 ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                                  )}>
                                    <Clock size={8} />
                                    {item.daysInPosition}d
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </DragDropContext>

      {/* Documentation Modal */}
      <Dialog open={docModal.open} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              📋 Documentação, {docModal.clientName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Preencha a documentação antes de mover o cliente.
            </p>

            {/* Leads entregues */}
            <div>
              <Label className="text-sm font-medium">Quantos leads foram entregues ao cliente?</Label>
              <Textarea
                value={docForm.client_budget}
                onChange={e => setDocForm(prev => ({ ...prev, client_budget: e.target.value }))}
                placeholder="Ex: 50 leads entregues hoje..."
                className="mt-2 min-h-[60px] resize-none"
              />
            </div>

            {/* Métricas Torque */}
            <div>
              <Label className="text-sm font-medium">Quais as métricas dentro do Torque?</Label>
              <Textarea
                value={docForm.metrics}
                onChange={e => setDocForm(prev => ({ ...prev, metrics: e.target.value }))}
                placeholder="Taxa de resposta, conversão, abertura..."
                className="mt-2 min-h-[60px] resize-none"
              />
            </div>

            {/* Ações */}
            <div>
              <Label className="text-sm font-medium">O que foi feito para o cliente hoje?</Label>
              <Textarea
                value={docForm.actions_done}
                onChange={e => setDocForm(prev => ({ ...prev, actions_done: e.target.value }))}
                placeholder="Ajustei listas, criei novas campanhas..."
                className="mt-2 min-h-[80px] resize-none"
              />
            </div>

            {/* Modificação / Combinado */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Foi feita alguma modificação ou combinado com o cliente? <span className="text-destructive">*</span>
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
                    <RadioGroupItem value="sim" id="outbound_combinado_sim" />
                    <Label htmlFor="outbound_combinado_sim" className="cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="outbound_combinado_nao" />
                    <Label htmlFor="outbound_combinado_nao" className="cursor-pointer">Não</Label>
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
                    <Label className="text-sm font-medium">Qual o prazo que foi combinado?</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal mt-2",
                            !docForm.combinado_deadline && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {docForm.combinado_deadline
                            ? format(docForm.combinado_deadline, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                            : "Selecione a data"}
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
                    ⚠️ Uma tarefa será criada automaticamente com o título do combinado e o prazo selecionado.
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleDocSubmit}
              className="w-full"
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar e Mover Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen={true}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </div>
  );
}
