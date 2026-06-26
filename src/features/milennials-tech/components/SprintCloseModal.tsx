import { useEffect, useState } from 'react';
import { ArchiveRestore, ArrowRightLeft, CheckCircle2, CircleSlash } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// SprintCloseModal (#161) — the decision that closes an ACTIVE sprint.
//
// Closing splits the sprint in two: what shipped freezes into history, and
// what didn't needs a new home. This modal makes that split explicit before
// it commits — the completed work is stated as a fact, the incomplete work is
// the question, and the answer is a single destination.
//
//   • Voltar ao backlog — incompletes return to the shared backlog (default,
//     and the only option when no PLANNING sprint exists to receive them).
//   • Mover para outro sprint — incompletes carry over into a chosen sprint
//     that's still in planning. Revealed only when such sprints exist.
//
// When nothing is incomplete the question disappears entirely — the modal
// becomes a clean confirmation that the sprint shipped whole.
//
// Pure presentational. The choice leaves as a SprintCloseTarget; the container
// performs the move and the close.
// ---------------------------------------------------------------------------

export type SprintCloseTarget = { kind: 'backlog' } | { kind: 'sprint'; id: string };

export interface SprintCloseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incompleteCount: number;
  completedCount: number;
  /** Sprints in PLANNING that can receive carry-over. */
  nextSprints: Array<{ id: string; name: string }>;
  onConfirm: (target: SprintCloseTarget) => void;
  isPending: boolean;
}

type TargetKind = 'backlog' | 'sprint';

const LABEL_CLS =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--mtech-text-muted)]';

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function SprintCloseModal({
  open,
  onOpenChange,
  incompleteCount,
  completedCount,
  nextSprints,
  onConfirm,
  isPending,
}: SprintCloseModalProps) {
  const hasNextSprints = nextSprints.length > 0;
  const hasIncomplete = incompleteCount > 0;

  const [kind, setKind] = useState<TargetKind>('backlog');
  const [sprintId, setSprintId] = useState<string | null>(nextSprints[0]?.id ?? null);

  // Reset the choice each time the modal opens, and keep the selected sprint
  // valid as the planning list changes underneath it.
  useEffect(() => {
    if (open) {
      setKind('backlog');
      setSprintId(nextSprints[0]?.id ?? null);
    }
  }, [open, nextSprints]);

  const resolvedTarget: SprintCloseTarget =
    kind === 'sprint' && sprintId ? { kind: 'sprint', id: sprintId } : { kind: 'backlog' };

  const confirmDisabled = isPending || (kind === 'sprint' && !sprintId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ maxWidth: 460 }}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--mtech-text)] tracking-[-0.01em]">
            Fechar sprint
          </DialogTitle>
          <DialogDescription className="text-[var(--mtech-text-muted)]">
            {hasIncomplete
              ? 'O que foi concluído entra no histórico. Escolha para onde vão as issues incompletas.'
              : 'Tudo foi concluído. Este sprint será arquivado no histórico.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 flex flex-col gap-5">
          {/* Summary — two facts about the split. */}
          <div className="grid grid-cols-2 gap-2.5">
            <SummaryStat
              icon={<CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--mtech-success)' }} />}
              value={completedCount}
              label={completedCount === 1 ? 'concluída' : 'concluídas'}
              hint="ficam no histórico"
              tone="success"
            />
            <SummaryStat
              icon={<CircleSlash className="h-3.5 w-3.5 text-[var(--mtech-text-muted)]" />}
              value={incompleteCount}
              label={incompleteCount === 1 ? 'incompleta' : 'incompletas'}
              hint={hasIncomplete ? 'precisam de destino' : 'nenhuma pendência'}
              tone="muted"
            />
          </div>

          {/* Destination — only when there is incomplete work to place. */}
          {hasIncomplete && (
            <fieldset className="flex flex-col gap-2">
              <legend className={`${LABEL_CLS} mb-2`}>Issues incompletas vão para</legend>

              <RadioRow
                name="sprint-close-target"
                checked={kind === 'backlog'}
                onSelect={() => setKind('backlog')}
                icon={<ArchiveRestore className="h-4 w-4" />}
                title="Voltar ao backlog"
                subtitle="Retornam à fila geral, sem sprint"
              />

              <RadioRow
                name="sprint-close-target"
                checked={kind === 'sprint'}
                onSelect={() => setKind('sprint')}
                disabled={!hasNextSprints}
                icon={<ArrowRightLeft className="h-4 w-4" />}
                title="Mover para outro sprint"
                subtitle={
                  hasNextSprints
                    ? 'Entram em um sprint ainda em planejamento'
                    : 'Nenhum sprint em planejamento disponível'
                }
              />

              {/* Sprint sub-picker — revealed when carry-over is chosen. */}
              {kind === 'sprint' && hasNextSprints && (
                <div className="ml-3 mt-0.5 flex flex-col gap-1 border-l border-[var(--mtech-border)] pl-3">
                  {nextSprints.map((s) => {
                    const selected = sprintId === s.id;
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-[var(--mtech-radius-sm)] px-2.5 py-1.5 transition-colors hover:bg-[var(--mtech-surface-elev)]"
                      >
                        <input
                          type="radio"
                          name="sprint-close-destination"
                          className="sr-only"
                          checked={selected}
                          onChange={() => setSprintId(s.id)}
                        />
                        <span
                          aria-hidden
                          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border transition-colors"
                          style={{
                            borderColor: selected
                              ? 'var(--mtech-accent)'
                              : 'var(--mtech-border-strong)',
                          }}
                        >
                          {selected && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: 'var(--mtech-accent)' }}
                            />
                          )}
                        </span>
                        <span
                          className="truncate text-[13px]"
                          style={{
                            color: selected ? 'var(--mtech-text)' : 'var(--mtech-text-muted)',
                          }}
                        >
                          {s.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={confirmDisabled}
            onClick={() => onConfirm(resolvedTarget)}
            className="border border-[color-mix(in_srgb,var(--mtech-danger)_38%,transparent)] bg-[color-mix(in_srgb,var(--mtech-danger)_13%,transparent)] font-semibold text-[var(--mtech-danger)] hover:bg-[color-mix(in_srgb,var(--mtech-danger)_22%,transparent)] hover:text-[var(--mtech-danger)]"
          >
            {isPending
              ? 'Fechando...'
              : hasIncomplete
                ? `Fechar e mover ${countLabel(incompleteCount, 'issue', 'issues')}`
                : 'Fechar sprint'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SummaryStat — one half of the close split: a number, what it is, what
// happens to it.
// ---------------------------------------------------------------------------

function SummaryStat({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  hint: string;
  tone: 'success' | 'muted';
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-bg)] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span
          data-mono
          className="text-[16px] font-semibold leading-none tabular-nums text-[var(--mtech-text)]"
        >
          {value}
        </span>
        <span className="text-[12px] text-[var(--mtech-text-muted)]">{label}</span>
      </div>
      <span
        className="text-[10px] uppercase tracking-[0.1em]"
        style={{
          color: tone === 'success' ? 'var(--mtech-success)' : 'var(--mtech-text-subtle)',
        }}
      >
        {hint}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RadioRow — a primary destination option. Native radio for keyboard + a11y;
// the visual is ours.
// ---------------------------------------------------------------------------

function RadioRow({
  name,
  checked,
  onSelect,
  icon,
  title,
  subtitle,
  disabled = false,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-[var(--mtech-radius-md)] border px-3 py-2.5 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-[var(--mtech-border-strong)]'
      }`}
      style={{
        borderColor: checked ? 'var(--mtech-accent)' : 'var(--mtech-border)',
        background: checked ? 'var(--mtech-accent-muted)' : 'var(--mtech-bg)',
      }}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: checked ? 'var(--mtech-accent)' : 'var(--mtech-border-strong)',
        }}
      >
        {checked && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--mtech-accent)' }}
          />
        )}
      </span>
      <span
        className="flex-shrink-0"
        style={{ color: checked ? 'var(--mtech-accent)' : 'var(--mtech-text-muted)' }}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-[var(--mtech-text)]">{title}</span>
        <span className="text-[11px] text-[var(--mtech-text-subtle)]">{subtitle}</span>
      </span>
    </label>
  );
}
