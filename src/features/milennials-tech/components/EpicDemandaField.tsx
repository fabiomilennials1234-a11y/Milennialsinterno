import { Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { epicColorFromKey } from '../lib/issueSystem';

// ---------------------------------------------------------------------------
// EpicDemandaField (#159) — the labeled demand picker block.
//
// The atom of the Epic↔Demanda link. Mirrors the conditional Client <Select>
// in ProjectFormModal verbatim (same input chrome, same `__none__` = no link),
// then earns its keep on the one axis that differs: a demand only exists in the
// context of a client, so the field is SCOPED and self-explains all three
// shapes that scope can take —
//
//   • ready    → client project with demands → the Select.
//   • empty    → client project, zero demands → disabled Select, honest copy.
//   • internal → project has no client → no demand can exist → a locked note,
//                never a silent gap. (The create modal also omits the block
//                outright for internal — this is the defensive fallback.)
//
// Domain invariant (arquiteto): demanda.do_cliente(project.client_id). The host
// resolves the scope + options; this stays pure presentational — options in,
// onChange(demandaId | null) out. No fetching.
// ---------------------------------------------------------------------------

export type DemandaScope = 'ready' | 'empty' | 'internal';

export interface DemandaOption {
  id: string;
  /** Demand title, e.g. "Reformular landing de planos". */
  titulo: string;
  /** Raw domain status (e.g. "em_andamento"). Humanized for display. */
  status: string;
  /** Domain the demand lives in (e.g. "design", "dev", "video"). */
  dominio: string;
}

export interface EpicDemandaFieldProps {
  /** Resolved scope for this epic's project. Drives which shape renders. */
  scope: DemandaScope;
  /** Selectable demands for the project's client. Ignored unless scope=ready. */
  options: DemandaOption[];
  /** Currently linked demand id, or null for "Sem demanda". */
  value: string | null;
  onChange: (demandaId: string | null) => void;
  disabled?: boolean;
  /** Hide the optional tag (e.g. when the host frames it differently). */
  hideOptionalTag?: boolean;
  className?: string;
}

const NONE = '__none__';

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
const optionalCls = 'font-normal normal-case tracking-normal text-[var(--mtech-text-subtle)]';
const selectContentCls =
  'mtech-scope bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

/** Title-case a raw status token: "em_andamento" → "Em andamento". */
function humanizeStatus(raw: string): string {
  const s = raw.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A demand's status is a foreign vocabulary to mtech — render it as an honest
// outline pill (no fake semantic color we can't guarantee, and transparent so
// it reads on BOTH the input-bg trigger and the surface-elev dropdown). The
// dominio gets a small categorical dot via the shared epic palette so two
// demands in different domains read apart at a glance.
// TODO(eng): if a canonical demanda-status config exists, map tone/label here.
function StatusChip({ status }: { status: string }) {
  return (
    <span className="inline-flex h-[18px] flex-shrink-0 items-center rounded-full border border-[var(--mtech-border)] px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--mtech-text-subtle)] select-none">
      {humanizeStatus(status)}
    </span>
  );
}

function DemandaRow({ d }: { d: DemandaOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: epicColorFromKey(d.dominio) }}
      />
      <span className="min-w-0 truncate text-[13px] text-[var(--mtech-text)]">{d.titulo}</span>
      <StatusChip status={d.status} />
    </span>
  );
}

export function EpicDemandaField({
  scope,
  options,
  value,
  onChange,
  disabled = false,
  hideOptionalTag = false,
  className = '',
}: EpicDemandaFieldProps) {
  const selected = value ? options.find((o) => o.id === value) ?? null : null;

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className={labelCls}>
        Demanda{' '}
        {!hideOptionalTag && <span className={optionalCls}>opcional</span>}
      </Label>

      {scope === 'internal' ? (
        // Locked note — a demand can't exist without a client. Never a blank gap.
        <div className="flex items-center gap-2 rounded-[var(--mtech-radius-sm)] border border-dashed border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text-subtle)]">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} aria-hidden />
          <span>Projeto interno — sem demanda de cliente para vincular.</span>
        </div>
      ) : (
        <>
          <Select
            value={value ?? NONE}
            onValueChange={(v) => onChange(v === NONE ? null : v)}
            disabled={disabled || scope === 'empty'}
          >
            <SelectTrigger className={inputCls} aria-label="Vincular demanda do cliente">
              <SelectValue
                placeholder={scope === 'empty' ? 'Cliente ainda sem demandas' : 'Vincular demanda'}
              >
                {selected && <DemandaRow d={selected} />}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={`${selectContentCls} max-h-60`}>
              <SelectItem value={NONE}>
                <span className="text-[13px] text-[var(--mtech-text-muted)]">Sem demanda</span>
              </SelectItem>
              {options.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <DemandaRow d={d} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {scope === 'empty' && (
            <p className="text-[11px] leading-relaxed text-[var(--mtech-text-subtle)]">
              Este cliente ainda não tem demandas abertas. O epic segue sem vínculo até existir uma.
            </p>
          )}
        </>
      )}
    </div>
  );
}
