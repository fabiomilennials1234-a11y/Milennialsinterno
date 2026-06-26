import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import {
  FIBONACCI,
  ISSUE_TYPE_CONFIG,
  epicColorFromKey,
  type IssueType,
} from '../lib/issueSystem';
import { getInitials } from '../hooks/useProfiles';
import {
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  SQUAD_CONFIG,
  SQUAD_ORDER,
  type AssigneeOption,
  type IssuePriority,
  type IssueSquad,
  type ProjectOption,
} from './backlogTypes';

// ---------------------------------------------------------------------------
// IssueCreateModal — create one issue into the backlog.
//
// The type choice leads (Story/Bug/Task as three glyph tiles) because it
// reframes everything below it — it is the first decision a creator makes in
// Jira. Project + Title + Type are required; the rest (priority, squad,
// points, assignee, description) are progressive. New issues land at the
// bottom of BACKLOG with the lowest rank — the modal does not ask where.
//
// Pure presentational: options in, onSubmit(payload) out. No fetching.
// ---------------------------------------------------------------------------

export interface IssueCreatePayload {
  projectId: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  squad: IssueSquad | null;
  storyPoints: number | null;
  assigneeId: string | null;
  description: string | null;
}

export interface IssueCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  assignees: AssigneeOption[];
  onSubmit: (payload: IssueCreatePayload) => void;
  isSubmitting?: boolean;
  /** Pre-selected project (e.g. opened from a project context). */
  defaultProjectId?: string | null;
  /** Server-side error rendered inline (e.g. permission / collision). */
  error?: string | null;
}

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
const optionalCls =
  'font-normal normal-case tracking-normal text-[var(--mtech-text-subtle)]';
const errorCls = 'text-[11px] text-[var(--mtech-danger)] mt-1';
const selectContentCls =
  'mtech-scope bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

const TYPE_ORDER: IssueType[] = ['STORY', 'BUG', 'TASK'];

export function IssueCreateModal({
  open,
  onOpenChange,
  projects,
  assignees,
  onSubmit,
  isSubmitting = false,
  defaultProjectId = null,
  error = null,
}: IssueCreateModalProps) {
  const [type, setType] = useState<IssueType>('STORY');
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [squad, setSquad] = useState<IssueSquad | null>(null);
  const [storyPoints, setStoryPoints] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState<{ project?: boolean; title?: boolean }>({});

  // Reset whenever the modal opens — never carry stale draft state across opens.
  useEffect(() => {
    if (open) {
      setType('STORY');
      setProjectId(defaultProjectId ?? '');
      setTitle('');
      setPriority('MEDIUM');
      setSquad(null);
      setStoryPoints(null);
      setAssigneeId(null);
      setDescription('');
      setTouched({});
    }
  }, [open, defaultProjectId]);

  const titleValid = title.trim().length >= 3;
  const projectValid = projectId.length > 0;
  const canSubmit = titleValid && projectValid && !isSubmitting;

  const projectError = touched.project && !projectValid ? 'Escolha um projeto.' : null;
  const titleError =
    touched.title && !titleValid && title.length > 0
      ? 'Mínimo de 3 caracteres.'
      : touched.title && title.length === 0
        ? 'Dê um título à issue.'
        : null;

  const NONE = '__none__';
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ project: true, title: true });
    if (!titleValid || !projectValid) return;
    onSubmit({
      projectId,
      title: title.trim(),
      type,
      priority,
      squad,
      storyPoints,
      assigneeId,
      description: description.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-h-[90vh] max-w-lg overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-[var(--mtech-text)]">
            Nova issue
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            Entra no fim do backlog. Priorize arrastando depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 grid gap-5" noValidate>
          {/* Type — leads, three glyph tiles */}
          <div className="space-y-1.5">
            <Label className={labelCls}>Tipo</Label>
            <div role="radiogroup" aria-label="Tipo de issue" className="grid grid-cols-3 gap-2">
              {TYPE_ORDER.map((t) => {
                const cfg = ISSUE_TYPE_CONFIG[t];
                const Icon = cfg.icon;
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(t)}
                    className={`flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-[var(--mtech-radius-md)] border text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] ${
                      active
                        ? 'text-[var(--mtech-text)]'
                        : 'border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)]'
                    }`}
                    style={
                      active
                        ? { borderColor: cfg.color, backgroundColor: cfg.bg }
                        : undefined
                    }
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-[4px]"
                      style={{ backgroundColor: cfg.color }}
                    >
                      <Icon className="h-3 w-3 text-black/85" strokeWidth={2.5} aria-hidden />
                    </span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project — required */}
          <div className="space-y-1">
            <Label className={labelCls}>Projeto</Label>
            <Select
              value={projectId || undefined}
              onValueChange={(v) => {
                setProjectId(v);
                setTouched((t) => ({ ...t, project: true }));
              }}
            >
              <SelectTrigger
                className={`${inputCls} ${projectError ? 'border-[var(--mtech-danger)]/60' : ''}`}
                aria-invalid={!!projectError}
              >
                <SelectValue placeholder="Selecionar projeto">
                  {selectedProject && (
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: epicColorFromKey(selectedProject.prefix) }}
                      />
                      <span data-mono className="text-[11px] font-semibold text-[var(--mtech-text-muted)]">
                        {selectedProject.prefix}
                      </span>
                      <span className="truncate">{selectedProject.name}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className={`${selectContentCls} max-h-60`}>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: epicColorFromKey(p.prefix) }}
                      />
                      <span data-mono className="text-[11px] font-semibold text-[var(--mtech-text-muted)]">
                        {p.prefix}
                      </span>
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectError && <p className={errorCls}>{projectError}</p>}
          </div>

          {/* Title — required */}
          <div className="space-y-1">
            <Label htmlFor="ic-title" className={labelCls}>
              Título
            </Label>
            <Input
              id="ic-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              placeholder="O que precisa ser feito?"
              className={`${inputCls} ${titleError ? 'border-[var(--mtech-danger)]/60' : ''}`}
              aria-invalid={!!titleError}
              aria-describedby={titleError ? 'ic-title-err' : undefined}
            />
            {titleError && (
              <p id="ic-title-err" className={errorCls}>
                {titleError}
              </p>
            )}
          </div>

          {/* Priority + Squad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className={labelCls}>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentCls}>
                  {PRIORITY_ORDER.map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <Icon
                            className="h-3.5 w-3.5"
                            strokeWidth={2.5}
                            style={{ color: cfg.color }}
                            aria-hidden
                          />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className={labelCls}>
                Squad <span className={optionalCls}>opcional</span>
              </Label>
              <div role="radiogroup" aria-label="Squad" className="grid grid-cols-2 gap-2">
                {SQUAD_ORDER.map((s) => {
                  const cfg = SQUAD_CONFIG[s];
                  const active = squad === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSquad(active ? null : s)}
                      className={`flex h-9 items-center justify-center gap-1.5 rounded-[var(--mtech-radius-sm)] border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] ${
                        active
                          ? 'border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)]'
                          : 'border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)]'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Story points — Fibonacci */}
          <div className="space-y-1.5">
            <Label className={labelCls}>
              Estimativa <span className={optionalCls}>opcional · Fibonacci</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {FIBONACCI.map((n) => {
                const active = storyPoints === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${n} ${n === 1 ? 'ponto' : 'pontos'}`}
                    onClick={() => setStoryPoints(active ? null : n)}
                    data-mono
                    className={`flex h-8 min-w-9 items-center justify-center rounded-[var(--mtech-radius-sm)] border px-2 text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] ${
                      active
                        ? 'border-[var(--mtech-accent)]/50 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
                        : 'border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)]'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <Label className={labelCls}>
              Responsável <span className={optionalCls}>opcional</span>
            </Label>
            <Select
              value={assigneeId ?? NONE}
              onValueChange={(v) => setAssigneeId(v === NONE ? null : v)}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent className={`${selectContentCls} max-h-60`}>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[8px] font-bold text-[var(--mtech-accent)]">
                        {a.avatarUrl ? (
                          <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          getInitials(a.name)
                        )}
                      </span>
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="ic-desc" className={labelCls}>
              Descrição <span className={optionalCls}>opcional</span>
            </Label>
            <Textarea
              id="ic-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, critérios de aceite, links..."
              rows={3}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-danger)]/30 bg-[var(--mtech-danger)]/10 px-3 py-2 text-[12px] text-[var(--mtech-danger)]">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-sm text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-9 rounded-[var(--mtech-radius-sm)] bg-[var(--mtech-accent)] px-5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
            >
              {isSubmitting ? 'Criando...' : 'Criar issue'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
