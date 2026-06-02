import { useRef, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useRecordedMeetings, MeetingFolder, RecordedMeeting, TranscriptData } from '@/hooks/useRecordedMeetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  FolderPlus,
  Plus,
  Search,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Users,
  FileText,
  AlignLeft,
  Trash2,
  Pencil,
  MoreVertical,
  Monitor,
  Clock,
  Building2,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateMeetingModal from '@/components/recorded-meetings/CreateMeetingModal';
import MeetingAtaSection from '@/components/recorded-meetings/MeetingAtaSection';
import { downloadStorageFile } from '@/lib/storageUpload';
import { toast } from 'sonner';
import { useAllActiveClients } from '@/hooks/useAllActiveClients';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SPEAKER_COLORS_CLASS = [
  'text-blue-400',
  'text-emerald-400',
  'text-amber-400',
  'text-purple-400',
  'text-rose-400',
  'text-cyan-400',
  'text-orange-400',
  'text-pink-400',
];

export default function RecordedMeetingsPage() {
  const {
    folders,
    meetings,
    isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    deleteMeeting,
    retryTranscript,
    retryAta,
  } = useRecordedMeetings();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play().catch(() => {});
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const { data: clients = [] } = useAllActiveClients();
  const clientNameMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  const [selectedFolder, setSelectedFolder] = useState<MeetingFolder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<MeetingFolder | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState<RecordedMeeting | null>(null);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  const folderMeetings = selectedFolder
    ? meetings.filter((m) => m.folder_id === selectedFolder.id)
    : [];

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMeetings = searchTerm.trim()
    ? folderMeetings.filter(
        (m) =>
          m.ata?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.video_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.participants?.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : folderMeetings;

  const getMeetingCount = (folderId: string) =>
    meetings.filter((m) => m.folder_id === folderId).length;

  const SPEAKER_COLORS_HEX = [
    '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
    '#fb7185', '#22d3ee', '#fb923c', '#f472b6',
  ];

  const handleDownloadTranscript = (meeting: RecordedMeeting) => {
    const transcript = meeting.transcript;
    if (!transcript?.text) return;

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const clientName = meeting.client_id ? clientNameMap[meeting.client_id] || '' : '';
    const dateStr = format(new Date(meeting.meeting_date + 'T12:00:00'), "dd-MM-yyyy");
    const safeName = clientName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 _-]/g, '');
    const fileName = `Transcricao${safeName ? `_${safeName}` : ''}_${dateStr}.doc`;

    const dateFormatted = format(new Date(meeting.meeting_date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const meta = `${esc(dateFormatted)}${clientName ? ` — ${esc(clientName)}` : ''}${meeting.duration_seconds ? ` — ${Math.floor(meeting.duration_seconds / 60)}min ${meeting.duration_seconds % 60}s` : ''}`;

    let bodyContent: string;

    if (transcript.has_diarization && transcript.segments && transcript.segments.length > 0) {
      bodyContent = transcript.segments
        .map((seg) => {
          const color = SPEAKER_COLORS_HEX[seg.speaker % SPEAKER_COLORS_HEX.length];
          return `<p><b style="color:${color}">Voz ${seg.speaker + 1}:</b> ${esc(seg.text)}</p>`;
        })
        .join('\n');
    } else {
      bodyContent = transcript.text.split('\n').map(p => `<p>${esc(p)}</p>`).join('\n');
    }

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Transcrição</title></head>
<body style="font-family:Calibri,sans-serif;font-size:12pt;line-height:1.6">
<h1 style="font-size:16pt;margin-bottom:4pt">Transcrição da Reunião</h1>
<p style="color:#666;font-size:10pt;margin-bottom:16pt">${meta}</p>
<hr style="border:none;border-top:1px solid #ddd;margin-bottom:16pt">
${bodyContent}
</body></html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadVideo = async (meeting: RecordedMeeting) => {
    const path = meeting.video_url.split('/recorded-meetings/')[1];
    if (!path) {
      toast.error('Não foi possível identificar o arquivo de vídeo');
      return;
    }
    try {
      await downloadStorageFile(
        'recorded-meetings',
        decodeURIComponent(path),
        meeting.video_filename || 'video.webm',
      );
    } catch (err) {
      toast.error(
        'Erro ao baixar vídeo',
        { description: err instanceof Error ? err.message : 'Tente novamente' },
      );
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder.mutate(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolderInput(false);
    }
  };

  const handleRenameFolder = (id: string) => {
    if (renameValue.trim()) {
      renameFolder.mutate({ id, name: renameValue.trim() });
      setRenamingFolder(null);
      setRenameValue('');
    }
  };

  const handleDeleteFolder = () => {
    if (deletingFolder) {
      deleteFolder.mutate(deletingFolder.id);
      if (selectedFolder?.id === deletingFolder.id) {
        setSelectedFolder(null);
      }
      setDeletingFolder(null);
    }
  };

  const handleDeleteMeeting = () => {
    if (deletingMeeting) {
      deleteMeeting.mutate(deletingMeeting);
      setDeletingMeeting(null);
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <div className="flex items-center gap-3">
            {selectedFolder && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  setSelectedFolder(null);
                  setSearchTerm('');
                }}
              >
                <ArrowLeft size={18} />
              </Button>
            )}
            <div>
              <h1 className="text-display text-foreground">
                {selectedFolder ? selectedFolder.name : 'Reuniões Gravadas'}
              </h1>
              <p className="text-caption text-muted-foreground mt-1">
                {selectedFolder
                  ? `${folderMeetings.length} reunião(ões) nesta pasta`
                  : 'Organize e consulte as gravações das reuniões da equipe'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="px-8 py-4 border-b border-subtle flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder={selectedFolder ? 'Buscar reuniões...' : 'Buscar pastas...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedFolder ? (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} className="mr-2" />
              Nova Reunião
            </Button>
          ) : (
            <Button onClick={() => setShowNewFolderInput(true)}>
              <FolderPlus size={16} className="mr-2" />
              Nova Pasta
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : !selectedFolder ? (
            /* ===== FOLDER LIST ===== */
            <div className="space-y-3">
              {/* New Folder Input */}
              {showNewFolderInput && (
                <div className="flex items-center gap-2 p-4 rounded-xl border border-primary/30 bg-card">
                  <FolderPlus size={20} className="text-primary shrink-0" />
                  <Input
                    autoFocus
                    placeholder="Nome da pasta..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                      }
                    }}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                    Criar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}

              {filteredFolders.length === 0 && !showNewFolderInput ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Video className="mx-auto mb-3 opacity-40" size={48} />
                  <p className="font-medium">Nenhuma pasta de reunião criada</p>
                  <p className="text-sm mt-1">Crie uma pasta para começar a organizar suas reuniões gravadas</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFolders.map((folder) => {
                    const count = getMeetingCount(folder.id);
                    return (
                      <div
                        key={folder.id}
                        className="group relative p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => {
                          if (renamingFolder !== folder.id) {
                            setSelectedFolder(folder);
                            setSearchTerm('');
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Video size={20} className="text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              {renamingFolder === folder.id ? (
                                <Input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') handleRenameFolder(folder.id);
                                    if (e.key === 'Escape') setRenamingFolder(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 text-sm"
                                />
                              ) : (
                                <p className="font-medium text-sm truncate">{folder.name}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {count} reunião(ões)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingFolder(folder.id);
                                    setRenameValue(folder.name);
                                  }}
                                >
                                  <Pencil size={14} className="mr-2" />
                                  Renomear
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingFolder(folder);
                                  }}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <ChevronRight size={16} className="text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ===== MEETING LIST ===== */
            <div className="space-y-3">
              {filteredMeetings.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Video className="mx-auto mb-3 opacity-40" size={48} />
                  <p className="font-medium">Nenhuma reunião nesta pasta</p>
                  <p className="text-sm mt-1">Clique em "Nova Reunião" para cadastrar</p>
                </div>
              ) : (
                filteredMeetings.map((meeting) => {
                  const isExpanded = expandedMeeting === meeting.id;
                  return (
                    <div
                      key={meeting.id}
                      className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 transition-colors"
                    >
                      {/* Meeting Header */}
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer"
                        onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Video size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <Calendar size={12} className="mr-1" />
                              {format(new Date(meeting.meeting_date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Users size={12} className="mr-1" />
                              {meeting.is_whole_team
                                ? 'Time todo'
                                : `${meeting.participants?.length || 0} participante(s)`}
                            </Badge>
                            {meeting.ata && (
                              <Badge variant="outline" className="text-xs">
                                <FileText size={12} className="mr-1" />
                                Ata
                              </Badge>
                            )}
                            {meeting.summary && (
                              <Badge variant="outline" className="text-xs">
                                <AlignLeft size={12} className="mr-1" />
                                Resumo
                              </Badge>
                            )}
                            {meeting.recorded_in_browser && (
                              <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600">
                                <Monitor size={12} className="mr-1" />
                                Gravado no sistema
                              </Badge>
                            )}
                            {meeting.duration_seconds != null && meeting.duration_seconds > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Clock size={12} className="mr-1" />
                                {Math.floor(meeting.duration_seconds / 60)}min {meeting.duration_seconds % 60}s
                              </Badge>
                            )}
                            {meeting.client_id && clientNameMap[meeting.client_id] && (
                              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600">
                                <Building2 size={12} className="mr-1" />
                                {clientNameMap[meeting.client_id]}
                              </Badge>
                            )}
                            {meeting.transcript_status === 'processing' && (
                              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 animate-pulse">
                                <Loader2 size={12} className="mr-1 animate-spin" />
                                Transcrevendo...
                              </Badge>
                            )}
                            {meeting.transcript_status === 'completed' && (
                              <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                                <FileText size={12} className="mr-1" />
                                Transcrição pronta
                              </Badge>
                            )}
                            {meeting.transcript_status === 'failed' && (
                              <Badge variant="outline" className="text-xs border-red-500/30 text-red-600">
                                <AlertCircle size={12} className="mr-1" />
                                Erro na transcrição
                              </Badge>
                            )}
                          </div>
                          {!meeting.is_whole_team && meeting.participants?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {meeting.participants.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingMeeting(meeting);
                                }}
                              >
                                <Trash2 size={14} className="mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <ChevronRight
                            size={16}
                            className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/30">
                          {/* Video */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase">Vídeo da Reunião</p>
                              {meeting.video_url.includes('/recorded-meetings/') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadVideo(meeting);
                                  }}
                                >
                                  <Download size={12} />
                                  Baixar vídeo
                                </Button>
                              )}
                            </div>
                            {meeting.video_url.includes('supabase') || meeting.video_url.endsWith('.mp4') || meeting.video_url.endsWith('.webm') ? (
                              <video
                                ref={videoRef}
                                src={meeting.video_url}
                                controls
                                className="w-full max-w-2xl rounded-lg border border-border"
                                preload="metadata"
                              />
                            ) : (
                              <a
                                href={meeting.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-primary"
                              >
                                <Video size={18} />
                                Abrir vídeo da reunião
                              </a>
                            )}
                            {meeting.video_filename && (
                              <p className="text-xs text-muted-foreground mt-1">{meeting.video_filename}</p>
                            )}
                          </div>

                          {/* Transcript */}
                          {meeting.transcript_status === 'completed' && meeting.transcript && (() => {
                            const transcript = meeting.transcript;
                            const hasSpeakers = transcript.has_diarization && transcript.segments && transcript.segments.length > 0;
                            return (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase">Transcrição</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadTranscript(meeting);
                                    }}
                                  >
                                    <Download size={12} />
                                    Baixar .doc
                                  </Button>
                                </div>
                                {hasSpeakers ? (
                                  <div className="space-y-2 bg-card p-3 rounded-lg border border-border max-h-96 overflow-y-auto">
                                    {transcript.segments!.map((seg, i) => (
                                      <div key={i} className="text-sm">
                                        <span className={`font-semibold ${SPEAKER_COLORS_CLASS[seg.speaker % SPEAKER_COLORS_CLASS.length]}`}>
                                          Voz {seg.speaker + 1}:
                                        </span>{' '}
                                        <span className="text-foreground">{seg.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm whitespace-pre-wrap bg-card p-3 rounded-lg border border-border max-h-96 overflow-y-auto">
                                    {transcript.text || 'Transcrição vazia'}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {meeting.transcript_status === 'failed' && meeting.transcript_error && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Erro na Transcrição</p>
                              <p className="text-sm text-red-500 bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                                {meeting.transcript_error}
                              </p>
                            </div>
                          )}

                          {/* Ata estruturada + status + retry (issue #72) */}
                          <MeetingAtaSection
                            ataJson={meeting.ata_json}
                            transcriptStatus={meeting.transcript_status}
                            ataStatus={meeting.ata_status}
                            onSeek={handleSeek}
                            onRetryTranscript={() => retryTranscript.mutate(meeting.id)}
                            onRetryAta={() => retryAta.mutate(meeting.id)}
                          />
                          {meeting.ata_status === 'failed' && meeting.ata_error && (
                            <p className="text-sm text-red-500 bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                              {meeting.ata_error}
                            </p>
                          )}

                          {/* Participants */}
                          {(meeting.is_whole_team || (meeting.participants?.length > 0)) && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Participantes</p>
                              {meeting.is_whole_team ? (
                                <Badge className="bg-primary/10 text-primary">Time todo</Badge>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {meeting.participants.map((p, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ata legada (markdown) — só quando não há ata estruturada */}
                          {meeting.ata && !meeting.ata_json && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Ata</p>
                              <p className="text-sm whitespace-pre-wrap bg-card p-3 rounded-lg border border-border">
                                {meeting.ata}
                              </p>
                            </div>
                          )}

                          {/* Summary */}
                          {meeting.summary && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Resumo</p>
                              <p className="text-sm whitespace-pre-wrap bg-card p-3 rounded-lg border border-border">
                                {meeting.summary}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Meeting Modal */}
      {selectedFolder && (
        <CreateMeetingModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          folderId={selectedFolder.id}
        />
      )}

      {/* Delete Folder Confirmation */}
      <AlertDialog open={!!deletingFolder} onOpenChange={() => setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as reuniões dentro da pasta "{deletingFolder?.name}" serão excluídas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Meeting Confirmation */}
      <AlertDialog open={!!deletingMeeting} onOpenChange={() => setDeletingMeeting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              A reunião e seu vídeo serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeeting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
