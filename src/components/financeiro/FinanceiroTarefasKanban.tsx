import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  position: number;
  created_by: string | null;
  created_at: string;
}

const COLUMNS = [
  { id: 'todo', title: 'A Fazer', icon: ListTodo, color: 'bg-blue-500', textColor: 'text-blue-600' },
  { id: 'doing', title: 'Fazendo', icon: Clock, color: 'bg-yellow-500', textColor: 'text-yellow-600' },
  { id: 'done', title: 'Feitas', icon: CheckCircle2, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
];

export default function FinanceiroTarefasKanban() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; task?: KanbanTask }>({ open: false });
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['financeiro-kanban-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_kanban_tasks')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as KanbanTask[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (title: string) => {
      const maxPos = tasks.filter(t => t.status === 'todo').reduce((max, t) => Math.max(max, t.position), -1);
      const { error } = await supabase
        .from('financeiro_kanban_tasks')
        .insert({ title, status: 'todo', position: maxPos + 1, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-kanban-tasks'] });
      setNewTaskTitle('');
      setIsAdding(false);
      toast.success('Tarefa criada');
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string | null; status?: string }) => {
      const { error } = await supabase
        .from('financeiro_kanban_tasks')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-kanban-tasks'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financeiro_kanban_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-kanban-tasks'] });
      toast.success('Tarefa excluída');
    },
  });

  const handleCreateTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    createTask.mutate(trimmed);
  };

  const handleEditSave = () => {
    if (!editModal.task) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      toast.error('Título é obrigatório');
      return;
    }
    updateTask.mutate({
      id: editModal.task.id,
      title: trimmed,
      description: editDescription.trim() || null,
    });
    setEditModal({ open: false });
    toast.success('Tarefa atualizada');
  };

  const openEdit = (task: KanbanTask) => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditModal({ open: true, task });
  };

  const moveTask = (task: KanbanTask, direction: 'next' | 'prev') => {
    const colIndex = COLUMNS.findIndex(c => c.id === task.status);
    const newIndex = direction === 'next' ? colIndex + 1 : colIndex - 1;
    if (newIndex < 0 || newIndex >= COLUMNS.length) return;
    updateTask.mutate({ id: task.id, status: COLUMNS[newIndex].id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        {COLUMNS.map((column, colIdx) => {
          const columnTasks = tasks.filter(t => t.status === column.id);
          const Icon = column.icon;

          return (
            <div key={column.id} className="flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
              {/* Column Header */}
              <div className={cn("px-4 py-3 flex items-center justify-between", column.color)}>
                <div className="flex items-center gap-2 text-white">
                  <Icon size={16} />
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                  {columnTasks.length}
                </Badge>
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {/* Add task (only in "A Fazer") */}
                {column.id === 'todo' && (
                  <div className="mb-2">
                    {isAdding ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Título da tarefa..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateTask();
                            if (e.key === 'Escape') { setIsAdding(false); setNewTaskTitle(''); }
                          }}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreateTask} disabled={createTask.isPending}>
                            Criar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsAdding(false); setNewTaskTitle(''); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs border-dashed gap-1"
                        onClick={() => setIsAdding(true)}
                      >
                        <Plus size={14} />
                        Nova tarefa
                      </Button>
                    )}
                  </div>
                )}

                {columnTasks.length === 0 && !isAdding && (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</p>
                )}

                {columnTasks.map((task) => (
                  <Card key={task.id} className="border-subtle hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-2">
                            {format(new Date(task.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                        <div className="flex gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(task)}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm('Excluir esta tarefa?')) deleteTask.mutate(task.id);
                            }}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                        <div className="flex gap-0.5">
                          {colIdx > 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => moveTask(task, 'prev')}
                              title={`Mover para ${COLUMNS[colIdx - 1].title}`}
                            >
                              <ArrowLeft size={12} />
                            </Button>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => moveTask(task, 'next')}
                              title={`Mover para ${COLUMNS[colIdx + 1].title}`}
                            >
                              <ArrowRight size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      <Dialog open={editModal.open} onOpenChange={(open) => { if (!open) setEditModal({ open: false }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Input
                placeholder="Título *"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Textarea
                placeholder="Descrição (opcional)"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal({ open: false })}>Cancelar</Button>
            <Button onClick={handleEditSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
