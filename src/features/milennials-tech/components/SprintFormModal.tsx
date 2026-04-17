import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sprintFormSchema, type SprintFormValues } from '../schemas/task';
import { useCreateTechSprint, useUpdateTechSprint } from '../hooks/useTechSprints';
import { useTechTasks, useUpdateTechTask } from '../hooks/useTechTasks';
import { useProfileMap, getInitials } from '../hooks/useProfiles';
import { TYPE_LABEL_FRIENDLY } from '../lib/statusLabels';
import type { TechSprint } from '../types';

interface SprintFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint?: TechSprint;
}

export function SprintFormModal({ open, onOpenChange, sprint }: SprintFormModalProps) {
  const isEditing = !!sprint;
  const createSprint = useCreateTechSprint();
  const updateSprint = useUpdateTechSprint();
  const updateTask = useUpdateTechTask();
  const profileMap = useProfileMap();

  // Fetch backlog tasks (unassigned to any sprint)
  const { data: allTasks = [] } = useTechTasks();
  const backlogTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'BACKLOG' && !t.sprint_id),
    [allTasks],
  );

  // Tasks already in this sprint (for editing)
  const sprintTasks = useMemo(
    () => (sprint ? allTasks.filter((t) => t.sprint_id === sprint.id) : []),
    [allTasks, sprint],
  );

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTaskIds(new Set(sprintTasks.map((t) => t.id)));
    }
  }, [open, sprintTasks]);

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const form = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: {
      name: sprint?.name ?? '',
      goal: sprint?.goal ?? '',
      start_date: sprint?.start_date?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
      end_date: sprint?.end_date?.slice(0, 16) ?? '',
    },
  });

  // Reset form when sprint changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: sprint?.name ?? '',
        goal: sprint?.goal ?? '',
        start_date: sprint?.start_date?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
        end_date: sprint?.end_date?.slice(0, 16) ?? '',
      });
    }
  }, [open, sprint, form]);

  const onSubmit = async (values: SprintFormValues) => {
    try {
      let sprintId: string;

      if (isEditing && sprint) {
        await updateSprint.mutateAsync({
          id: sprint.id,
          patch: {
            name: values.name,
            goal: values.goal,
            start_date: values.start_date,
            end_date: values.end_date,
          },
        });
        sprintId = sprint.id;
      } else {
        const created = await createSprint.mutateAsync({
          name: values.name,
          goal: values.goal,
          start_date: values.start_date,
          end_date: values.end_date,
        });
        sprintId = created.id;
      }

      // Assign selected tasks to sprint + set deadline to sprint end date
      const tasksToAssign = [...selectedTaskIds];
      for (const taskId of tasksToAssign) {
        const task = allTasks.find((t) => t.id === taskId);
        if (task && task.sprint_id !== sprintId) {
          await updateTask.mutateAsync({
            id: taskId,
            patch: {
              sprint_id: sprintId,
              deadline: values.end_date,
            },
          });
        }
      }

      // Remove tasks that were unselected (only in edit mode)
      if (isEditing) {
        for (const task of sprintTasks) {
          if (!selectedTaskIds.has(task.id)) {
            await updateTask.mutateAsync({
              id: task.id,
              patch: { sprint_id: null, deadline: null },
            });
          }
        }
      }

      toast.success(isEditing ? 'Sprint atualizada' : `Sprint criada com ${tasksToAssign.length} tasks`);
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao salvar sprint');
    }
  };

  const isPending = createSprint.isPending || updateSprint.isPending || updateTask.isPending;

  const inputCls =
    'border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)]';
  const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';

  // Available tasks = backlog (no sprint) + already in this sprint
  const availableTasks = useMemo(() => {
    const combined = [...backlogTasks, ...sprintTasks];
    // Deduplicate
    const seen = new Set<string>();
    return combined.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [backlogTasks, sprintTasks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ maxWidth: 600, maxHeight: '90vh' }}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--mtech-text)]">
            {isEditing ? 'Editar Sprint' : 'Nova Sprint'}
          </DialogTitle>
          <DialogDescription className="text-[var(--mtech-text-muted)]">
            {isEditing
              ? 'Atualize os dados e selecione as tasks desta sprint.'
              : 'Configure a sprint e escolha quais tasks do backlog incluir.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2 overflow-y-auto max-h-[70vh] pr-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Nome</label>
            <Input
              {...form.register('name')}
              placeholder="Sprint 01"
              className={inputCls}
            />
            {form.formState.errors.name && (
              <span className="text-xs text-[var(--mtech-danger)]">
                {form.formState.errors.name.message}
              </span>
            )}
          </div>

          {/* Goal */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Objetivo</label>
            <Input
              {...form.register('goal')}
              placeholder="Descreva o objetivo da sprint"
              className={inputCls}
            />
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Início</label>
              <Input
                type="date"
                {...form.register('start_date')}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Fim</label>
              <Input
                type="date"
                {...form.register('end_date')}
                className={inputCls}
              />
              {form.formState.errors.end_date && (
                <span className="text-xs text-[var(--mtech-danger)]">
                  Data de fim deve ser após o início
                </span>
              )}
            </div>
          </div>

          {/* Task selection */}
          <div className="flex flex-col gap-2">
            <label className={labelCls}>
              Tasks do Backlog ({selectedTaskIds.size} selecionadas)
            </label>

            {availableTasks.length === 0 ? (
              <p className="text-xs text-[var(--mtech-text-subtle)] py-4 text-center">
                Nenhuma task disponível no backlog.
              </p>
            ) : (
              <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-bg)] p-1">
                {availableTasks.map((task) => {
                  const isSelected = selectedTaskIds.has(task.id);
                  const typeFriendly = TYPE_LABEL_FRIENDLY[task.type];
                  const resolvedAssigneeName = task.assignee_id ? profileMap[task.assignee_id] ?? null : null;
                  const assigneeInitials = task.assignee_id
                    ? (resolvedAssigneeName ? getInitials(resolvedAssigneeName) : '??')
                    : null;
                  const creatorName = profileMap[task.created_by] ?? null;
                  const creatorInitials = creatorName ? getInitials(creatorName) : '??';
                  const creatorTooltip = creatorName ? `Criada por ${creatorName}` : 'Criador indisponível';
                  const assigneeTooltip = resolvedAssigneeName ? `Responsável: ${resolvedAssigneeName}` : 'Responsável: usuário removido';
                  const selfAssignedTooltip = resolvedAssigneeName
                    ? `Criada por ${resolvedAssigneeName} (responsável)`
                    : 'Criada pelo responsável (usuário removido)';
                  const isSelfAssigned = !!task.assignee_id && task.assignee_id === task.created_by;
                  const assigneeLabel = resolvedAssigneeName ?? (task.assignee_id ? '—' : null);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--mtech-radius-sm)] text-left transition-colors hover:bg-[var(--mtech-surface-elev)]"
                      style={{
                        background: isSelected ? 'var(--mtech-accent-muted)' : undefined,
                      }}
                    >
                      {/* Checkbox */}
                      <span
                        className="flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors"
                        style={{
                          borderColor: isSelected ? 'var(--mtech-accent)' : 'var(--mtech-border-strong)',
                          background: isSelected ? 'var(--mtech-accent)' : 'transparent',
                        }}
                      >
                        {isSelected && <Check className="h-3 w-3 text-black" />}
                      </span>

                      {/* Type badge */}
                      <span
                        className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          color: task.type === 'BUG' ? '#E5484D' : task.type === 'HOTFIX' ? '#F97316' : task.type === 'FEATURE' ? '#3B82F6' : '#8A8A95',
                          background: task.type === 'BUG' ? 'rgba(229,72,77,0.12)' : task.type === 'HOTFIX' ? 'rgba(249,115,22,0.12)' : task.type === 'FEATURE' ? 'rgba(59,130,246,0.12)' : 'rgba(138,138,149,0.12)',
                        }}
                      >
                        {typeFriendly.label}
                      </span>

                      {/* Title */}
                      <span className="flex-1 truncate text-sm text-[var(--mtech-text)]">
                        {task.title}
                      </span>

                      {/* Creator + assignee avatars */}
                      <span className="flex-shrink-0 flex items-center gap-1.5 text-[10px] text-[var(--mtech-text-subtle)]">
                        {isSelfAssigned ? (
                          <span
                            title={selfAssignedTooltip}
                            className="relative flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                          >
                            {assigneeInitials}
                            <span
                              aria-hidden
                              className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full"
                              style={{ background: 'var(--mtech-accent)', boxShadow: '0 0 0 1px var(--mtech-bg)' }}
                            />
                          </span>
                        ) : task.assignee_id ? (
                          <span className="flex items-center -space-x-1.5">
                            <span
                              title={creatorTooltip}
                              className="flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                            >
                              {creatorInitials}
                            </span>
                            <span
                              title={assigneeTooltip}
                              className="flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                            >
                              {assigneeInitials}
                            </span>
                          </span>
                        ) : (
                          <span
                            title={creatorTooltip}
                            className="flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                          >
                            {creatorInitials}
                          </span>
                        )}
                        {assigneeLabel ?? (creatorName ? `por ${creatorName}` : '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-[var(--mtech-surface)]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[var(--mtech-text-muted)]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold"
            >
              {isPending
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar'
                  : 'Criar Sprint'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
