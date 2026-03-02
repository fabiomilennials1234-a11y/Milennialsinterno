import { useState } from 'react';
import { useOutboundMeetings, useOutboundCreateMeeting, useOutboundUpdateMeeting, useOutboundDeleteMeeting, useOutboundAssignedClients } from '@/hooks/useOutboundManager';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Plus, Video, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import OutboundCardDetailModal from './OutboundCardDetailModal';
import OutboundCardDescriptionPreview from './OutboundCardDescriptionPreview';

interface Props {
  compact?: boolean;
}

export default function OutboundReunioesSection({ compact }: Props) {
  const { data: meetings = [], isLoading } = useOutboundMeetings();
  const { data: clients = [] } = useOutboundAssignedClients();
  const createMeeting = useOutboundCreateMeeting();
  const updateMeeting = useOutboundUpdateMeeting();
  const deleteMeeting = useOutboundDeleteMeeting();

  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Create form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');

  const activeClients = clients.filter(c => !c.archived);

  const handleMeetingClick = (meeting: any) => {
    setSelectedMeeting(meeting);
    setIsDetailModalOpen(true);
  };

  const handleSaveMeeting = async (data: { description?: string; title?: string }) => {
    if (selectedMeeting) {
      await updateMeeting.mutateAsync({ id: selectedMeeting.id, ...data });
      setSelectedMeeting((prev: any) => prev ? { ...prev, ...data } : null);
    }
  };

  const handleOpenCreate = () => {
    setSelectedClientId('');
    setMeetingDate('');
    setMeetingDescription('');
    setIsCreateModalOpen(true);
  };

  const handleCreateMeeting = async () => {
    if (!selectedClientId || !meetingDate) return;

    const client = activeClients.find(c => c.id === selectedClientId);
    const clientName = client?.name || 'Cliente';

    await createMeeting.mutateAsync({
      title: `Reunião — ${clientName}`,
      description: meetingDescription || undefined,
      meeting_date: new Date(meetingDate).toISOString(),
      client_id: selectedClientId,
    });

    setIsCreateModalOpen(false);
  };

  // Sort: upcoming first, then past
  const sortedMeetings = [...meetings].sort((a, b) => {
    if (!a.meeting_date) return 1;
    if (!b.meeting_date) return -1;
    const aDate = new Date(a.meeting_date);
    const bDate = new Date(b.meeting_date);
    const aPast = isPast(aDate);
    const bPast = isPast(bDate);
    if (aPast && !bPast) return 1;
    if (!aPast && bPast) return -1;
    return aDate.getTime() - bDate.getTime();
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <>
        <div className="empty-state">
          <div className="w-16 h-16 mb-4 rounded-full bg-info/10 flex items-center justify-center">
            <Video className="w-7 h-7 text-info" />
          </div>
          <p className="empty-state-title">Nenhuma reunião</p>
          <p className="empty-state-text">Agende sua primeira reunião com um cliente</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="w-full p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-info/10 rounded-xl flex items-center gap-2 transition-colors mt-4 border-2 border-dashed border-info/30 hover:border-info/50"
        >
          <Plus size={14} className="text-info" />
          <span>Adicionar reunião</span>
        </button>

        {/* Create Modal */}
        <CreateMeetingModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          clients={activeClients}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          meetingDate={meetingDate}
          setMeetingDate={setMeetingDate}
          meetingDescription={meetingDescription}
          setMeetingDescription={setMeetingDescription}
          onSubmit={handleCreateMeeting}
          isPending={createMeeting.isPending}
        />
      </>
    );
  }

  const displayMeetings = compact ? sortedMeetings.slice(0, 3) : sortedMeetings;

  return (
    <>
      <div className="space-y-2">
        {displayMeetings.map(meeting => {
          const meetingPast = meeting.meeting_date ? isPast(new Date(meeting.meeting_date)) : false;

          return (
            <div
              key={meeting.id}
              onClick={() => handleMeetingClick(meeting)}
              className={cn(
                'kanban-card p-4 group cursor-pointer',
                meetingPast ? 'border-l-4 border-l-muted-foreground/30 opacity-70' : 'card-border-blue'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-sm font-medium text-foreground">{meeting.title}</h4>

                  {(meeting as any).client_name && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <User size={10} />
                      {(meeting as any).client_name}
                    </p>
                  )}

                  <OutboundCardDescriptionPreview text={meeting.description} className="mt-2" />

                  {meeting.meeting_date && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                        meetingPast ? "bg-muted text-muted-foreground" : "bg-info/10 text-info"
                      )}>
                        <Calendar size={12} />
                        {format(new Date(meeting.meeting_date), "dd MMM", { locale: ptBR })}
                        {meetingPast && ' (Passada)'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} />
                        {format(new Date(meeting.meeting_date), "HH:mm")}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMeeting.mutate(meeting.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 -m-1 hover:bg-destructive/10 rounded-lg"
                >
                  <Trash2 size={14} className="text-destructive" />
                </button>
              </div>
            </div>
          );
        })}

        {compact && meetings.length > 3 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            +{meetings.length - 3} mais reuniões
          </p>
        )}

        <button
          onClick={handleOpenCreate}
          className="w-full p-3 text-sm text-muted-foreground hover:text-info hover:bg-info/10 rounded-xl flex items-center gap-2 transition-colors border-2 border-dashed border-transparent hover:border-info/30"
        >
          <Plus size={14} />
          <span>Adicionar reunião</span>
        </button>
      </div>

      {/* Detail Modal (for editing existing meetings) */}
      <OutboundCardDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        card={selectedMeeting ? {
          id: selectedMeeting.id,
          title: selectedMeeting.title,
          description: selectedMeeting.description,
          createdAt: selectedMeeting.created_at,
        } : null}
        onSave={handleSaveMeeting}
        listName="Reuniões"
      />

      {/* Create Modal */}
      <CreateMeetingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        clients={activeClients}
        selectedClientId={selectedClientId}
        setSelectedClientId={setSelectedClientId}
        meetingDate={meetingDate}
        setMeetingDate={setMeetingDate}
        meetingDescription={meetingDescription}
        setMeetingDescription={setMeetingDescription}
        onSubmit={handleCreateMeeting}
        isPending={createMeeting.isPending}
      />
    </>
  );
}

// ─── Create Meeting Modal ──────────────────────────────────────────────────────

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  meetingDate: string;
  setMeetingDate: (date: string) => void;
  meetingDescription: string;
  setMeetingDescription: (desc: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

function CreateMeetingModal({
  isOpen,
  onClose,
  clients,
  selectedClientId,
  setSelectedClientId,
  meetingDate,
  setMeetingDate,
  meetingDescription,
  setMeetingDescription,
  onSubmit,
  isPending,
}: CreateMeetingModalProps) {
  const canSubmit = selectedClientId && meetingDate;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-info/10 to-primary/10 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
              <Video className="text-info" size={24} />
            </div>
            <div>
              <span className="text-xs font-medium text-info uppercase tracking-wider">
                Nova Reunião
              </span>
              <h2 className="text-lg font-bold text-foreground">Agendar Reunião</h2>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Client Selector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User size={14} className="text-muted-foreground" />
              Cliente Outbound
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full h-10 px-3 py-2 text-sm bg-background border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Calendar size={14} className="text-muted-foreground" />
              Data e Horário
            </label>
            <Input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input-apple text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Video size={14} className="text-muted-foreground" />
              Sobre o que será a call?
            </label>
            <Textarea
              value={meetingDescription}
              onChange={(e) => setMeetingDescription(e.target.value)}
              placeholder="Descreva o assunto da reunião..."
              className="input-apple text-sm min-h-[100px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="text-sm">
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
            className="btn-cta gap-2"
          >
            <Plus size={14} />
            {isPending ? 'Agendando...' : 'Agendar Reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
