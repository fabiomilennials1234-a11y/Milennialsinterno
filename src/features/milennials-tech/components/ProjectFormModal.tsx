import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { useTechProfiles } from '../hooks/useProfiles';
import { useTechClients } from '../hooks/useClients';
import {
  useCreateTechProject,
  useUpdateTechProject,
  type TechProjectRow,
} from '../hooks/useTechProjects';
import {
  PROJECT_TYPE_LABEL,
  PROJECT_PRIORITY_LABEL,
  type ProjectType,
  type ProjectPriority,
} from '../lib/projectSteps';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const projectFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  type: z.enum(['client', 'internal']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  lead_id: z.string().nullable(),
  client_id: z.string().nullable(),
  start_date: z.string().nullable(),
  deadline: z.string().nullable(),
  estimated_hours: z.coerce.number().min(0).nullable(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: TechProjectRow;
}

// ---------------------------------------------------------------------------
// Styles (reuse mtech pattern)
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
const errorCls = 'text-[11px] text-[var(--mtech-danger)] mt-0.5';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectFormModal({ open, onOpenChange, project }: ProjectFormModalProps) {
  const isEditing = !!project;
  const { user } = useAuth();
  const createProject = useCreateTechProject();
  const updateProject = useUpdateTechProject();
  const { data: profiles = [] } = useTechProfiles();
  const { data: clients = [] } = useTechClients();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'internal',
      priority: 'medium',
      lead_id: null,
      client_id: null,
      start_date: null,
      deadline: null,
      estimated_hours: null,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (open && project) {
      form.reset({
        name: project.name,
        description: project.description ?? '',
        type: project.type as ProjectType,
        priority: project.priority as ProjectPriority,
        lead_id: project.lead_id ?? null,
        client_id: project.client_id ?? null,
        start_date: project.start_date ?? null,
        deadline: project.deadline ?? null,
        estimated_hours: project.estimated_hours ?? null,
      });
    } else if (open && !project) {
      form.reset({
        name: '',
        description: '',
        type: 'internal',
        priority: 'medium',
        lead_id: null,
        client_id: null,
        start_date: null,
        deadline: null,
        estimated_hours: null,
      });
    }
  }, [open, project, form]);

  const watchType = form.watch('type');

  const onSubmit = async (values: ProjectFormValues) => {
    if (!user?.id) return;

    try {
      if (isEditing && project) {
        await updateProject.mutateAsync({
          id: project.id,
          patch: {
            name: values.name,
            description: values.description || null,
            type: values.type as ProjectType,
            priority: values.priority as ProjectPriority,
            lead_id: values.lead_id || null,
            client_id: values.type === 'client' ? values.client_id || null : null,
            start_date: values.start_date || null,
            deadline: values.deadline || null,
            estimated_hours: values.estimated_hours ?? null,
          },
        });
      } else {
        await createProject.mutateAsync({
          name: values.name,
          description: values.description,
          type: values.type as ProjectType,
          priority: values.priority as ProjectPriority,
          lead_id: values.lead_id || undefined,
          client_id: values.type === 'client' ? values.client_id || undefined : undefined,
          start_date: values.start_date || undefined,
          deadline: values.deadline || undefined,
          estimated_hours: values.estimated_hours ?? undefined,
          created_by: user.id,
        });
      }
      onOpenChange(false);
    } catch {
      // Error already toasted by hooks
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-w-lg max-h-[90vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-[var(--mtech-text)]">
            {isEditing ? 'Editar Projeto' : 'Novo Projeto'}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            {isEditing
              ? 'Atualize as informacoes do projeto.'
              : 'Preencha os dados para criar um novo projeto.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 mt-2">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="proj-name" className={labelCls}>Nome do projeto</Label>
            <Input
              id="proj-name"
              placeholder="Ex: Redesign Dashboard, Integracao Stripe..."
              className={inputCls}
              {...form.register('name')}
            />
            {errors.name && <p className={errorCls}>{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="proj-desc" className={labelCls}>Descricao</Label>
            <Textarea
              id="proj-desc"
              placeholder="Contexto, objetivos, escopo..."
              rows={3}
              className={inputCls}
              {...form.register('description')}
            />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className={labelCls}>Tipo</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => form.setValue('type', v as ProjectType)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                  {(Object.entries(PROJECT_TYPE_LABEL) as [ProjectType, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className={labelCls}>Prioridade</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v as ProjectPriority)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                  {(Object.entries(PROJECT_PRIORITY_LABEL) as [ProjectPriority, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lead */}
          <div className="space-y-1">
            <Label className={labelCls}>Lead</Label>
            <Select
              value={form.watch('lead_id') ?? '__none__'}
              onValueChange={(v) => form.setValue('lead_id', v === '__none__' ? null : v)}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Selecionar lead" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                <SelectItem value="__none__">Sem lead</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client (conditional on type=client) */}
          {watchType === 'client' && (
            <div className="space-y-1">
              <Label className={labelCls}>Cliente</Label>
              <Select
                value={form.watch('client_id') ?? '__none__'}
                onValueChange={(v) => form.setValue('client_id', v === '__none__' ? null : v)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Vincular cliente" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50 max-h-60">
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates + Hours */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="proj-start" className={labelCls}>Inicio</Label>
              <Input
                id="proj-start"
                type="date"
                className={inputCls}
                {...form.register('start_date')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-deadline" className={labelCls}>Prazo</Label>
              <Input
                id="proj-deadline"
                type="date"
                className={inputCls}
                {...form.register('deadline')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-hours" className={labelCls}>Horas est.</Label>
              <Input
                id="proj-hours"
                type="number"
                min={0}
                placeholder="40"
                className={inputCls}
                {...form.register('estimated_hours')}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] h-9 px-4 text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[var(--mtech-accent)] text-black font-semibold hover:brightness-110 rounded-[var(--mtech-radius-sm)] h-9 px-5 text-sm"
            >
              {isPending
                ? isEditing ? 'Salvando...' : 'Criando...'
                : isEditing ? 'Salvar' : 'Criar Projeto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
