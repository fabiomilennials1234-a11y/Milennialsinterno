import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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

  const form = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: {
      name: sprint?.name ?? '',
      goal: sprint?.goal ?? '',
      start_date: sprint?.start_date ?? new Date().toISOString().slice(0, 16),
      end_date: sprint?.end_date ?? '',
    },
  });

  const onSubmit = async (values: SprintFormValues) => {
    try {
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
      } else {
        await createSprint.mutateAsync({
          name: values.name,
          goal: values.goal,
          start_date: values.start_date,
          end_date: values.end_date,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch {
      // mutation error is handled by react-query
    }
  };

  const isPending = createSprint.isPending || updateSprint.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ maxWidth: 480 }}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--mtech-text)]">
            {isEditing ? 'Editar Sprint' : 'Nova Sprint'}
          </DialogTitle>
          <DialogDescription className="text-[var(--mtech-text-muted)]">
            {isEditing
              ? 'Atualize os dados da sprint.'
              : 'Preencha os dados para criar uma nova sprint.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide">
              Nome
            </label>
            <Input
              {...form.register('name')}
              placeholder="Sprint 01"
              className="border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)]"
            />
            {form.formState.errors.name && (
              <span className="text-xs text-[var(--mtech-danger)]">
                {form.formState.errors.name.message}
              </span>
            )}
          </div>

          {/* Goal */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide">
              Objetivo
            </label>
            <Input
              {...form.register('goal')}
              placeholder="Descreva o objetivo da sprint"
              className="border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)]"
            />
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide">
                Início
              </label>
              <Input
                type="datetime-local"
                {...form.register('start_date')}
                className="border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)]"
              />
              {form.formState.errors.start_date && (
                <span className="text-xs text-[var(--mtech-danger)]">
                  {form.formState.errors.start_date.message}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide">
                Fim
              </label>
              <Input
                type="datetime-local"
                {...form.register('end_date')}
                className="border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)]"
              />
              {form.formState.errors.end_date && (
                <span className="text-xs text-[var(--mtech-danger)]">
                  {form.formState.errors.end_date.message}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
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
