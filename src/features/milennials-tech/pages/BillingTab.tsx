import { Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isExecutive } from '@/types/auth';
import { BillingHoursPanel } from '../components/BillingHoursPanel';
import { BillingVariancePanel } from '../components/BillingVariancePanel';

// ---------------------------------------------------------------------------
// BillingTab (#164) — billing reporting for the tech squad.
//
// Two reads of the same logged time, side by side on wide screens, stacked
// below:
//   • BillingHoursPanel    — period-clipped hours per client (RPC), drill by
//                            project. The "how many hours did we burn for whom".
//   • BillingVariancePanel — all-time estimate (points) × real (hours) per
//                            project/issue, surfacing cost-per-point overruns.
//
// Exec-only by design: billable hours and cost overruns are management signal,
// not team-wide. This guard is the THIRD layer of defence — the tab is hidden
// from non-execs in the nav, the RPC is RLS-guarded (tech_assert_staff), and a
// typed URL lands here on an honest "restricted" rather than an empty shell.
// ---------------------------------------------------------------------------

function RestrictedState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Lock className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Acesso restrito</p>
        <p className="max-w-[280px] text-xs text-[var(--mtech-text-subtle)]">
          O reporting de billing é visível apenas para a diretoria
        </p>
      </div>
    </div>
  );
}

export function BillingTab() {
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
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Billing</h2>
        <p className="text-sm text-[var(--mtech-text-muted)]">
          Horas faturáveis por cliente e o custo real medido contra o estimado.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <BillingHoursPanel />
        <BillingVariancePanel />
      </div>
    </div>
  );
}
