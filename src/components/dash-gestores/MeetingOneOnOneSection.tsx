import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, CheckCircle2, XCircle, AlertTriangle, FileText, Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react';
import { useMeetingsOneOnOne, MeetingOneOnOne } from '@/hooks/useMeetingsOneOnOne';
import MeetingOneOnOneModal from './MeetingOneOnOneModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function MeetingCard({ meeting, onArchive, onUnarchive, isArchived }: {
  meeting: MeetingOneOnOne;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  isArchived: boolean;
}) {
  const hasDelays = meeting.delay_video || meeting.delay_design || meeting.delay_site || meeting.delay_crm || meeting.delay_automation;
  const delayCount = [meeting.delay_video, meeting.delay_design, meeting.delay_site, meeting.delay_crm, meeting.delay_automation].filter(Boolean).length;

  return (
    <div className={`p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors ${isArchived ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{meeting.evaluated_manager_name}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(meeting.meeting_date), "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {meeting.documentation_up_to_date ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <XCircle className="w-4 h-4 text-danger" />
          )}
          <button
            onClick={() => isArchived ? onUnarchive(meeting.id) : onArchive(meeting.id)}
            className="ml-1 p-1 rounded hover:bg-muted transition-colors"
            title={isArchived ? 'Desarquivar' : 'Arquivar'}
          >
            {isArchived ? (
              <ArchiveRestore className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Archive className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {meeting.correct_client_movement ? (
          <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">
            Movimentação OK
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] bg-danger/10 text-danger">
            Movimentação ⚠
          </Badge>
        )}

        {hasDelays && (
          <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {delayCount} atraso{delayCount > 1 ? 's' : ''}
          </Badge>
        )}

        {meeting.main_challenges?.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {meeting.main_challenges.length} desafio{meeting.main_challenges.length > 1 ? 's' : ''}
          </Badge>
        )}

        {meeting.general_observations && (
          <Badge variant="outline" className="text-[10px]">
            <FileText className="w-3 h-3 mr-1" />
            Obs.
          </Badge>
        )}
      </div>

      {/* Desafios */}
      {meeting.main_challenges?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Desafios:</p>
          <div className="flex flex-wrap gap-1">
            {meeting.main_challenges.slice(0, 3).map((challenge, idx) => (
              <span key={idx} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {challenge.length > 25 ? challenge.slice(0, 25) + '...' : challenge}
              </span>
            ))}
            {meeting.main_challenges.length > 3 && (
              <span className="text-[10px] text-primary">+{meeting.main_challenges.length - 3}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingOneOnOneSection() {
  const { meetings, isLoading, archiveMeeting, unarchiveMeeting } = useMeetingsOneOnOne();
  const [showModal, setShowModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeMeetings = meetings.filter(m => !m.archived);
  const archivedMeetings = meetings.filter(m => m.archived);
  const displayMeetings = showArchived ? archivedMeetings : activeMeetings.slice(0, 10);

  const handleArchive = (id: string) => archiveMeeting.mutate(id);
  const handleUnarchive = (id: string) => unarchiveMeeting.mutate(id);

  return (
    <div className="space-y-4">
      {/* Botão de Nova Reunião */}
      <Button
        onClick={() => setShowModal(true)}
        className="w-full"
        variant="outline"
      >
        <Plus className="w-4 h-4 mr-2" />
        Registrar Reunião 1 a 1
      </Button>

      {/* Toggle Arquivados */}
      {archivedMeetings.length > 0 && (
        <Button
          onClick={() => setShowArchived(!showArchived)}
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8"
        >
          {showArchived ? (
            <>
              <EyeOff className="w-3.5 h-3.5 mr-1.5" />
              Ocultar arquivados ({archivedMeetings.length})
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Ver arquivados ({archivedMeetings.length})
            </>
          )}
        </Button>
      )}

      {/* Título da seção */}
      {showArchived && (
        <div className="flex items-center gap-2 px-1">
          <Archive className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase">Reuniões Arquivadas</span>
        </div>
      )}

      {/* Lista de Reuniões */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Carregando...</p>
          </div>
        ) : displayMeetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="mx-auto mb-2 opacity-50" size={32} />
            <p className="font-medium text-sm">
              {showArchived ? 'Nenhuma reunião arquivada' : 'Nenhuma reunião registrada'}
            </p>
            {!showArchived && (
              <p className="text-xs mt-1">Clique acima para registrar uma reunião</p>
            )}
          </div>
        ) : (
          displayMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              isArchived={showArchived}
            />
          ))
        )}
      </div>

      {/* Modal */}
      <MeetingOneOnOneModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}
