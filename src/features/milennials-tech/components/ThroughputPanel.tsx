import { BarChart3 } from 'lucide-react';
import { useProfileMap } from '../hooks/useProfiles';
import { useTechTeamThroughput } from '../hooks/useTechTeamThroughput';
import type { DevThroughput } from '../lib/teamThroughput';
import { DevAvatar } from './DevAvatar';
import { DevSparkline } from './DevSparkline';

// ---------------------------------------------------------------------------
// ThroughputPanel (#165) — who delivered, sprint over sprint.
//
// The team's velocity bar (#163) answers "how much does the squad ship"; this
// panel decomposes that same delivered total per person, ranked heaviest-first
// (the lib already orders by totalPoints DESC). Points lead the row because
// points are what the ranking and the velocity rest on; issues trail as the
// volume footnote. The sparkline carries the shape the totals can't — is this
// dev trending up or coasting on one big sprint.
//
// Honest by construction: a dev with no closed work never appears here. We do
// not synthesise a zero row to "complete" the team — absence is the signal.
// ---------------------------------------------------------------------------

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

const PANEL_CLS =
  'rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]';

function issuesLabel(n: number): string {
  return n === 1 ? 'issue' : 'issues';
}

// ---------------------------------------------------------------------------
// Row — one developer's delivery line.
// ---------------------------------------------------------------------------

function DevThroughputRow({
  dev,
  rank,
  name,
}: {
  dev: DevThroughput;
  rank: number;
  name: string | null;
}) {
  const displayName = name ?? 'Usuário removido';

  return (
    <div className="flex items-center gap-3 rounded-[var(--mtech-radius-sm)] px-2 py-2.5 transition-colors hover:bg-[var(--mtech-surface-elev)]">
      <span
        data-mono
        className="w-4 flex-shrink-0 text-right text-[11px] tabular-nums text-[var(--mtech-text-subtle)]"
      >
        {rank}
      </span>

      <DevAvatar name={name} />

      <span
        className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--mtech-text)]"
        title={displayName}
      >
        {displayName}
      </span>

      <DevSparkline data={dev.perSprint} className="hidden flex-shrink-0 sm:block" />

      <div className="flex w-[120px] flex-shrink-0 items-baseline justify-end gap-3">
        <span className="text-[11px] tabular-nums text-[var(--mtech-text-subtle)]" data-mono>
          {dev.totalIssues} {issuesLabel(dev.totalIssues)}
        </span>
        <span className="flex items-baseline gap-1">
          <span
            data-mono
            className="text-[15px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--mtech-accent)]"
          >
            {dev.totalPoints}
          </span>
          <span className="text-[10px] text-[var(--mtech-text-subtle)]">
            {dev.totalPoints === 1 ? 'pt' : 'pts'}
          </span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading.
// ---------------------------------------------------------------------------

function ThroughputEmpty() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
      <BarChart3 className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Sem entregas ainda</p>
        <p className="max-w-[260px] text-xs text-[var(--mtech-text-subtle)]">
          O ranking aparece quando o primeiro sprint é concluído — uma linha por dev, do maior
          contribuidor para baixo
        </p>
      </div>
    </div>
  );
}

function ThroughputSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 pb-3 pt-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[var(--mtech-surface-elev)]" />
          <div className="h-4 flex-1 rounded bg-[var(--mtech-surface-elev)]" style={{ maxWidth: 120 + i * 14 }} />
          <div className="hidden h-5 w-[88px] flex-shrink-0 rounded bg-[var(--mtech-surface-elev)] sm:block" />
          <div className="h-4 w-[64px] flex-shrink-0 rounded bg-[var(--mtech-surface-elev)]" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel.
// ---------------------------------------------------------------------------

export function ThroughputPanel({ className = '' }: { className?: string }) {
  const { devs, isLoading } = useTechTeamThroughput();
  const profileMap = useProfileMap();

  return (
    <section
      className={`${PANEL_CLS} ${className}`}
      aria-label="Throughput por desenvolvedor"
    >
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLS}>Throughput</span>
          <span className="text-[13px] text-[var(--mtech-text-muted)]">
            Entregas por dev, sprint a sprint
          </span>
        </div>
        {!isLoading && devs.length > 0 && (
          <div className="flex flex-col items-end gap-0.5">
            <span className={LABEL_CLS}>Devs</span>
            <span
              data-mono
              className="text-[15px] font-semibold leading-none tabular-nums text-[var(--mtech-text)]"
            >
              {devs.length}
            </span>
          </div>
        )}
      </header>

      {isLoading ? (
        <ThroughputSkeleton />
      ) : devs.length === 0 ? (
        <ThroughputEmpty />
      ) : (
        <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
          {devs.map((dev, i) => (
            <DevThroughputRow
              key={dev.assigneeId}
              dev={dev}
              rank={i + 1}
              name={profileMap[dev.assigneeId] ?? null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
