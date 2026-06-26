import { useMemo, useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTechBillingHours, type BillingHoursRow } from '../hooks/useTechBillingHours';
import { formatTimeTotal } from '../hooks/useTechTimeTotals';

// ---------------------------------------------------------------------------
// BillingHoursPanel (#164) — hours per client in a billing window, drill by
// project. The RPC clips each timer interval to [start, end] at project grain;
// this panel groups those project rows into one bar per client (NULL client →
// an explicit "Sem cliente" bucket for internal/unattributed work) and lets each
// client expand to its constituent projects.
//
// Billing is a monthly ritual, so the window control leads with presets — the
// current month (open-ended, always live) and the previous month (closed, the
// one you actually invoice) cover the exec's reach in one click. "Personalizado"
// reveals the raw date inputs for the off-cadence question. The resolved window
// is always restated as a readable month label so the period reads at a glance.
// ---------------------------------------------------------------------------

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

const PANEL_CLS =
  'rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]';

const DATE_INPUT_CLS =
  'rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] px-2 py-1 text-xs text-[var(--mtech-text)] [color-scheme:dark] focus:border-[var(--mtech-border-strong)] focus:outline-none';

// Segmented control — track is the same recessed wash as the bar tracks, so the
// active pill reads as a raised surface lifting out of it. Mirrors the dark
// segmented idiom (Linear/Stripe) without inventing a new control.
const SEG_WRAP_CLS =
  'inline-flex items-center gap-0.5 rounded-[var(--mtech-radius-sm)] bg-[rgba(255,255,255,0.04)] p-0.5';

function segBtnCls(active: boolean): string {
  return [
    'rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-border-strong)]',
    active
      ? 'bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)] shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
      : 'text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-text-muted)]',
  ].join(' ');
}

type Preset = 'current' | 'previous' | 'custom';

interface ClientGroup {
  clientId: string | null;
  clientName: string;
  totalSeconds: number;
  issueCount: number;
  projects: BillingHoursRow[];
}

const NO_CLIENT_LABEL = 'Sem cliente';

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstOfMonthISODate(now: Date): string {
  return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** "Junho 2026" — capitalised pt-BR month + year. */
function monthLabel(d: Date): string {
  const raw = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Resolve a preset (or the custom inputs) into the RPC window + a readable label. */
function resolveWindow(
  preset: Preset,
  customStart: string,
  customEnd: string,
): { start: string; end: string; label: string } {
  const now = new Date();
  if (preset === 'previous') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 of this month = last of prev
    return { start: isoDate(prev), end: isoDate(last), label: monthLabel(prev) };
  }
  if (preset === 'custom') {
    return { start: customStart, end: customEnd, label: 'Período personalizado' };
  }
  // current — open-ended so the live month always reads without a second date.
  return { start: firstOfMonthISODate(now), end: '', label: monthLabel(now) };
}

/** Group project rows into client buckets, projects + clients sorted by seconds DESC. */
function rollupByClient(rows: BillingHoursRow[]): ClientGroup[] {
  const byClient = new Map<string, ClientGroup>();

  for (const row of rows) {
    const key = row.client_id ?? '__none__';
    let group = byClient.get(key);
    if (!group) {
      group = {
        clientId: row.client_id,
        clientName: row.client_name ?? NO_CLIENT_LABEL,
        totalSeconds: 0,
        issueCount: 0,
        projects: [],
      };
      byClient.set(key, group);
    }
    group.totalSeconds += row.total_seconds;
    group.issueCount += row.issue_count;
    group.projects.push(row);
  }

  const groups = Array.from(byClient.values());
  for (const g of groups) g.projects.sort((a, b) => b.total_seconds - a.total_seconds);
  groups.sort((a, b) => b.totalSeconds - a.totalSeconds);
  return groups;
}

function hoursLabel(seconds: number): string {
  return formatTimeTotal(seconds) || '0h';
}

function ClientRow({
  group,
  maxSeconds,
  animate,
}: {
  group: ClientGroup;
  maxSeconds: number;
  animate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pct = maxSeconds > 0 ? Math.max((group.totalSeconds / maxSeconds) * 100, group.totalSeconds > 0 ? 3 : 0) : 0;
  const expandable = group.projects.length > 1;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={`flex items-center gap-3 rounded-[var(--mtech-radius-sm)] px-2 py-2 text-left transition-colors ${
          expandable ? 'cursor-pointer hover:bg-[var(--mtech-surface-elev)]' : 'cursor-default'
        }`}
        aria-expanded={expandable ? open : undefined}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--mtech-text-subtle)] transition-transform ${
            open ? 'rotate-90' : ''
          } ${expandable ? '' : 'opacity-0'}`}
          aria-hidden
        />

        <div className="flex w-[150px] min-w-0 flex-shrink-0 flex-col gap-0.5">
          <span
            className="truncate text-sm font-medium text-[var(--mtech-text)]"
            style={group.clientId === null ? { color: 'var(--mtech-text-muted)' } : undefined}
            title={group.clientName}
          >
            {group.clientName}
          </span>
          <span className="text-[10px] tabular-nums text-[var(--mtech-text-subtle)]" data-mono>
            {group.projects.length} {group.projects.length === 1 ? 'projeto' : 'projetos'}
          </span>
        </div>

        <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-[var(--mtech-radius-sm)] bg-[rgba(255,255,255,0.04)]">
          <motion.div
            className="h-full rounded-[var(--mtech-radius-sm)]"
            style={{
              background: 'linear-gradient(90deg, rgba(244,196,48,0.9) 0%, rgba(244,196,48,0.5) 100%)',
            }}
            initial={animate ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <span
          data-mono
          className="w-[72px] flex-shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--mtech-text)]"
        >
          {hoursLabel(group.totalSeconds)}
        </span>
      </button>

      {open && expandable && (
        <div className="flex flex-col gap-px pb-1 pl-7 pr-[84px]">
          {group.projects.map((p) => (
            <div
              key={p.project_id}
              className="flex items-center justify-between gap-3 rounded-[var(--mtech-radius-sm)] px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--mtech-text-muted)]" title={p.project_name}>
                {p.project_name}
              </span>
              <span data-mono className="flex-shrink-0 text-[11px] tabular-nums text-[var(--mtech-text-subtle)]">
                {hoursLabel(p.total_seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BillingEmpty() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
      <Clock className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Nenhuma hora no período</p>
        <p className="max-w-[260px] text-xs text-[var(--mtech-text-subtle)]">
          As horas por cliente aparecem quando há tempo cronometrado dentro da janela selecionada
        </p>
      </div>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 pb-3 pt-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <div className="h-3.5 w-3.5 flex-shrink-0" />
          <div className="h-4 w-[150px] flex-shrink-0 rounded bg-[var(--mtech-surface-elev)]" />
          <div
            className="h-7 flex-1 rounded-[var(--mtech-radius-sm)] bg-[var(--mtech-surface-elev)]"
            style={{ opacity: 1 - i * 0.18 }}
          />
          <div className="h-4 w-[72px] flex-shrink-0 rounded bg-[var(--mtech-surface-elev)]" />
        </div>
      ))}
    </div>
  );
}

export function BillingHoursPanel({ className = '' }: { className?: string }) {
  const prefersReduced = useReducedMotion();
  const [preset, setPreset] = useState<Preset>('current');
  const [customStart, setCustomStart] = useState<string>(() => firstOfMonthISODate(new Date()));
  const [customEnd, setCustomEnd] = useState<string>('');

  const { start, end, label: periodLabel } = useMemo(
    () => resolveWindow(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );

  const { data, isLoading } = useTechBillingHours({
    start: start || null,
    end: end || null,
  });

  const groups = useMemo(() => rollupByClient(data ?? []), [data]);
  const maxSeconds = groups.length > 0 ? groups[0].totalSeconds : 0;
  const totalSeconds = useMemo(() => groups.reduce((sum, g) => sum + g.totalSeconds, 0), [groups]);

  return (
    <section className={`${PANEL_CLS} ${className}`} aria-label="Horas faturáveis por cliente">
      <header className="flex flex-col gap-3 px-5 pt-5 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className={LABEL_CLS}>Horas por cliente</span>
            <span className="text-[13px] text-[var(--mtech-text-muted)]">
              Tempo cronometrado no período, por cliente
            </span>
          </div>
          {!isLoading && groups.length > 0 && (
            <div className="flex flex-col items-end gap-0.5">
              <span className={LABEL_CLS}>Total</span>
              <span
                data-mono
                className="text-[15px] font-semibold leading-none tabular-nums text-[var(--mtech-accent)]"
              >
                {hoursLabel(totalSeconds)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className={SEG_WRAP_CLS} role="group" aria-label="Janela de faturamento">
            <button
              type="button"
              onClick={() => setPreset('current')}
              className={segBtnCls(preset === 'current')}
              aria-pressed={preset === 'current'}
            >
              Mês atual
            </button>
            <button
              type="button"
              onClick={() => setPreset('previous')}
              className={segBtnCls(preset === 'previous')}
              aria-pressed={preset === 'previous'}
            >
              Mês anterior
            </button>
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={segBtnCls(preset === 'custom')}
              aria-pressed={preset === 'custom'}
            >
              Personalizado
            </button>
          </div>

          {preset === 'custom' ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--mtech-text-subtle)]">
                De
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className={DATE_INPUT_CLS}
                  aria-label="Início do período"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--mtech-text-subtle)]">
                Até
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className={DATE_INPUT_CLS}
                  aria-label="Fim do período"
                />
              </label>
            </div>
          ) : (
            <span
              data-mono
              className="text-[11px] tabular-nums text-[var(--mtech-text-muted)]"
              aria-label="Período selecionado"
            >
              {periodLabel}
            </span>
          )}
        </div>
      </header>

      {isLoading ? (
        <BillingSkeleton />
      ) : groups.length === 0 ? (
        <BillingEmpty />
      ) : (
        <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
          {groups.map((group) => (
            <ClientRow
              key={group.clientId ?? '__none__'}
              group={group}
              maxSeconds={maxSeconds}
              animate={!prefersReduced}
            />
          ))}
        </div>
      )}
    </section>
  );
}
