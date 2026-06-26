import { useState } from 'react';
import { Link2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  EpicDemandaField,
  type DemandaOption,
  type DemandaScope,
} from './EpicDemandaField';

// ---------------------------------------------------------------------------
// EpicDemandaLink (#159) — the demand link as it lives ON an existing epic.
//
// Two faces, one component:
//   • linked   → a compact metadata chip (◷ link glyph · demanda title · status)
//                that sits on the epic identity line. Click → relink/unlink.
//   • unlinked → a quiet "Vincular demanda" ghost affordance (only ever shown
//                for client-scoped projects — internal renders nothing).
//
// Editing reuses the exact create-time atom (EpicDemandaField) inside a Popover,
// so the relink experience is byte-identical to the picker the creator saw.
// Selection persists immediately (inline-edit, Linear-style) and closes — no
// save button for a one-field change.
//
// Controlled + pure presentational: the host owns persistence (useUpdateEpic).
// `current` is the resolved option for display; `options` feeds the picker.
// ---------------------------------------------------------------------------

export interface EpicDemandaLinkProps {
  scope: DemandaScope;
  /** The currently linked demand, resolved for display. null = unlinked. */
  current: DemandaOption | null;
  /** Selectable demands for the project's client (scope=ready). */
  options: DemandaOption[];
  onChange: (demandaId: string | null) => void;
  isSaving?: boolean;
  className?: string;
}

function humanizeStatus(raw: string): string {
  const s = raw.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function EpicDemandaLink({
  scope,
  current,
  options,
  onChange,
  isSaving = false,
  className = '',
}: EpicDemandaLinkProps) {
  const [open, setOpen] = useState(false);

  // Internal projects can't link — show nothing on the header.
  if (scope === 'internal' && !current) return null;

  function handleChange(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  const trigger = current ? (
    <button
      type="button"
      aria-label={`Demanda vinculada: ${current.titulo}. Editar vínculo.`}
      className="group/dlink inline-flex h-[22px] min-w-0 max-w-[180px] items-center gap-1.5 rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] pl-2 pr-2.5 text-[11px] text-[var(--mtech-text-muted)] transition-colors hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] sm:max-w-[260px]"
    >
      <Link2 className="h-3 w-3 flex-shrink-0 text-[var(--mtech-text-subtle)]" strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 truncate font-medium">{current.titulo}</span>
      <span className="flex-shrink-0 text-[var(--mtech-text-subtle)]">·</span>
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--mtech-text-subtle)]">
        {humanizeStatus(current.status)}
      </span>
    </button>
  ) : (
    <button
      type="button"
      className="inline-flex h-[22px] items-center gap-1 rounded-full border border-dashed border-[var(--mtech-border)] bg-transparent px-2 text-[11px] font-medium text-[var(--mtech-text-subtle)] transition-colors hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
    >
      <Plus className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} aria-hidden />
      Vincular demanda
    </button>
  );

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="mtech-scope w-[320px] border-[var(--mtech-border-strong)] bg-[var(--mtech-surface)] p-3"
          style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}
        >
          <EpicDemandaField
            scope={scope}
            options={options}
            value={current?.id ?? null}
            onChange={handleChange}
            disabled={isSaving}
            hideOptionalTag
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
