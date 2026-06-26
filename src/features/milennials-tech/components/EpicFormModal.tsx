import { useEffect, useState, type FormEvent } from 'react';
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
  EpicDemandaField,
  type DemandaOption,
  type DemandaScope,
} from './EpicDemandaField';

// ---------------------------------------------------------------------------
// EpicFormModal (#159) — create an epic under a project, optionally linked to a
// client demand.
//
// Structurally a sibling of IssueCreateModal (pure presentational: options in,
// onSubmit(payload) out, no fetching) and field-styled like ProjectFormModal.
// The title leads — it's the one required decision; description + dates +
// demanda are progressive. The demand block only appears for client-scoped
// projects: an internal project literally has no demand to point at, so the
// modal omits the row rather than show a dead control (the field's locked-note
// fallback is the defense if a host renders it anyway).
//
// The demanda link rides the create payload as `demandaId`.
// TODO(eng): thread `demandaId` through useCreateEpic → tech_epic_create
//   (p_demanda_id). Resolve scope + options via useTechDemandas(client_id) in a
//   container that wraps this modal, mirroring the IssueCreateModal pattern.
// ---------------------------------------------------------------------------

export interface EpicCreatePayload {
  title: string;
  description: string | null;
  startDate: string | null;
  deadline: string | null;
  /** Linked client demand, or null. Always null for internal projects. */
  demandaId: string | null;
}

export interface EpicFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human label of the project this epic lands under, for header context. */
  projectLabel?: string | null;
  /** Demand scope for the project (drives whether the link block shows). */
  demandaScope: DemandaScope;
  /** Selectable demands for the project's client (scope=ready). */
  demandas: DemandaOption[];
  onSubmit: (payload: EpicCreatePayload) => void;
  isSubmitting?: boolean;
  /** Server-side error rendered inline (e.g. permission / collision). */
  error?: string | null;
}

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
const optionalCls = 'font-normal normal-case tracking-normal text-[var(--mtech-text-subtle)]';
const errorCls = 'text-[11px] text-[var(--mtech-danger)] mt-1';

export function EpicFormModal({
  open,
  onOpenChange,
  projectLabel,
  demandaScope,
  demandas,
  onSubmit,
  isSubmitting = false,
  error = null,
}: EpicFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [demandaId, setDemandaId] = useState<string | null>(null);
  const [touchedTitle, setTouchedTitle] = useState(false);

  // Reset on open — never carry a stale draft across opens.
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setStartDate('');
      setDeadline('');
      setDemandaId(null);
      setTouchedTitle(false);
    }
  }, [open]);

  const titleValid = title.trim().length >= 3;
  const canSubmit = titleValid && !isSubmitting;
  const titleError =
    touchedTitle && !titleValid
      ? title.trim().length === 0
        ? 'Dê um título ao epic.'
        : 'Mínimo de 3 caracteres.'
      : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouchedTitle(true);
    if (!titleValid) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      deadline: deadline || null,
      demandaId: demandaScope === 'internal' ? null : demandaId,
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
            Novo epic
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            {projectLabel
              ? `Guarda-chuva de issues em ${projectLabel}.`
              : 'Um guarda-chuva que agrupa issues e mede o progresso.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 grid gap-5" noValidate>
          {/* Title — leads, required */}
          <div className="space-y-1">
            <Label htmlFor="epic-title" className={labelCls}>
              Título
            </Label>
            <Input
              id="epic-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouchedTitle(true)}
              placeholder="Ex: Checkout reativo de ponta a ponta"
              className={`${inputCls} ${titleError ? 'border-[var(--mtech-danger)]/60' : ''}`}
              aria-invalid={!!titleError}
              aria-describedby={titleError ? 'epic-title-err' : undefined}
            />
            {titleError && (
              <p id="epic-title-err" className={errorCls}>
                {titleError}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="epic-desc" className={labelCls}>
              Descrição <span className={optionalCls}>opcional</span>
            </Label>
            <Textarea
              id="epic-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivo, escopo, critérios de pronto..."
              rows={3}
              className={inputCls}
            />
          </div>

          {/* Demand link — only for client-scoped projects */}
          {demandaScope !== 'internal' && (
            <EpicDemandaField
              scope={demandaScope}
              options={demandas}
              value={demandaId}
              onChange={setDemandaId}
              disabled={isSubmitting}
            />
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="epic-start" className={labelCls}>
                Início <span className={optionalCls}>opcional</span>
              </Label>
              <Input
                id="epic-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="epic-deadline" className={labelCls}>
                Prazo <span className={optionalCls}>opcional</span>
              </Label>
              <Input
                id="epic-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputCls}
              />
            </div>
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
              {isSubmitting ? 'Criando...' : 'Criar epic'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
