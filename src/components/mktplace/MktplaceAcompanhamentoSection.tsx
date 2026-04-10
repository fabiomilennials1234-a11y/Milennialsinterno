import { useState } from 'react';
import { useMktplaceTracking, useMoveClientMktplace, useSaveMktplaceDoc, DAYS } from '@/hooks/useMktplaceKanban';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import ClientViewModal from '@/components/client/ClientViewModal';
import { Eye, GripVertical, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  trackingType: 'consultoria' | 'gestao';
  title: string;
}

interface DocForm {
  falou_com_cliente: 'sim' | 'nao' | null;
  falou_justificativa: string;
  fez_algo_novo: 'sim' | 'nao' | null;
  fez_algo_justificativa: string;
  fez_algo_descricao: string;
  combinado: 'sim' | 'nao' | null;
  combinado_descricao: string;
  combinado_prazo: Date | undefined;
  combinado_justificativa: string;
}

const emptyForm: DocForm = {
  falou_com_cliente: null,
  falou_justificativa: '',
  fez_algo_novo: null,
  fez_algo_justificativa: '',
  fez_algo_descricao: '',
  combinado: null,
  combinado_descricao: '',
  combinado_prazo: undefined,
  combinado_justificativa: '',
};

export default function MktplaceAcompanhamentoSection({ trackingType, title }: Props) {
  const { data: allTracking = [] } = useMktplaceTracking();
  const moveClient = useMoveClientMktplace();
  const saveDoc = useSaveMktplaceDoc();

  const tracking = allTracking.filter((t: any) => t.tracking_type === trackingType);

  const [docModal, setDocModal] = useState<{ open: boolean; clientId?: string; clientName?: string; newDay?: string }>({ open: false });
  const [docForm, setDocForm] = useState<DocForm>({ ...emptyForm });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getClientsByDay = (day: string) => {
    return tracking
      .filter((t: any) => t.current_day === day)
      .map((t: any) => ({
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
    if (currentDay === newDay) return;

    const clientName = tracking.find((t: any) => t.client_id === clientId)?.clients?.name || 'Cliente';
    setDocForm({ ...emptyForm });
    setDocModal({ open: true, clientId, clientName, newDay });
  };

  const validateForm = (): boolean => {
    if (trackingType === 'gestao' && docForm.falou_com_cliente === null) {
      toast.error('Informe se falou com o cliente hoje');
      return false;
    }
    if (trackingType === 'gestao' && docForm.falou_com_cliente === 'nao' && !docForm.falou_justificativa.trim()) {
      toast.error('Informe o motivo de não ter falado com o cliente');
      return false;
    }
    if (docForm.fez_algo_novo === null) {
      toast.error('Informe se fez algo novo no cliente hoje');
      return false;
    }
    if (docForm.fez_algo_novo === 'nao' && !docForm.fez_algo_justificativa.trim()) {
      toast.error('Informe o motivo de não ter feito nada novo');
      return false;
    }
    if (docForm.fez_algo_novo === 'sim' && !docForm.fez_algo_descricao.trim()) {
      toast.error('Descreva o que foi feito');
      return false;
    }
    if (docForm.combinado === null) {
      toast.error('Informe se foi combinado algo hoje');
      return false;
    }
    if (docForm.combinado === 'sim' && !docForm.combinado_descricao.trim()) {
      toast.error('Descreva o que foi combinado');
      return false;
    }
    if (docForm.combinado === 'sim' && !docForm.combinado_prazo) {
      toast.error('Selecione o prazo do combinado');
      return false;
    }
    if (docForm.combinado === 'nao' && !docForm.combinado_justificativa.trim()) {
      toast.error('Informe o motivo de não ter combinado nada');
      return false;
    }
    return true;
  };

  const handleDocSubmit = async () => {
    if (!docModal.clientId || !docModal.newDay || !validateForm()) return;

    setIsSaving(true);
    try {
      await saveDoc.mutateAsync({
        clientId: docModal.clientId,
        trackingType,
        falou_com_cliente: trackingType === 'gestao' ? (docForm.falou_com_cliente || undefined) : undefined,
        falou_justificativa: docForm.falou_justificativa || undefined,
        fez_algo_novo: docForm.fez_algo_novo!,
        fez_algo_justificativa: docForm.fez_algo_justificativa || undefined,
        fez_algo_descricao: docForm.fez_algo_descricao || undefined,
        combinado: docForm.combinado!,
        combinado_descricao: docForm.combinado_descricao || undefined,
        combinado_prazo: docForm.combinado_prazo ? format(docForm.combinado_prazo, 'yyyy-MM-dd') : undefined,
        combinado_justificativa: docForm.combinado_justificativa || undefined,
      });

      await moveClient.mutateAsync({ clientId: docModal.clientId, newDay: docModal.newDay });
      setDocModal({ open: false });
    } catch (err) {
      // errors handled by hooks
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {DAYS.map(day => {
            const dayClients = getClientsByDay(day.id);
            return (
              <Droppable key={day.id} droppableId={day.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'rounded-xl border p-2 min-h-[60px] transition-colors',
                      snapshot.isDraggingOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-bold text-muted-foreground">{day.label}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{dayClients.length}</Badge>
                    </div>

                    {dayClients.map((item: any, index: number) => {
                      const clientName = item.client?.razao_social || item.client?.name || 'Cliente';
                      return (
                        <Draggable key={item.client_id} draggableId={item.client_id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className="bg-card rounded-lg border border-subtle p-2 mb-1.5 shadow-sm"
                            >
                              <div className="flex items-center gap-1.5">
                                <div {...dragProvided.dragHandleProps} className="cursor-grab">
                                  <GripVertical size={12} className="text-muted-foreground" />
                                </div>
                                <span className="text-xs font-medium text-foreground flex-1 line-clamp-1">{clientName}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 text-[10px] gap-0.5"
                                  onClick={() => setSelectedClientId(item.client_id)}
                                >
                                  <Eye size={10} />
                                  Ver
                                </Button>
                                {item.daysInPosition > 0 && (
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] h-4 px-1",
                                    item.daysInPosition > 1 ? "border-destructive text-destructive" : "border-warning text-warning"
                                  )}>
                                    <Clock size={8} className="mr-0.5" />
                                    {item.daysInPosition}d
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Modal de documentação obrigatória */}
      <Dialog open={docModal.open} onOpenChange={(open) => { if (!open && !isSaving) setDocModal({ open: false }); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Documentação Diária — {docModal.clientName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Pergunta 1: Falou com cliente (só Gestão) */}
            {trackingType === 'gestao' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Você falou com o cliente hoje?</Label>
                <RadioGroup
                  value={docForm.falou_com_cliente || ''}
                  onValueChange={(v) => setDocForm(f => ({ ...f, falou_com_cliente: v as 'sim' | 'nao' }))}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="sim" id="falou-sim" />
                      <Label htmlFor="falou-sim" className="text-sm">Sim</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="nao" id="falou-nao" />
                      <Label htmlFor="falou-nao" className="text-sm">Não</Label>
                    </div>
                  </div>
                </RadioGroup>
                {docForm.falou_com_cliente === 'nao' && (
                  <Textarea
                    placeholder="Por que não falou com o cliente?"
                    value={docForm.falou_justificativa}
                    onChange={(e) => setDocForm(f => ({ ...f, falou_justificativa: e.target.value }))}
                    className="mt-1"
                  />
                )}
              </div>
            )}

            {/* Pergunta 2: Fez algo novo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Você fez algo novo no cliente hoje?</Label>
              <RadioGroup
                value={docForm.fez_algo_novo || ''}
                onValueChange={(v) => setDocForm(f => ({ ...f, fez_algo_novo: v as 'sim' | 'nao' }))}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sim" id="fez-sim" />
                    <Label htmlFor="fez-sim" className="text-sm">Sim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nao" id="fez-nao" />
                    <Label htmlFor="fez-nao" className="text-sm">Não</Label>
                  </div>
                </div>
              </RadioGroup>
              {docForm.fez_algo_novo === 'sim' && (
                <Textarea
                  placeholder="O que foi feito?"
                  value={docForm.fez_algo_descricao}
                  onChange={(e) => setDocForm(f => ({ ...f, fez_algo_descricao: e.target.value }))}
                  className="mt-1"
                />
              )}
              {docForm.fez_algo_novo === 'nao' && (
                <Textarea
                  placeholder="Por que não fez nada novo?"
                  value={docForm.fez_algo_justificativa}
                  onChange={(e) => setDocForm(f => ({ ...f, fez_algo_justificativa: e.target.value }))}
                  className="mt-1"
                />
              )}
            </div>

            {/* Pergunta 3: Combinado */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Foi combinado algo com o cliente hoje?</Label>
              <RadioGroup
                value={docForm.combinado || ''}
                onValueChange={(v) => setDocForm(f => ({ ...f, combinado: v as 'sim' | 'nao' }))}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sim" id="comb-sim" />
                    <Label htmlFor="comb-sim" className="text-sm">Sim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nao" id="comb-nao" />
                    <Label htmlFor="comb-nao" className="text-sm">Não</Label>
                  </div>
                </div>
              </RadioGroup>
              {docForm.combinado === 'sim' && (
                <div className="space-y-2 mt-1">
                  <Textarea
                    placeholder="O que foi combinado?"
                    value={docForm.combinado_descricao}
                    onChange={(e) => setDocForm(f => ({ ...f, combinado_descricao: e.target.value }))}
                  />
                  <div>
                    <Label className="text-xs text-muted-foreground">Prazo</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left text-sm h-9 mt-1">
                          <CalendarIcon size={14} className="mr-2 text-muted-foreground" />
                          {docForm.combinado_prazo
                            ? format(docForm.combinado_prazo, "dd/MM/yyyy", { locale: ptBR })
                            : 'Selecionar prazo'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={docForm.combinado_prazo}
                          onSelect={(d) => setDocForm(f => ({ ...f, combinado_prazo: d }))}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
              {docForm.combinado === 'nao' && (
                <Textarea
                  placeholder="Por que não foi combinado nada?"
                  value={docForm.combinado_justificativa}
                  onChange={(e) => setDocForm(f => ({ ...f, combinado_justificativa: e.target.value }))}
                  className="mt-1"
                />
              )}
            </div>

            <Button onClick={handleDocSubmit} disabled={isSaving} className="w-full">
              {isSaving ? 'Salvando...' : 'Confirmar e Mover'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de visualização do cliente */}
      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen={true}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}
