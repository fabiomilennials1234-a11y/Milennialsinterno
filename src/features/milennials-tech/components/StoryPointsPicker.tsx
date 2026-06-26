import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FIBONACCI, type StoryPointValue } from '../lib/issueSystem';

// ---------------------------------------------------------------------------
// StoryPointsPicker — editable Fibonacci estimate for an *existing* issue.
//
// The editable sibling of StoryPoints (display) and the inline picker baked
// into IssueCreateModal. The trigger IS the points pill: same shape/size as
// the read-only <StoryPoints>, so a row reads identically until you touch it.
// Click → popover with the Fibonacci scale (1·2·3·5·8·13). Pick → onChange →
// close. The current value reads as active in the grid and the trigger glows
// gold while open, so the pill announces "this number is live, and editable".
//
// Why no "clear"/"remove": the backend RPC sets points via COALESCE and cannot
// write null (hard constraint). Offering an unset affordance the server can't
// honour would be a lie in the UI, so the picker only ever *sets* a Fibonacci
// value. An unestimated issue still shows a dash trigger you can click to set.
//
// Pure presentational + local open state. No data-fetching, no mutation — the
// engineer wires `onChange` to the RPC and toggles `disabled` while it's
// in-flight. Engineer pairs against StoryPointsPickerProps below (the contract).
// ---------------------------------------------------------------------------

export interface StoryPointsPickerProps {
  /** Current estimate. `null` renders a faint dash trigger (unestimated). */
  value: number | null;
  /**
   * Called with the chosen Fibonacci value. Never called with `null` — the
   * picker cannot unset (see header). Fires only on an actual change of value.
   */
  onChange: (value: StoryPointValue) => void;
  /** Freezes the trigger and the grid while a mutation is in flight. */
  disabled?: boolean;
  /** Trigger pill size. Mirrors <StoryPoints>. Default 'sm' (IssueRow density). */
  size?: 'sm' | 'md';
  /** Extra classes on the trigger pill (e.g. flex-shrink-0 in a meta cluster). */
  triggerClassName?: string;
  /** Popover edge alignment to the trigger. Default 'end' (right-anchored). */
  align?: 'start' | 'center' | 'end';
}

const TRIGGER_SIZE = {
  sm: 'h-[18px] min-w-[18px] px-1 text-[10px]',
  md: 'h-5 min-w-5 px-1.5 text-[11px]',
} as const;

export function StoryPointsPicker({
  value,
  onChange,
  disabled = false,
  size = 'sm',
  triggerClassName = '',
  align = 'end',
}: StoryPointsPickerProps) {
  const [open, setOpen] = useState(false);
  const empty = value === null || value === undefined;

  const triggerLabel = empty
    ? 'Definir estimativa'
    : `Estimativa: ${value} ${value === 1 ? 'ponto' : 'pontos'} — editar`;

  function select(n: StoryPointValue) {
    if (n !== value) onChange(n);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-mono
          disabled={disabled}
          aria-label={triggerLabel}
          title={triggerLabel}
          // The row owns onClick (opens the issue) — never let the pick bubble.
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={`inline-flex items-center justify-center rounded-full border font-semibold tabular-nums transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] disabled:cursor-not-allowed disabled:opacity-50 border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text-muted)] enabled:hover:border-[var(--mtech-border-strong)] enabled:hover:text-[var(--mtech-text)] data-[state=open]:border-[var(--mtech-accent)]/50 data-[state=open]:bg-[var(--mtech-accent-muted)] data-[state=open]:text-[var(--mtech-accent)] ${TRIGGER_SIZE[size]} ${triggerClassName}`}
        >
          {empty ? '–' : value}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="mtech-scope w-auto border-[var(--mtech-border-strong)] bg-[var(--mtech-surface)] p-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-baseline justify-between gap-6 px-0.5">
          <span className="text-[11px] font-semibold tracking-[0.02em] text-[var(--mtech-text)]">
            Estimativa
          </span>
          <span className="text-[10px] font-medium tracking-[0.04em] text-[var(--mtech-text-subtle)] uppercase">
            Fibonacci
          </span>
        </div>

        {/* Ascending scale, left→right — Fibonacci reads as a magnitude, not a menu. */}
        <div role="group" aria-label="Pontos de estimativa" className="flex gap-1.5">
          {FIBONACCI.map((n) => {
            const active = value === n;
            return (
              <button
                key={n}
                type="button"
                data-mono
                disabled={disabled}
                aria-pressed={active}
                aria-label={`${n} ${n === 1 ? 'ponto' : 'pontos'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  select(n);
                }}
                className={`flex h-8 min-w-9 items-center justify-center rounded-[var(--mtech-radius-sm)] border px-2 text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'border-[var(--mtech-accent)]/50 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
                    : 'border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] enabled:hover:border-[var(--mtech-border-strong)] enabled:hover:text-[var(--mtech-text)]'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
