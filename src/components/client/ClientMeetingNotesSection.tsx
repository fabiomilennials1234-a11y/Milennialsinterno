import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useClientMeetingNotes,
  useCreateMeetingNote,
  useUpdateMeetingNote,
  useDeleteMeetingNote,
  type ClientMeetingNote,
} from '@/hooks/useClientMeetingNotes';

interface ClientMeetingNotesSectionProps {
  clientId: string;
}

export default function ClientMeetingNotesSection({ clientId }: ClientMeetingNotesSectionProps) {
  const { user, isCEO } = useAuth();
  const { data: notes = [], isLoading } = useClientMeetingNotes(clientId);
  const createNote = useCreateMeetingNote();
  const updateNote = useUpdateMeetingNote();
  const deleteNote = useDeleteMeetingNote();

  const [isOpen, setIsOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formContent, setFormContent] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editContent, setEditContent] = useState('');

  const resetForm = () => {
    setFormTitle('');
    setFormDate('');
    setFormContent('');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formDate || !formContent.trim()) return;
    await createNote.mutateAsync({
      clientId,
      title: formTitle.trim(),
      content: formContent.trim(),
      meetingDate: formDate,
    });
    resetForm();
  };

  const handleStartEdit = (note: ClientMeetingNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditDate(note.meeting_date);
    setEditContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDate('');
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editDate || !editContent.trim()) return;
    await updateNote.mutateAsync({
      noteId: editingId,
      clientId,
      title: editTitle.trim(),
      content: editContent.trim(),
      meetingDate: editDate,
    });
    handleCancelEdit();
  };

  const handleDelete = async (noteId: string) => {
    await deleteNote.mutateAsync({ noteId, clientId });
  };

  const canModify = (note: ClientMeetingNote) =>
    isCEO || note.created_by === user?.id;

  return (
    <div className="bg-gradient-to-r from-primary/5 to-info/5 rounded-xl p-5 border border-primary/20">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full text-left"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">
            Reuniões
          </h3>
          <p className="text-sm text-muted-foreground">
            Resumos de reuniões com o cliente ({notes.length})
          </p>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          {/* Add button */}
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Resumo
            </Button>
          )}

          {/* Create form */}
          {showForm && (
            <div className="p-4 rounded-lg border border-primary/30 bg-background space-y-3">
              <Input
                placeholder="Título / Assunto da reunião"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-9 text-sm w-48"
              />
              <Textarea
                placeholder="Resumo da reunião..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-[100px] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={
                    !formTitle.trim() ||
                    !formDate ||
                    !formContent.trim() ||
                    createNote.isPending
                  }
                  className="gap-1"
                >
                  {createNote.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetForm}
                >
                  <X size={14} className="mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && notes.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <CalendarDays className="mx-auto mb-2 opacity-50" size={24} />
              <p>Nenhum resumo de reunião</p>
            </div>
          )}

          {/* Notes list */}
          {!isLoading && notes.length > 0 && (
            <div className="space-y-2">
              {notes.map((note) => {
                const isEditing = editingId === note.id;

                if (isEditing) {
                  return (
                    <div
                      key={note.id}
                      className="p-4 rounded-lg border border-primary/30 bg-background space-y-3"
                    >
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="h-9 text-sm w-48"
                      />
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={
                            !editTitle.trim() ||
                            !editDate ||
                            !editContent.trim() ||
                            updateNote.isPending
                          }
                          className="gap-1"
                        >
                          {updateNote.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                        >
                          <X size={12} className="mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border bg-primary/5 border-primary/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {note.title}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {format(new Date(note.meeting_date + 'T12:00:00'), 'dd/MM/yy', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(note.created_at), "dd/MM/yy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-muted-foreground">
                        por {note.author_name}
                      </span>

                      {canModify(note) && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleStartEdit(note)}
                          >
                            <Pencil size={10} className="mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDelete(note.id)}
                            disabled={deleteNote.isPending}
                          >
                            <Trash2 size={10} className="mr-1" />
                            Excluir
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
