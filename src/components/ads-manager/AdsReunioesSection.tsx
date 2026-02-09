import { useState } from 'react';
import { useAdsMeetings, useUpdateMeeting } from '@/hooks/useAdsManager';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Plus, Video } from 'lucide-react';
import AdsCardDetailModal from './AdsCardDetailModal';
import AdsCardDescriptionPreview from './AdsCardDescriptionPreview';

interface Props {
  compact?: boolean;
}

export default function AdsReunioesSection({ compact }: Props) {
  const { data: meetings = [], isLoading } = useAdsMeetings();
  const updateMeeting = useUpdateMeeting();
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMeetingClick = (meeting: any) => {
    setSelectedMeeting(meeting);
    setIsModalOpen(true);
  };

  const handleSaveMeeting = async (data: { description?: string; title?: string }) => {
    if (selectedMeeting) {
      await updateMeeting.mutateAsync({ id: selectedMeeting.id, ...data });
      // Update local state to reflect the change immediately
      setSelectedMeeting((prev: any) => prev ? { ...prev, ...data } : null);
    }
  };

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
          <p className="empty-state-text">Agende sua primeira reunião</p>
        </div>
        
        <button className="w-full p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-info/10 rounded-xl flex items-center gap-2 transition-colors mt-4 border-2 border-dashed border-info/30 hover:border-info/50">
          <Plus size={14} className="text-info" />
          <span>Adicionar reunião</span>
        </button>
      </>
    );
  }

  const displayMeetings = compact ? meetings.slice(0, 3) : meetings;

  return (
    <>
      <div className="space-y-2">
        {displayMeetings.map(meeting => (
          <div
            key={meeting.id}
            onClick={() => handleMeetingClick(meeting)}
            className="kanban-card card-border-blue p-4 group"
          >
            <h4 className="text-sm font-medium text-foreground">{meeting.title}</h4>
            
            <AdsCardDescriptionPreview text={meeting.description} className="mt-2" />

            {meeting.meeting_date && (
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 bg-info/10 text-info px-2 py-0.5 rounded-full">
                  <Calendar size={12} />
                  {format(new Date(meeting.meeting_date), "dd MMM", { locale: ptBR })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={12} />
                  {format(new Date(meeting.meeting_date), "HH:mm")}
                </span>
              </div>
            )}
          </div>
        ))}

        {compact && meetings.length > 3 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            +{meetings.length - 3} mais reuniões
          </p>
        )}

        {/* Add Meeting Button */}
        <button className="w-full p-3 text-sm text-muted-foreground hover:text-info hover:bg-info/10 rounded-xl flex items-center gap-2 transition-colors border-2 border-dashed border-transparent hover:border-info/30">
          <Plus size={14} />
          <span>Adicionar reunião</span>
        </button>
      </div>

      {/* Card Detail Modal */}
      <AdsCardDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={selectedMeeting ? {
          id: selectedMeeting.id,
          title: selectedMeeting.title,
          description: selectedMeeting.description,
          createdAt: selectedMeeting.created_at,
        } : null}
        onSave={handleSaveMeeting}
        listName="Reuniões"
      />
    </>
  );
}
