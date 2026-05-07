import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useProjectTaskTemplates,
  useCreateProjectTaskTemplate,
  useUpdateProjectTaskTemplate,
  useDeleteProjectTaskTemplate,
  type ProjectTaskTemplate,
  type CreateTemplateInput,
} from '../hooks/useProjectTaskTemplates';
import { PROJECT_STEP_LABEL, PROJECT_STEPS, type ProjectStep } from '../lib/projectSteps';

// ---------------------------------------------------------------------------
// Styles (mtech tokens)
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';
const badgeCls =
  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_OPTIONS: { value: string; label: string }[] = [
  { value: '__none__', label: 'Sem etapa (generica)' },
  ...PROJECT_STEPS.map((s) => ({ value: s, label: PROJECT_STEP_LABEL[s] })),
];

// ---------------------------------------------------------------------------
// Sub: Create form
// ---------------------------------------------------------------------------

function CreateTemplateForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateProjectTaskTemplate();
  const [title, setTitle] = useState('');
  const [step, setStep] = useState('__none__');
  const [taskType, setTaskType] = useState<'daily' | 'weekly' | 'step'>('daily');
  const [isProjectScoped, setIsProjectScoped] = useState(true);

  const stepRequired = taskType === 'step' && step === '__none__';

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (taskType === 'step' && step === '__none__') return;

    const input: CreateTemplateInput = {
      title: title.trim(),
      step: step === '__none__' ? null : step,
      task_type: taskType,
      is_project_scoped: taskType === 'step' ? true : (step === '__none__' ? false : isProjectScoped),
    };

    await createMutation.mutateAsync(input);
    onClose();
  };

  return (
    <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-accent)]/30 bg-[var(--mtech-surface-elev)] p-4 space-y-3">
      <p className="text-xs font-semibold text-[var(--mtech-accent)] uppercase tracking-wide">
        Nova Template
      </p>

      <div className="space-y-1">
        <Label className={labelCls}>Titulo</Label>
        <Input
          placeholder='Ex: Revisar codigo — {projeto}'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onClose();
          }}
          autoFocus
          className={`${inputCls} h-8 text-sm`}
        />
        <p className="text-[10px] text-[var(--mtech-text-subtle)]">
          Use {'{projeto}'} no titulo para inserir o nome do projeto automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={labelCls}>Etapa</Label>
          <Select value={step} onValueChange={setStep}>
            <SelectTrigger className={`${inputCls} h-8 text-xs`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              {STEP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={labelCls}>Tipo</Label>
          <Select value={taskType} onValueChange={(v) => setTaskType(v as 'daily' | 'weekly' | 'step')}>
            <SelectTrigger className={`${inputCls} h-8 text-xs`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              <SelectItem value="daily">Diaria</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="step">Por Etapa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {stepRequired && (
        <p className="text-[10px] text-[var(--mtech-danger)] font-medium">
          Selecione uma etapa — templates por etapa exigem etapa vinculada.
        </p>
      )}

      {step !== '__none__' && taskType !== 'step' && (
        <div className="flex items-center gap-2">
          <Switch
            checked={isProjectScoped}
            onCheckedChange={setIsProjectScoped}
            className="data-[state=checked]:bg-[var(--mtech-accent)]"
          />
          <span className="text-xs text-[var(--mtech-text-muted)]">
            {isProjectScoped
              ? 'Por projeto (1 tarefa por projeto na etapa)'
              : 'Global (1 tarefa se houver projeto na etapa)'}
          </span>
        </div>
      )}

      {taskType === 'step' && step !== '__none__' && (
        <p className="text-[10px] text-[var(--mtech-text-subtle)]">
          Tarefa sera criada automaticamente quando um projeto entrar nesta etapa. Sempre bloqueante.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createMutation.isPending || !title.trim() || stepRequired}
          className="bg-[var(--mtech-accent)] text-black font-semibold hover:brightness-110 h-7 px-4 text-[11px]"
        >
          {createMutation.isPending ? 'Criando...' : 'Criar'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-7 px-3 text-[var(--mtech-text-subtle)] text-[11px]"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Template row
// ---------------------------------------------------------------------------

interface TemplateRowProps {
  template: ProjectTaskTemplate;
}

function TemplateRow({ template }: TemplateRowProps) {
  const updateMutation = useUpdateProjectTaskTemplate();
  const deleteMutation = useDeleteProjectTaskTemplate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(template.title);

  const stepLabel = template.step
    ? PROJECT_STEP_LABEL[template.step as ProjectStep] ?? template.step
    : 'Generica';

  const handleSaveTitle = () => {
    if (!editTitle.trim() || editTitle.trim() === template.title) {
      setIsEditingTitle(false);
      setEditTitle(template.title);
      return;
    }
    updateMutation.mutate(
      { id: template.id, patch: { title: editTitle.trim() } },
      { onSuccess: () => setIsEditingTitle(false) },
    );
  };

  const handleToggleActive = (checked: boolean) => {
    updateMutation.mutate({ id: template.id, patch: { is_active: checked } });
  };

  const handleDelete = () => {
    deleteMutation.mutate(template.id);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-[var(--mtech-radius-md)] border transition-colors group',
        template.is_active
          ? 'border-[var(--mtech-border)] bg-[var(--mtech-surface)]'
          : 'border-[var(--mtech-border)]/50 bg-[var(--mtech-surface)]/50 opacity-60',
      )}
    >
      {/* Active toggle */}
      <Switch
        checked={template.is_active}
        onCheckedChange={handleToggleActive}
        disabled={updateMutation.isPending}
        className="data-[state=checked]:bg-[var(--mtech-accent)] flex-shrink-0"
      />

      {/* Title (inline editable) */}
      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setEditTitle(template.title);
                }
              }}
              autoFocus
              className={`${inputCls} h-7 text-xs flex-1`}
            />
            <button
              onClick={handleSaveTitle}
              className="p-1 text-[var(--mtech-accent)] hover:bg-[var(--mtech-accent)]/10 rounded"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setIsEditingTitle(false);
                setEditTitle(template.title);
              }}
              className="p-1 text-[var(--mtech-text-subtle)] hover:bg-[var(--mtech-surface-elev)] rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="text-sm text-[var(--mtech-text)] text-left truncate w-full group/title flex items-center gap-1.5"
          >
            <span className="truncate">{template.title}</span>
            <Pencil className="h-3 w-3 text-[var(--mtech-text-subtle)] opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className={cn(
            badgeCls,
            'bg-[var(--mtech-accent)]/10 text-[var(--mtech-accent)]',
          )}
        >
          {stepLabel}
        </span>
        <span
          className={cn(
            badgeCls,
            template.task_type === 'daily'
              ? 'bg-blue-500/10 text-blue-400'
              : template.task_type === 'weekly'
                ? 'bg-purple-500/10 text-purple-400'
                : 'bg-amber-500/10 text-amber-400',
          )}
        >
          {template.task_type === 'daily' ? 'Diaria' : template.task_type === 'weekly' ? 'Semanal' : 'Por Etapa'}
        </span>
        {template.step && (
          <span
            className={cn(
              badgeCls,
              template.is_project_scoped
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400',
            )}
          >
            {template.is_project_scoped ? 'Por projeto' : 'Global'}
          </span>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleteMutation.isPending}
        className="p-1.5 text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-danger)] hover:bg-[var(--mtech-danger)]/10 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface ProjectTaskTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectTaskTemplatesModal({ open, onOpenChange }: ProjectTaskTemplatesModalProps) {
  const { data: templates = [], isLoading } = useProjectTaskTemplates();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const dailyTemplates = templates.filter((t) => t.task_type === 'daily');
  const weeklyTemplates = templates.filter((t) => t.task_type === 'weekly');
  const stepTemplates = templates.filter((t) => t.task_type === 'step');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-w-2xl max-h-[85vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-[var(--mtech-text)]">
            Templates de Tarefas
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            Configure quais tarefas sao geradas automaticamente pelo sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Create form / button */}
          {showCreateForm ? (
            <CreateTemplateForm onClose={() => setShowCreateForm(false)} />
          ) : (
            <Button
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="bg-[var(--mtech-accent)] text-black font-semibold hover:brightness-110 h-8 px-4 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Template
            </Button>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-[var(--mtech-surface-elev)] rounded-[var(--mtech-radius-md)] animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Daily templates */}
          {dailyTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide">
                Tarefas Diarias ({dailyTemplates.length})
              </p>
              {dailyTemplates.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </div>
          )}

          {/* Weekly templates */}
          {weeklyTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide">
                Tarefas Semanais ({weeklyTemplates.length})
              </p>
              {weeklyTemplates.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </div>
          )}

          {/* Step templates */}
          {stepTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide">
                Por Etapa ({stepTemplates.length})
              </p>
              {stepTemplates.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && templates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--mtech-text-subtle)]">
                Nenhuma template configurada.
              </p>
              <p className="text-xs text-[var(--mtech-text-subtle)] mt-1">
                Crie templates para gerar tarefas automaticamente.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
