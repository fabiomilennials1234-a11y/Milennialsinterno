import { Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isExecutive } from '@/types/auth';
import { ThroughputPanel } from '../components/ThroughputPanel';
import { CurrentLoadPanel } from '../components/CurrentLoadPanel';

// ---------------------------------------------------------------------------
// TeamReportTab (#165) — management reporting for the tech squad.
//
// Two reads of the same team, side by side on wide screens, stacked below:
//   • ThroughputPanel  — history. Who delivered, ranked, sprint over sprint.
//   • CurrentLoadPanel — now. Who is carrying what on the active sprint, and
//                        who is over the line.
//
// Exec-only by design: throughput rankings and overload flags are management
// signal, not peer leaderboard fuel. The tab is hidden from non-execs in the
// nav and the RPCs are RLS-guarded; this guard is the third layer, so a typed
// URL lands on an honest "restricted" rather than an empty shell.
// ---------------------------------------------------------------------------

function RestrictedState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Lock className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Acesso restrito</p>
        <p className="max-w-[280px] text-xs text-[var(--mtech-text-subtle)]">
          O reporting de time é visível apenas para a diretoria
        </p>
      </div>
    </div>
  );
}

export function TeamReportTab() {
  const { user } = useAuth();

  if (!isExecutive(user?.role)) {
    return <RestrictedState />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]">
          Reporting
        </span>
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Time</h2>
        <p className="text-sm text-[var(--mtech-text-muted)]">
          Quem entrega ao longo dos sprints, quem está sobrecarregado agora.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <ThroughputPanel />
        <CurrentLoadPanel />
      </div>
    </div>
  );
}
