import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronDown, Paperclip, X, Image, CheckCircle2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { taskFormSchema, type TaskFormValues } from '../schemas/task';
import { useUploadAttachments } from '../hooks/useTechAttachments';
import { TYPE_LABEL_FRIENDLY, PRIORITY_LABEL_FRIENDLY } from '../lib/statusLabels';
import type { TechTaskType, TechTaskPriority } from '../types';

const TYPE_OPTIONS = Object.entries(TYPE_LABEL_FRIENDLY) as [TechTaskType, { label: string; hint: string }][];
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL_FRIENDLY) as [TechTaskPriority, { label: string; hint: string }][];

export function SubmitTaskPage() {
  const { user } = useAuth();
  const uploadAttachments = useUploadAttachments();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showMore, setShowMore] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (files.length === 0) {
      setFileError('Anexe pelo menos um print ou arquivo.');
      return;
    }
    setFileError(null);

    const descParts: string[] = [];
    descParts.push(`**O que precisa ser feito:**\n${values.what}`);
    descParts.push(`**Por que é importante:**\n${values.why}`);
    if (values.extra_notes?.trim()) {
      descParts.push(`**Notas:**\n${values.extra_notes}`);
    }

    try {
      setIsSubmitting(true);

      // Create task via RPC (works for any authenticated user).
      // Assignee is intentionally omitted: submissions always land unassigned
      // in BACKLOG for the technical team to triage.
      const { data: taskId, error } = await supabase.rpc('tech_submit_task', {
        _title: values.title,
        _description: descParts.join('\n\n'),
        _type: values.type,
        _priority: values.priority,
        _acceptance_criteria: values.acceptance_criteria,
        _technical_context: values.technical_context || null,
        _deadline: values.deadline || null,
      });
      if (error) throw error;

      // Upload attachments. Metadata goes through tech_submit_attachment
      // (SECURITY DEFINER) so submitters without can_see_tech succeed.
      await uploadAttachments.mutateAsync({
        taskId: taskId as string,
        files,
        userId: user.id,
      });

      // The AFTER INSERT trigger on tech_tasks already logs 'task_created'
      // in the activity feed; no extra comment needed, and tech_add_comment
      // would fail for submitters without can_see_tech anyway.

      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha desconhecida ao enviar task';
      console.error('[SubmitTaskPage] submission failed:', err);
      toast.error(`Erro ao enviar task: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    form.reset();
    setFiles([]);
    setFileError(null);
    setSubmitted(false);
  };

  const isPending = isSubmitting || uploadAttachments.isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setFileError(null);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const errors = form.formState.errors;

  const inputCls =
    'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
  const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
  const errorCls = 'text-[11px] text-[var(--mtech-danger)] mt-0.5';

  // Success screen
  if (submitted) {
    return (
      <div className="mtech-scope min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto" style={{ color: 'var(--mtech-success)' }} />
          <h1 className="text-2xl font-semibold text-[var(--mtech-text)]">Task enviada!</h1>
          <p className="text-sm text-[var(--mtech-text-muted)]">
            Sua task foi adicionada ao backlog e a equipe já foi notificada.
          </p>
          <Button
            onClick={handleReset}
            className="bg-[var(--mtech-accent)] text-black font-semibold mt-4"
          >
            Enviar outra task
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mtech-scope min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--mtech-text)]">
            Enviar Task
          </h1>
          <p className="text-sm text-[var(--mtech-text-muted)] mt-1">
            Descreva o que precisa ser feito. A equipe de engenharia cuida do resto.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
              rows={3}
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
              placeholder="Ex: O botão funciona, o dado aparece corretamente..."
              rows={2}
              className={inputCls}
              {...form.register('acceptance_criteria')}
            />
            {errors.acceptance_criteria && <p className={errorCls}>{errors.acceptance_criteria.message}</p>}
          </div>

          {/* Attachments */}
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
                        <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-1">
                          <Image className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
                          <span className="text-[8px] text-[var(--mtech-text-subtle)] truncate w-full text-center mt-1">{file.name}</span>
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

          {/* Deadline */}
          <div className="space-y-1">
            <Label htmlFor="deadline" className={labelCls}>Prazo</Label>
            <Input id="deadline" type="date" className={inputCls} {...form.register('deadline')} />
          </div>

          {/* Expandable */}
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
                <Textarea id="technical_context" placeholder="Links, prints, conversas relevantes..." rows={2} className={inputCls} {...form.register('technical_context')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="extra_notes" className={labelCls}>Notas adicionais</Label>
                <Textarea id="extra_notes" placeholder="Qualquer outra informação útil..." rows={2} className={inputCls} {...form.register('extra_notes')} />
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-[var(--mtech-accent)] text-black font-semibold hover:brightness-110 h-10 text-sm mt-2"
          >
            {isPending ? 'Enviando...' : 'Enviar Task'}
          </Button>
        </form>
      </div>
    </div>
  );
}
