import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useRecordedMeetings, MeetingFolder, RecordedMeeting } from '@/hooks/useRecordedMeetings';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateMeetingModal from '@/components/recorded-meetings/CreateMeetingModal';
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

export default function RecordedMeetingsPage() {
  const {
    folders,
    meetings,
    isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    deleteMeeting,
  } = useRecordedMeetings();

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

  const filteredMeetings = folderMeetings.filter(
    (m) =>
      m.ata?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.participants?.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getMeetingCount = (folderId: string) =>
    meetings.filter((m) => m.folder_id === folderId).length;

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
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Vídeo da Reunião</p>
                            {meeting.video_url.includes('supabase') || meeting.video_url.endsWith('.mp4') || meeting.video_url.endsWith('.webm') ? (
                              <video
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

                          {/* Ata */}
                          {meeting.ata && (
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
