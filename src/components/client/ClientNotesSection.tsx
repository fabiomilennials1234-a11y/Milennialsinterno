import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  StickyNote, 
  MessageSquare, 
  Send, 
  Pencil, 
  Trash2, 
  Check, 
  X,
  Loader2,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useClientNotes, 
  useAddClientNote, 
  useUpdateClientNote, 
  useDeleteClientNote,
  useCanAddNotes,
  useCanAddComments,
  ClientNote
} from '@/hooks/useClientNotes';

interface ClientNotesProps {
  clientId: string;
}

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO',
  gestor_ads: 'Gestor de Tráfego',
  consultor_comercial: 'Consultor Comercial',
  sucesso_cliente: 'Sucesso do Cliente',
  gestor_projetos: 'Gestor de Projetos',
  financeiro: 'Financeiro',
};

export default function ClientNotesSection({ clientId }: ClientNotesProps) {
  const { user } = useAuth();
  const { data: notes = [], isLoading } = useClientNotes(clientId);
  const { data: canAddNotes } = useCanAddNotes(clientId);
  const { data: canAddComments } = useCanAddComments(clientId);
  const addNote = useAddClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  const [newNoteContent, setNewNoteContent] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Separar notas e comentários
  const adsNotes = notes.filter(n => n.note_type === 'note');
  const comments = notes.filter(n => n.note_type === 'comment');

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    await addNote.mutateAsync({
      clientId,
      content: newNoteContent.trim(),
      noteType: 'note',
    });
    setNewNoteContent('');
  };

  const handleAddComment = async () => {
    if (!newCommentContent.trim()) return;
    await addNote.mutateAsync({
      clientId,
      content: newCommentContent.trim(),
      noteType: 'comment',
    });
    setNewCommentContent('');
  };

  const handleStartEdit = (note: ClientNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editingContent.trim()) return;
    await updateNote.mutateAsync({
      noteId: editingNoteId,
      content: editingContent.trim(),
      clientId,
    });
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleDelete = async (noteId: string) => {
    await deleteNote.mutateAsync({ noteId, clientId });
  };

  const NoteItem = ({ note, showActions }: { note: ClientNote; showActions: boolean }) => {
    const isEditing = editingNoteId === note.id;
    const isOwnNote = note.created_by === user?.id;
    const canEdit = showActions && isOwnNote && note.note_type === 'note';
    const canDelete = showActions && isOwnNote && note.note_type === 'note';

    return (
      <div className={cn(
        "p-3 rounded-lg border",
        note.note_type === 'note' 
          ? "bg-primary/5 border-primary/20" 
          : "bg-muted/50 border-muted"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              note.note_type === 'note' ? "bg-primary/10" : "bg-muted"
            )}>
              {note.note_type === 'note' ? (
                <StickyNote size={12} className="text-primary" />
              ) : (
                <MessageSquare size={12} className="text-muted-foreground" />
              )}
            </div>
            <span className="font-medium text-foreground">{note.author_name}</span>
            {note.author_role && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                note.note_type === 'note' 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {ROLE_LABELS[note.author_role] || note.author_role}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {format(new Date(note.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateNote.isPending}
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
                <X size={12} />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
              {note.content}
            </p>
            {(canEdit || canDelete) && (
              <div className="flex gap-1 mt-2">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleStartEdit(note)}
                  >
                    <Pencil size={10} className="mr-1" />
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-danger hover:text-danger"
                    onClick={() => handleDelete(note.id)}
                    disabled={deleteNote.isPending}
                  >
                    <Trash2 size={10} className="mr-1" />
                    Excluir
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Anotações do Gestor de Tráfego */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">
            Anotações do Gestor de Tráfego
          </h4>
          <span className="text-xs text-muted-foreground">
            ({adsNotes.length})
          </span>
        </div>

        {/* Input para nova nota - apenas para gestor de tráfego */}
        {canAddNotes && (
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione uma anotação sobre o cliente..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNoteContent.trim() || addNote.isPending}
              className="gap-1"
            >
              {addNote.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Adicionar Anotação
            </Button>
          </div>
        )}

        {/* Lista de anotações */}
        {adsNotes.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <StickyNote className="mx-auto mb-2 opacity-50" size={24} />
            <p>Nenhuma anotação do gestor</p>
          </div>
        ) : (
          <div className="space-y-2">
            {adsNotes.map(note => (
              <NoteItem key={note.id} note={note} showActions={!!canAddNotes} />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Comentários do Consultor Comercial */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-bold text-foreground">
            Comentários do Comercial
          </h4>
          <span className="text-xs text-muted-foreground">
            ({comments.length})
          </span>
        </div>

        {/* Input para novo comentário - apenas para consultor comercial */}
        {canAddComments && (
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione um comentário..."
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddComment}
              disabled={!newCommentContent.trim() || addNote.isPending}
              className="gap-1"
            >
              {addNote.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MessageSquare size={14} />
              )}
              Comentar
            </Button>
          </div>
        )}

        {/* Lista de comentários */}
        {comments.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <MessageSquare className="mx-auto mb-2 opacity-50" size={24} />
            <p>Nenhum comentário ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map(note => (
              <NoteItem key={note.id} note={note} showActions={!!canAddComments} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
