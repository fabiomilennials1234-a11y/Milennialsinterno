import { useState, useRef } from 'react';
import { useRecordedMeetings } from '@/hooks/useRecordedMeetings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Video, Loader2, Link } from 'lucide-react';
import { toast } from 'sonner';

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
}

type VideoMode = 'link' | 'upload';

export default function CreateMeetingModal({ open, onOpenChange, folderId }: CreateMeetingModalProps) {
  const { createMeeting, uploadVideo } = useRecordedMeetings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoMode, setVideoMode] = useState<VideoMode>('link');
  const [videoLink, setVideoLink] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [isWholeTeam, setIsWholeTeam] = useState(false);
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [ata, setAta] = useState('');
  const [summary, setSummary] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setVideoMode('link');
    setVideoLink('');
    setVideoFile(null);
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setIsWholeTeam(false);
    setParticipantInput('');
    setParticipants([]);
    setAta('');
    setSummary('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = (value: boolean) => {
    if (!isUploading) {
      onOpenChange(value);
      if (!value) resetForm();
    }
  };

  const addParticipant = () => {
    const name = participantInput.trim();
    if (name && !participants.includes(name)) {
      setParticipants([...participants, name]);
      setParticipantInput('');
    }
  };

  const removeParticipant = (name: string) => {
    setParticipants(participants.filter((p) => p !== name));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error('Selecione um arquivo de vídeo');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo maior que 50MB. Use a opção "Colar link" para vídeos grandes.');
        return;
      }
      setVideoFile(file);
    }
  };

  const hasVideo = videoMode === 'link' ? videoLink.trim().length > 0 : !!videoFile;

  const handleSubmit = async () => {
    if (!hasVideo) {
      toast.error('O vídeo da reunião é obrigatório');
      return;
    }

    setIsUploading(true);
    try {
      let finalUrl: string;
      let finalFilename: string | null;

      if (videoMode === 'link') {
        finalUrl = videoLink.trim();
        finalFilename = null;
      } else {
        const { url, filename } = await uploadVideo(videoFile!);
        finalUrl = url;
        finalFilename = filename;
      }

      await createMeeting.mutateAsync({
        folder_id: folderId,
        video_url: finalUrl,
        video_filename: finalFilename,
        ata: ata.trim() || null,
        summary: summary.trim() || null,
        meeting_date: meetingDate,
        participants: isWholeTeam ? [] : participants,
        is_whole_team: isWholeTeam,
      });

      handleClose(false);
    } catch (error: any) {
      toast.error('Erro ao salvar reunião: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Reunião Gravada</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Video - Obrigatório */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Vídeo da Reunião <span className="text-destructive">*</span>
            </Label>

            {/* Toggle link/upload */}
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              <button
                type="button"
                onClick={() => { setVideoMode('link'); setVideoFile(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  videoMode === 'link'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link size={14} />
                Colar link
              </button>
              <button
                type="button"
                onClick={() => { setVideoMode('upload'); setVideoLink(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  videoMode === 'upload'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload size={14} />
                Upload (até 50MB)
              </button>
            </div>

            {videoMode === 'link' ? (
              <Input
                placeholder="Cole o link do vídeo (Google Drive, YouTube, etc.)"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
              />
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
                {videoFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
                    <Video size={20} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{videoFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        setVideoFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-20 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Upload size={20} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para selecionar o vídeo (máx. 50MB)</span>
                    </div>
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data da Reunião</Label>
            <Input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>

          {/* Participantes */}
          <div className="space-y-2">
            <Label>Participantes</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="whole-team"
                checked={isWholeTeam}
                onCheckedChange={(checked) => setIsWholeTeam(checked === true)}
              />
              <label htmlFor="whole-team" className="text-sm cursor-pointer">
                Time todo
              </label>
            </div>

            {!isWholeTeam && (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do participante..."
                    value={participantInput}
                    onChange={(e) => setParticipantInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addParticipant();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addParticipant}
                    disabled={!participantInput.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
                {participants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {participants.map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs gap-1 pr-1">
                        {p}
                        <button
                          onClick={() => removeParticipant(p)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ata */}
          <div className="space-y-2">
            <Label>Ata da Reunião</Label>
            <Textarea
              placeholder="Registre os pontos discutidos, decisões tomadas..."
              value={ata}
              onChange={(e) => setAta(e.target.value)}
              rows={3}
            />
          </div>

          {/* Resumo */}
          <div className="space-y-2">
            <Label>Resumo da Reunião</Label>
            <Textarea
              placeholder="Resumo geral da reunião..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!hasVideo || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Salvar Reunião'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
