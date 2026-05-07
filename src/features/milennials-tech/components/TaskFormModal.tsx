import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronDown, Paperclip, X, Image } from 'lucide-react';
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
import { useCreateTechTask } from '../hooks/useTechTasks';
import { useUploadAttachments } from '../hooks/useTechAttachments';
import { useTechProfiles } from '../hooks/useProfiles';
import { useTechProjects } from '../hooks/useTechProjects';
import { TYPE_LABEL_FRIENDLY, PRIORITY_LABEL_FRIENDLY } from '../lib/statusLabels';
import type { TechTaskType, TechTaskPriority } from '../types';

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}

const TYPE_OPTIONS = Object.entries(TYPE_LABEL_FRIENDLY) as [TechTaskType, { label: string; hint: string }][];
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL_FRIENDLY) as [TechTaskPriority, { label: string; hint: string }][];

export function TaskFormModal({ open, onOpenChange, defaultProjectId }: TaskFormModalProps) {
  const { user } = useAuth();
  const createTask = useCreateTechTask();
  const uploadAttachments = useUploadAttachments();
  const { data: profiles = [] } = useTechProfiles();
  const { data: allProjects = [] } = useTechProjects({ status: 'active' });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [showMore, setShowMore] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter assignable users: devs + cto + ceo
  const assignableUsers = profiles.filter(
    (p) => p.user_id !== user?.id || true, // show all — RLS filters server-side
  );

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      what: '',
      why: '',
      acceptance_criteria: '',
      type: 'FEATURE',
      priority: 'MEDIUM',
      assignee_id: null,
      deadline: null,
      technical_context: null,
      extra_notes: null,
    },
  });

  const onSubmit = async (values: TaskFormValues) => {
    if (!user?.id) return;

    // Validate at least 1 attachment
    if (files.length === 0) {
      setFileError('Anexe pelo menos um print ou arquivo.');
      return;
    }
    setFileError(null);

    // Build description from structured fields
    const descParts: string[] = [];
    descParts.push(`**O que precisa ser feito:**\n${values.what}`);
    descParts.push(`**Por que é importante:**\n${values.why}`);
    if (values.extra_notes?.trim()) {
      descParts.push(`**Notas:**\n${values.extra_notes}`);
    }

    const hasAssignee = !!values.assignee_id;

    try {
      // project_id FK exists in DB but isn't in generated Supabase types yet — cast via spread
      const taskPayload: Record<string, unknown> = {
        title: values.title,
        description: descParts.join('\n\n'),
        type: values.type,
        status: hasAssignee ? 'TODO' : 'BACKLOG',
        priority: values.priority,
        assignee_id: values.assignee_id || null,
        deadline: values.deadline || null,
        acceptance_criteria: values.acceptance_criteria,
        technical_context: values.technical_context || null,
        created_by: user.id,
      };
      if (selectedProjectId) {
        taskPayload.project_id = selectedProjectId;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const task = await createTask.mutateAsync(taskPayload as any);

      // Upload attachments
      await uploadAttachments.mutateAsync({
        taskId: task.id,
        files,
        userId: user.id,
      });

      toast.success(`Task criada com ${files.length} anexo(s)`);
      form.reset();
      setFiles([]);
      setSelectedProjectId(defaultProjectId ?? null);
      setShowMore(false);
      onOpenChange(false);
    } catch {
      toast.error('Erro ao criar task');
    }
  };

  const isPending = createTask.isPending || uploadAttachments.isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setFileError(null);
    }
    e.target.value = ''; // allow re-selecting same file
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };
  const errors = form.formState.errors;

  const inputCls =
    'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
  const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
  const errorCls = 'text-[11px] text-[var(--mtech-danger)] mt-0.5';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-w-lg max-h-[90vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-[var(--mtech-text)]">
            Nova Task
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            Descreva o que precisa ser feito. Os devs cuidam do resto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 mt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title" className={labelCls}>Título</Label>
            <Input
              id="title"
              placeholder="Ex: Corrigir bug no login, Adicionar filtro de data..."
              className={inputCls}
              {...form.register('title')}
            />
            {errors.title && <p className={errorCls}>{errors.title.message}</p>}
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className={labelCls}>Tipo</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => form.setValue('type', v as TechTaskType)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                  {TYPE_OPTIONS.map(([value, { label, hint }]) => (
                    <SelectItem key={value} value={value}>
                      <span>{label}</span>
                      <span className="ml-2 text-[10px] text-[var(--mtech-text-subtle)]">{hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>Prioridade</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v as TechTaskPriority)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                  {PRIORITY_OPTIONS.map(([value, { label, hint }]) => (
                    <SelectItem key={value} value={value}>
                      <span>{label}</span>
                      <span className="ml-2 text-[10px] text-[var(--mtech-text-subtle)]">{hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* What */}
          <div className="space-y-1">
            <Label htmlFor="what" className={labelCls}>O que precisa ser feito? *</Label>
            <Textarea
              id="what"
              placeholder="Descreva claramente a tarefa..."
              rows={2}
              className={inputCls}
              {...form.register('what')}
            />
            {errors.what && <p className={errorCls}>{errors.what.message}</p>}
          </div>

          {/* Why */}
          <div className="space-y-1">
            <Label htmlFor="why" className={labelCls}>Por que isso é importante? *</Label>
            <Textarea
              id="why"
              placeholder="Qual o impacto? O que acontece se não fizermos?"
              rows={2}
              className={inputCls}
              {...form.register('why')}
            />
            {errors.why && <p className={errorCls}>{errors.why.message}</p>}
          </div>

          {/* Acceptance criteria */}
          <div className="space-y-1">
            <Label htmlFor="acceptance_criteria" className={labelCls}>Como saber que está pronto? *</Label>
            <Textarea
              id="acceptance_criteria"
              placeholder="Ex: O botão funciona, o dado aparece corretamente, o cliente consegue..."
              rows={2}
              className={inputCls}
              {...form.register('acceptance_criteria')}
            />
            {errors.acceptance_criteria && <p className={errorCls}>{errors.acceptance_criteria.message}</p>}
          </div>

          {/* Attachments (mandatory) */}
          <div className="space-y-2">
            <Label className={labelCls}>
              <Paperclip className="inline h-3 w-3 mr-1" />
              Prints / Anexos *
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* File previews */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file, i) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div
                      key={`${file.name}-${i}`}
                      className="relative group rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] overflow-hidden"
                      style={{ width: 72, height: 72 }}
                    >
                      {isImage ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-1">
                          <Image className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
                          <span className="text-[8px] text-[var(--mtech-text-subtle)] truncate w-full text-center mt-1">
                            {file.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-dashed border-[var(--mtech-border-strong)] text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:border-[var(--mtech-accent)] h-8 text-xs gap-1.5"
            >
              <Paperclip className="h-3 w-3" />
              {files.length === 0 ? 'Anexar prints' : 'Adicionar mais'}
            </Button>

            {fileError && <p className={errorCls}>{fileError}</p>}
          </div>

          {/* Assignee + Deadline + Project */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className={labelCls}>Responsável</Label>
              <Select
                value={form.watch('assignee_id') ?? '__none__'}
                onValueChange={(v) => form.setValue('assignee_id', v === '__none__' ? null : v)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Atribuir depois" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                  <SelectItem value="__none__">Atribuir depois</SelectItem>
                  {assignableUsers.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="deadline" className={labelCls}>Prazo</Label>
              <Input
                id="deadline"
                type="date"
                className={inputCls}
                {...form.register('deadline')}
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>Projeto</Label>
              <Select
                value={selectedProjectId ?? '__none__'}
                onValueChange={(v) => setSelectedProjectId(v === '__none__' ? null : v)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50 max-h-48">
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expandable: more details */}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1.5 text-xs text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] transition-colors py-1"
          >
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform"
              style={{ transform: showMore ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
            {showMore ? 'Menos detalhes' : 'Mais detalhes'}
          </button>

          {showMore && (
            <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                <Label htmlFor="technical_context" className={labelCls}>Contexto / Referências</Label>
                <Textarea
                  id="technical_context"
                  placeholder="Links, prints, conversas relevantes, exemplos..."
                  rows={2}
                  className={inputCls}
                  {...form.register('technical_context')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="extra_notes" className={labelCls}>Notas adicionais</Label>
                <Textarea
                  id="extra_notes"
                  placeholder="Qualquer outra informação útil..."
                  rows={2}
                  className={inputCls}
                  {...form.register('extra_notes')}
                />
              </div>
            </div>
          )}

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
              {isPending ? 'Criando...' : 'Criar Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
