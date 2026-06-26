import { Gauge } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useProfileMap } from '../hooks/useProfiles';
import { useTechTeamCurrentLoad } from '../hooks/useTechTeamCurrentLoad';
import type { DevLoad } from '../lib/teamLoad';
import { DevAvatar } from './DevAvatar';

// ---------------------------------------------------------------------------
// CurrentLoadPanel (#165) — open work, right now, on the ACTIVE sprint.
//
// Where throughput is history, this is the live tell: who is carrying what, and
// who is carrying too much. Bar width is open_points scaled to the heaviest dev
// (the peak = full width), so the picture is relative distribution at a glance.
//
// Two orthogonal signals, deliberately encoded on different channels so they
// can stack without fighting:
//   • overload (colour) — the bar turns from gold to danger. The lib only sets
//     this when the signal is real (≥3 devs, strictly above the median, >0),
//     so the colour never cries wolf on a two-person sprint.
//   • peak (marker)     — the single heaviest dev wears a "PICO" tag. It exists
//     even below the overload quorum; it is "the top", not "too much".
//
// The median is drawn as one honest vertical rule across every bar — the bar's
// length only means something against where the middle of the team sits. The
// legend restates it as a figure so the line is never a mystery mark.
// ---------------------------------------------------------------------------

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

const PANEL_CLS =
  'rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]';

const TAG_CLS =
  'inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] select-none';

function issuesLabel(n: number): string {
  return n === 1 ? 'issue' : 'issues';
}

// ---------------------------------------------------------------------------
// Row — one developer's open-work bar.
// ---------------------------------------------------------------------------

function DevLoadRow({
  dev,
  name,
  maxPoints,
  medianPct,
  animate,
}: {
  dev: DevLoad;
  name: string | null;
  maxPoints: number;
  medianPct: number;
  animate: boolean;
}) {
  const displayName = name ?? 'Usuário removido';
  const pct = maxPoints > 0 ? Math.max((dev.open_points / maxPoints) * 100, dev.open_points > 0 ? 3 : 0) : 0;

  const barBg = dev.isOverloaded
    ? 'linear-gradient(90deg, rgba(229,72,77,0.85) 0%, rgba(229,72,77,0.55) 100%)'
    : 'linear-gradient(90deg, rgba(244,196,48,0.9) 0%, rgba(244,196,48,0.55) 100%)';

  return (
    <div className="flex items-center gap-3 px-2 py-2">
      {/* Identity */}
      <div className="flex w-[150px] flex-shrink-0 items-center gap-2">
        <DevAvatar name={name} size={28} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-[var(--mtech-text)]" title={displayName}>
            {displayName}
          </span>
          {(dev.isPeak || dev.isOverloaded) && (
            <span className="flex items-center gap-1">
              {dev.isPeak && (
                <span
                  className={TAG_CLS}
                  style={{ color: 'var(--mtech-accent)', backgroundColor: 'var(--mtech-accent-muted)' }}
                >
                  Pico
                </span>
              )}
              {dev.isOverloaded && (
                <span
                  className={TAG_CLS}
                  style={{ color: 'var(--mtech-danger)', backgroundColor: 'rgba(229,72,77,0.14)' }}
                >
                  Sobrecarga
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Bar track + median rule */}
      <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-[var(--mtech-radius-sm)] bg-[rgba(255,255,255,0.04)]">
        <motion.div
          className="h-full rounded-[var(--mtech-radius-sm)]"
          style={{ background: barBg }}
          initial={animate ? { width: 0 } : false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        />
        {medianPct > 0 && medianPct < 100 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-[var(--mtech-text)] opacity-30"
            style={{ left: `${medianPct}%` }}
          />
        )}
      </div>

      {/* Figures */}
      <div className="flex w-[110px] flex-shrink-0 items-baseline justify-end gap-3">
        <span className="text-[11px] tabular-nums text-[var(--mtech-text-subtle)]" data-mono>
          {dev.open_issues} {issuesLabel(dev.open_issues)}
        </span>
        <span className="flex items-baseline gap-1">
          <span
            data-mono
            className="text-[15px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
            style={{ color: dev.isOverloaded ? 'var(--mtech-danger)' : 'var(--mtech-text)' }}
          >
            {dev.open_points}
          </span>
          <span className="text-[10px] text-[var(--mtech-text-subtle)]">
            {dev.open_points === 1 ? 'pt' : 'pts'}
          </span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading.
// ---------------------------------------------------------------------------

function LoadEmpty() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
      <Gauge className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Nenhuma carga ativa</p>
        <p className="max-w-[260px] text-xs text-[var(--mtech-text-subtle)]">
          A distribuição aparece quando há um sprint ativo com trabalho aberto atribuído
        </p>
      </div>
    </div>
  );
}

function LoadSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 pb-3 pt-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <div className="flex w-[150px] flex-shrink-0 items-center gap-2">
            <div className="h-7 w-7 flex-shrink-0 rounded-full bg-[var(--mtech-surface-elev)]" />
            <div className="h-4 flex-1 rounded bg-[var(--mtech-surface-elev)]" />
          </div>
          <div
            className="h-7 flex-1 rounded-[var(--mtech-radius-sm)] bg-[var(--mtech-surface-elev)]"
            style={{ opacity: 1 - i * 0.18 }}
          />
          <div className="h-4 w-[64px] flex-shrink-0 rounded bg-[var(--mtech-surface-elev)]" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel.
// ---------------------------------------------------------------------------

export function CurrentLoadPanel({ className = '' }: { className?: string }) {
  const { distribution, isLoading } = useTechTeamCurrentLoad();
  const profileMap = useProfileMap();
  const prefersReduced = useReducedMotion();

  const { devs, median } = distribution;
  const maxPoints = devs.length > 0 ? devs[0].open_points : 0;
  const medianPct = maxPoints > 0 ? (median / maxPoints) * 100 : 0;
  const overloadedCount = devs.filter((d) => d.isOverloaded).length;

  return (
    <section className={`${PANEL_CLS} ${className}`} aria-label="Carga atual por desenvolvedor">
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLS}>Carga atual</span>
          <span className="text-[13px] text-[var(--mtech-text-muted)]">
            Trabalho aberto no sprint ativo
          </span>
        </div>
        {!isLoading && devs.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--mtech-text-subtle)]">
              <span
                aria-hidden
                className="inline-block h-3 w-px bg-[var(--mtech-text)] opacity-40"
              />
              Mediana{' '}
              <span data-mono className="tabular-nums text-[var(--mtech-text-muted)]">
                {median}
              </span>{' '}
              {median === 1 ? 'pt' : 'pts'}
            </span>
            {overloadedCount > 0 && (
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--mtech-danger)' }} data-mono>
                {overloadedCount} sobrecarregado{overloadedCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </header>

      {isLoading ? (
        <LoadSkeleton />
      ) : devs.length === 0 ? (
        <LoadEmpty />
      ) : (
        <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
          {devs.map((dev) => (
            <DevLoadRow
              key={dev.assignee_id}
              dev={dev}
              name={profileMap[dev.assignee_id] ?? null}
              maxPoints={maxPoints}
              medianPct={medianPct}
              animate={!prefersReduced}
            />
          ))}
        </div>
      )}
    </section>
  );
}
