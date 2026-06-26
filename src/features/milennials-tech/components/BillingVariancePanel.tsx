import { useMemo, useState } from 'react';
import { ChevronRight, Scale } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useBacklogIssues } from '../hooks/useTechIssues';
import { useTechTimeTotals, formatTimeTotal } from '../hooks/useTechTimeTotals';
import { buildBillingVariance, type IssueVariance, type ProjectVariance } from '../lib/billingVariance';

// ---------------------------------------------------------------------------
// BillingVariancePanel (#164) — estimated (story points) × real (timer hours)
// per project and issue, all-time.
//
// There is NO canonical points→hours conversion, so we never fake one. The
// single honest cross is secondsPerPoint — how much measured effort each
// estimated point actually cost. A high value is an overrun signal; an issue
// with no estimate can't produce the ratio at all and is flagged "não estimado"
// rather than charted as a phantom zero. Projects rank by cost-per-point DESC so
// the heaviest overruns lead. Estimate and real are sourced from the canonical
// #160 base via buildBillingVariance — this panel never re-derives them.
//
// Real time is direct, top-level only (useBacklogIssues returns parent issues;
// sub-tasks carry no points). Sub-task timer seconds therefore do not roll into
// the parent here — that is a known, documented simplification; the
// authoritative billable total lives in the hours panel's RPC rollup.
// ---------------------------------------------------------------------------

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

const PANEL_CLS =
  'rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]';

const TAG_CLS =
  'inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] select-none';

interface ProjectRow extends ProjectVariance {
  projectName: string;
  issues: IssueVariance[];
}

interface IssueMeta {
  title: string;
  key: string | null;
}

function costPerPointLabel(secondsPerPoint: number | null): string {
  if (secondsPerPoint === null) return '—';
  return `${formatTimeTotal(Math.round(secondsPerPoint)) || '0s'} / pt`;
}

// Overrun heuristic, shared by the row colour and the header tally so the
// "N overrun" count can never disagree with the rows it is summarising:
// a real cost-per-point ratio sitting in the heaviest third of the field.
function isOverrunCost(cost: number, maxCost: number): boolean {
  return maxCost > 0 && cost > 0 && cost >= maxCost * 0.66;
}

function IssueDetail({ issue, meta }: { issue: IssueVariance; meta: IssueMeta | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--mtech-radius-sm)] px-2 py-1.5">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {meta?.key && (
          <span data-mono className="flex-shrink-0 text-[10px] tabular-nums text-[var(--mtech-text-subtle)]">
            {meta.key}
          </span>
        )}
        <span className="truncate text-xs text-[var(--mtech-text-muted)]" title={meta?.title ?? issue.issueId}>
          {meta?.title ?? 'Issue'}
        </span>
        {issue.unestimated && (
          <span
            className={TAG_CLS}
            style={{ color: 'var(--mtech-text-subtle)', backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            Não estimado
          </span>
        )}
      </span>

      <span className="flex flex-shrink-0 items-baseline gap-3">
        <span data-mono className="text-[11px] tabular-nums text-[var(--mtech-text-subtle)]">
          {issue.unestimated ? '—' : `${issue.estimatedPoints} pt`}
        </span>
        <span data-mono className="w-[52px] text-right text-[11px] tabular-nums text-[var(--mtech-text-muted)]">
          {formatTimeTotal(issue.realSeconds) || '0s'}
        </span>
        <span
          data-mono
          className="w-[88px] text-right text-[11px] tabular-nums"
          style={{ color: issue.unestimated ? 'var(--mtech-text-subtle)' : 'var(--mtech-text)' }}
        >
          {costPerPointLabel(issue.secondsPerPoint)}
        </span>
      </span>
    </div>
  );
}

function ProjectVarianceRow({
  row,
  maxCost,
  issueMeta,
  animate,
}: {
  row: ProjectRow;
  maxCost: number;
  issueMeta: Map<string, IssueMeta>;
  animate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cost = row.secondsPerPoint ?? 0;
  const pct = maxCost > 0 ? Math.max((cost / maxCost) * 100, cost > 0 ? 3 : 0) : 0;
  const isOverrun = isOverrunCost(cost, maxCost);

  const barBg = isOverrun
    ? 'linear-gradient(90deg, rgba(229,72,77,0.85) 0%, rgba(229,72,77,0.5) 100%)'
    : 'linear-gradient(90deg, rgba(244,196,48,0.9) 0%, rgba(244,196,48,0.5) 100%)';

  const sortedIssues = useMemo(
    () =>
      [...row.issues].sort((a, b) => {
        // Unestimated last; otherwise heaviest cost-per-point first.
        if (a.unestimated !== b.unestimated) return a.unestimated ? 1 : -1;
        return (b.secondsPerPoint ?? 0) - (a.secondsPerPoint ?? 0);
      }),
    [row.issues],
  );

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-[var(--mtech-radius-sm)] px-2 py-2 text-left transition-colors hover:bg-[var(--mtech-surface-elev)]"
        aria-expanded={open}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--mtech-text-subtle)] transition-transform ${
            open ? 'rotate-90' : ''
          }`}
          aria-hidden
        />

        <div className="flex w-[150px] min-w-0 flex-shrink-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-[var(--mtech-text)]" title={row.projectName}>
            {row.projectName}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] tabular-nums text-[var(--mtech-text-subtle)]" data-mono>
            {row.totalPoints} pt · {formatTimeTotal(row.totalSeconds) || '0s'}
            {row.unestimatedCount > 0 && (
              <span style={{ color: 'var(--mtech-text-subtle)' }}>· {row.unestimatedCount} s/ est.</span>
            )}
          </span>
        </div>

        <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-[var(--mtech-radius-sm)] bg-[rgba(255,255,255,0.04)]">
          <motion.div
            className="h-full rounded-[var(--mtech-radius-sm)]"
            style={{ background: barBg }}
            initial={animate ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="flex w-[92px] flex-shrink-0 flex-col items-end gap-0.5">
          <span
            data-mono
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: isOverrun ? 'var(--mtech-danger)' : 'var(--mtech-text)' }}
          >
            {costPerPointLabel(row.secondsPerPoint)}
          </span>
          {isOverrun && (
            <span className={TAG_CLS} style={{ color: 'var(--mtech-danger)', backgroundColor: 'rgba(229,72,77,0.14)' }}>
              Overrun
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-px pb-1 pl-7 pr-2">
          {sortedIssues.map((issue) => (
            <IssueDetail key={issue.issueId} issue={issue} meta={issueMeta.get(issue.issueId)} />
          ))}
        </div>
      )}
    </div>
  );
}

function VarianceEmpty() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
      <Scale className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Sem dados de estimativa</p>
        <p className="max-w-[260px] text-xs text-[var(--mtech-text-subtle)]">
          O custo por ponto aparece quando há issues com tempo cronometrado
        </p>
      </div>
    </div>
  );
}

function VarianceSkeleton() {
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
          <div className="h-4 w-[92px] flex-shrink-0 rounded bg-[var(--mtech-surface-elev)]" />
        </div>
      ))}
    </div>
  );
}

export function BillingVariancePanel({ className = '' }: { className?: string }) {
  const { data: issues, isLoading } = useBacklogIssues();
  const { data: timeTotals } = useTechTimeTotals();
  const prefersReduced = useReducedMotion();

  const { rows, maxCost } = useMemo(() => {
    const issueList = issues ?? [];
    const totals = timeTotals ?? {};

    const projectNames = new Map<string, string>();
    for (const i of issueList) {
      projectNames.set(i.projectId, i.projectName);
    }

    const { issues: issueVariance, projects } = buildBillingVariance(
      issueList.map((i) => ({ id: i.id, projectId: i.projectId, storyPoints: i.storyPoints })),
      totals,
    );

    const issuesByProject = new Map<string, IssueVariance[]>();
    for (const iv of issueVariance) {
      const arr = issuesByProject.get(iv.projectId) ?? [];
      arr.push(iv);
      issuesByProject.set(iv.projectId, arr);
    }

    // Only projects with measured time are billing-relevant.
    const projectRows: ProjectRow[] = projects
      .filter((p) => p.totalSeconds > 0)
      .map((p) => ({
        ...p,
        projectName: projectNames.get(p.projectId) ?? 'Projeto',
        issues: (issuesByProject.get(p.projectId) ?? []).filter((iv) => iv.realSeconds > 0),
      }))
      .sort((a, b) => (b.secondsPerPoint ?? 0) - (a.secondsPerPoint ?? 0));

    const max = projectRows.reduce((m, p) => Math.max(m, p.secondsPerPoint ?? 0), 0);
    return { rows: projectRows, maxCost: max };
  }, [issues, timeTotals]);

  const issueMeta = useMemo(() => {
    const map = new Map<string, IssueMeta>();
    for (const i of issues ?? []) map.set(i.id, { title: i.title, key: i.key || null });
    return map;
  }, [issues]);

  // Headline signals, surfaced before any drill: how many projects run hot on
  // cost-per-point, and how much measured work never got an estimate (the
  // process gap). Same heuristic as the rows, so header and list always agree.
  const overrunCount = useMemo(
    () => rows.filter((r) => isOverrunCost(r.secondsPerPoint ?? 0, maxCost)).length,
    [rows, maxCost],
  );
  const unestimatedCount = useMemo(
    () => rows.reduce((sum, r) => sum + r.unestimatedCount, 0),
    [rows],
  );

  return (
    <section className={`${PANEL_CLS} ${className}`} aria-label="Estimado versus real por projeto">
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLS}>Estimado × real</span>
          <span className="text-[13px] text-[var(--mtech-text-muted)]">
            Custo medido por ponto estimado, por projeto
          </span>
        </div>
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-baseline gap-1">
              <span data-mono className="text-[15px] font-semibold leading-none tabular-nums text-[var(--mtech-text)]">
                {rows.length}
              </span>
              <span className="text-[10px] text-[var(--mtech-text-subtle)]">
                {rows.length === 1 ? 'projeto' : 'projetos'}
              </span>
            </span>
            {(overrunCount > 0 || unestimatedCount > 0) && (
              <span className="flex items-center gap-2 text-[11px] tabular-nums" data-mono>
                {overrunCount > 0 && (
                  <span style={{ color: 'var(--mtech-danger)' }}>{overrunCount} overrun</span>
                )}
                {unestimatedCount > 0 && (
                  <span className="text-[var(--mtech-text-subtle)]">{unestimatedCount} sem est.</span>
                )}
              </span>
            )}
          </div>
        )}
      </header>

      {isLoading ? (
        <VarianceSkeleton />
      ) : rows.length === 0 ? (
        <VarianceEmpty />
      ) : (
        <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
          {rows.map((row) => (
            <ProjectVarianceRow
              key={row.projectId}
              row={row}
              maxCost={maxCost}
              issueMeta={issueMeta}
              animate={!prefersReduced}
            />
          ))}
        </div>
      )}
    </section>
  );
}
