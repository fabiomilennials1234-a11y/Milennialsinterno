import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Training, 
  useTrainingLessons, 
  useAddLesson, 
  useDeleteLesson,
  useDeleteTraining,
  ROLE_OPTIONS,
  WEEKDAY_OPTIONS 
} from '@/hooks/useTrainings';
import { 
  GraduationCap, 
  Clock, 
  Calendar, 
  Users, 
  Repeat, 
  Plus, 
  ExternalLink, 
  Trash2,
  PlayCircle,
  Edit,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface TrainingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: Training;
  onEdit: () => void;
}

export default function TrainingDetailModal({
  open,
  onOpenChange,
  training,
  onEdit,
}: TrainingDetailModalProps) {
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonUrl, setNewLessonUrl] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: lessons = [], isLoading: lessonsLoading } = useTrainingLessons(training.id);
  const addLesson = useAddLesson();
  const deleteLesson = useDeleteLesson();
  const deleteTraining = useDeleteTraining();

  const handleAddLesson = async () => {
    if (!newLessonTitle.trim()) return;

    await addLesson.mutateAsync({
      training_id: training.id,
      title: newLessonTitle.trim(),
      lesson_url: newLessonUrl.trim() || undefined,
      order_index: lessons.length + 1,
    });

    setNewLessonTitle('');
    setNewLessonUrl('');
    setShowAddLesson(false);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    await deleteLesson.mutateAsync({ id: lessonId, training_id: training.id });
  };

  const handleDeleteTraining = async () => {
    await deleteTraining.mutateAsync(training.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const getRoleLabel = (roleValue: string) => {
    return ROLE_OPTIONS.find((r) => r.value === roleValue)?.label || roleValue;
  };

  const getDayLabel = (dayValue: string) => {
    return WEEKDAY_OPTIONS.find((d) => d.value === dayValue)?.label || dayValue;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{training.title}</DialogTitle>
                  {training.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {training.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Info Cards */}
              <div className="grid grid-cols-3 gap-4">
                {/* Horário */}
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Horário</span>
                  </div>
                  <p className="font-semibold">
                    {training.class_time || 'Não definido'}
                  </p>
                </div>

                {/* Data/Recorrência */}
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    {training.is_recurring ? (
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                      {training.is_recurring ? 'Recorrência' : 'Data'}
                    </span>
                  </div>
                  {training.is_recurring ? (
                    <div className="flex flex-wrap gap-1">
                      {training.recurrence_days?.map((day) => (
                        <Badge key={day} variant="secondary" className="text-xs">
                          {getDayLabel(day).slice(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold">
                      {training.class_date
                        ? format(new Date(training.class_date), "dd 'de' MMMM", { locale: ptBR })
                        : 'Não definida'}
                    </p>
                  )}
                </div>

                {/* Participantes */}
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Participantes</span>
                  </div>
                  {training.allowed_roles && training.allowed_roles.length > 0 ? (
                    <p className="text-sm font-medium">
                      {training.allowed_roles.length} cargo(s)
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-success">Todos</p>
                  )}
                </div>
              </div>

              {/* Cargos Permitidos */}
              {training.allowed_roles && training.allowed_roles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cargos que podem participar:</Label>
                  <div className="flex flex-wrap gap-2">
                    {training.allowed_roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {getRoleLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Aulas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Aulas ({lessons.length})
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddLesson(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Aula
                  </Button>
                </div>

                {showAddLesson && (
                  <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                    <Input
                      placeholder="Título da aula"
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                    />
                    <Input
                      placeholder="Link da aula (opcional)"
                      value={newLessonUrl}
                      onChange={(e) => setNewLessonUrl(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowAddLesson(false)}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleAddLesson}
                        disabled={!newLessonTitle.trim() || addLesson.isPending}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                )}

                {lessonsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando aulas...
                  </div>
                ) : lessons.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-xl border-dashed">
                    <PlayCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma aula cadastrada</p>
                    <p className="text-sm">Clique em "Adicionar Aula" para começar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lesson.title}</p>
                          {lesson.lesson_url && (
                            <a
                              href={lesson.lesson_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Acessar aula
                            </a>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteLesson(lesson.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Treinamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O treinamento "{training.title}" e todas as suas aulas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTraining}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
