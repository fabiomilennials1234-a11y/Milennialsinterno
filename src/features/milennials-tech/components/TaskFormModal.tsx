import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { taskFormSchema, type TaskFormValues } from '../schemas/task';
import { useCreateTechTask, useUpdateTechTask } from '../hooks/useTechTasks';
import { TYPE_LABEL, PRIORITY_LABEL } from '../lib/statusLabels';
import type { TechTask, TechTaskType, TechTaskPriority, ChecklistItem } from '../types';

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TechTask;
}

const TYPE_OPTIONS = Object.entries(TYPE_LABEL) as [TechTaskType, string][];
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL) as [TechTaskPriority, string][];

export function TaskFormModal({ open, onOpenChange, task }: TaskFormModalProps) {
  const { user } = useAuth();
  const isEdit = !!task;

  const createTask = useCreateTechTask();
  const updateTask = useUpdateTechTask();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: null,
      type: 'FEATURE',
      priority: 'MEDIUM',
      sprint_id: null,
      assignee_id: null,
      deadline: null,
      estimated_hours: null,
      acceptance_criteria: null,
      technical_context: null,
      git_branch: null,
      checklist: [],
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? null,
        type: task.type,
        priority: task.priority,
        sprint_id: task.sprint_id ?? null,
        assignee_id: task.assignee_id ?? null,
        deadline: task.deadline ?? null,
        estimated_hours: task.estimated_hours ?? null,
        acceptance_criteria: task.acceptance_criteria ?? null,
        technical_context: task.technical_context ?? null,
        git_branch: task.git_branch ?? null,
        checklist: (task.checklist as ChecklistItem[] | null) ?? [],
      });
    } else {
      form.reset();
    }
  }, [task, form]);

  const onSubmit = (values: TaskFormValues) => {
    if (isEdit && task) {
      updateTask.mutate(
        { id: task.id, patch: values },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      if (!user?.id) return;
      createTask.mutate(
        {
          ...values,
          created_by: user.id,
          checklist: values.checklist as unknown as undefined,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  const isPending = createTask.isPending || updateTask.isPending;

  // Style tokens for dark inputs
  const inputCls =
    'bg-[var(--mtech-surface-elev)] border-[var(--mtech-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-accent)] focus-visible:ring-1 focus-visible:ring-offset-0';
  const labelCls = 'text-xs font-medium text-[var(--mtech-text-muted)]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-w-2xl border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-[var(--mtech-text)]">
            {isEdit ? 'Editar Task' : 'Nova Task'}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            {isEdit ? 'Atualize os campos abaixo.' : 'Preencha as informações da nova task.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className={labelCls}>Título</Label>
            <Input
              id="title"
              placeholder="Título da task"
              className={inputCls}
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-[var(--mtech-danger)]">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={labelCls}>Tipo</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => form.setValue('type', v as TechTaskType)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border-[var(--mtech-border)] text-[var(--mtech-text)]">
                  {TYPE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Prioridade</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v as TechTaskPriority)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border-[var(--mtech-border)] text-[var(--mtech-text)]">
                  {PRIORITY_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className={labelCls}>Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descrição da task..."
              rows={3}
              className={inputCls}
              {...form.register('description')}
            />
          </div>

          {/* Assignee + Sprint row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="assignee_id" className={labelCls}>Responsável</Label>
              <Input
                id="assignee_id"
                placeholder="UUID do responsável"
                className={inputCls}
                {...form.register('assignee_id')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint_id" className={labelCls}>Sprint</Label>
              <Input
                id="sprint_id"
                placeholder="UUID do sprint"
                className={inputCls}
                {...form.register('sprint_id')}
              />
            </div>
          </div>

          {/* Deadline + Estimated hours */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deadline" className={labelCls}>Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                className={inputCls}
                {...form.register('deadline')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimated_hours" className={labelCls}>Horas estimadas</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="Ex: 4"
                className={inputCls}
                {...form.register('estimated_hours', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Acceptance criteria */}
          <div className="space-y-1.5">
            <Label htmlFor="acceptance_criteria" className={labelCls}>Critérios de aceite</Label>
            <Textarea
              id="acceptance_criteria"
              placeholder="Critérios para aceitar a task como pronta..."
              rows={2}
              className={inputCls}
              {...form.register('acceptance_criteria')}
            />
          </div>

          {/* Technical context */}
          <div className="space-y-1.5">
            <Label htmlFor="technical_context" className={labelCls}>Contexto técnico</Label>
            <Textarea
              id="technical_context"
              placeholder="Referências técnicas, links, decisões..."
              rows={2}
              className={inputCls}
              {...form.register('technical_context')}
            />
          </div>

          {/* Git branch */}
          <div className="space-y-1.5">
            <Label htmlFor="git_branch" className={labelCls}>Git branch</Label>
            <Input
              id="git_branch"
              placeholder="feat/nome-da-branch"
              className={inputCls}
              {...form.register('git_branch')}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[var(--mtech-accent)] text-black font-semibold hover:brightness-110 rounded-[var(--mtech-radius-sm)] h-9 px-5 text-sm"
            >
              {isPending ? '...' : isEdit ? 'Salvar' : 'Criar Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
