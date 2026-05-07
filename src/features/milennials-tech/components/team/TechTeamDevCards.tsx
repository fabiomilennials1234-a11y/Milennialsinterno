import { useMemo } from 'react';
import { Users } from 'lucide-react';
import {
  useAllProjectMembers,
  type AllProjectMemberRow,
} from '../../hooks/useTechProjectMembers';
import { useTechProjects } from '../../hooks/useTechProjects';
import { getInitials } from '../../hooks/useProfiles';

// ---------------------------------------------------------------------------
// Load status (mirrors TeamMatrixView logic)
// ---------------------------------------------------------------------------

type LoadStatus = 'available' | 'normal' | 'overloaded';

const LOAD_THRESHOLDS = { low: 20, high: 35 } as const;

const LOAD_CONFIG: Record<LoadStatus, { label: string; color: string; bg: string }> = {
  available: {
    label: 'Disponivel',
    color: 'var(--mtech-success)',
    bg: 'rgba(16,185,129,0.12)',
  },
  normal: {
    label: 'Normal',
    color: 'var(--mtech-text-muted)',
    bg: 'rgba(138,138,149,0.10)',
  },
  overloaded: {
    label: 'Sobrecarregado',
    color: 'var(--mtech-danger)',
    bg: 'rgba(229,72,77,0.12)',
  },
};

function getLoadStatus(totalHours: number): LoadStatus {
  if (totalHours <= LOAD_THRESHOLDS.low) return 'available';
  if (totalHours < LOAD_THRESHOLDS.high) return 'normal';
  return 'overloaded';
}

// ---------------------------------------------------------------------------
// Derived dev type
// ---------------------------------------------------------------------------

interface DevSummary {
  userId: string;
  name: string;
  totalHours: number;
  load: LoadStatus;
  projects: { id: string; name: string; hours: number }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TechTeamDevCards() {
  const { data: allMembers = [], isLoading: loadingMembers } = useAllProjectMembers();
  const { data: projects = [], isLoading: loadingProjects } = useTechProjects({ status: 'active' });

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const devs: DevSummary[] = useMemo(() => {
    const devMap = new Map<string, { userId: string; name: string; allocations: Map<string, number> }>();

    for (const row of allMembers) {
      let dev = devMap.get(row.user_id);
      if (!dev) {
        dev = { userId: row.user_id, name: row.user_name ?? 'Sem nome', allocations: new Map() };
        devMap.set(row.user_id, dev);
      }
      dev.allocations.set(row.project_id, row.allocated_hours_week);
    }

    return Array.from(devMap.values())
      .map((d) => {
        const totalHours = Array.from(d.allocations.values()).reduce((s, h) => s + h, 0);
        const projectList = Array.from(d.allocations.entries())
          .map(([pid, hours]) => ({ id: pid, name: projectNameMap[pid] ?? 'Projeto', hours }))
          .sort((a, b) => b.hours - a.hours);

        return {
          userId: d.userId,
          name: d.name,
          totalHours,
          load: getLoadStatus(totalHours),
          projects: projectList,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMembers, projectNameMap]);

  if (loadingMembers || loadingProjects) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-[var(--mtech-surface-elev)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (devs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <Users className="h-6 w-6 text-[var(--mtech-text-subtle)]" />
        <p className="text-xs text-[var(--mtech-text-subtle)]">Nenhum dev alocado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {devs.map((dev) => {
        const cfg = LOAD_CONFIG[dev.load];
        return (
          <div
            key={dev.userId}
            className="rounded-xl border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-3 transition-colors hover:border-[var(--mtech-accent)]/30"
          >
            {/* Header: avatar + name + load badge */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/20 text-[10px] font-bold text-[var(--mtech-accent)] select-none">
                {getInitials(dev.name)}
              </span>
              <span className="flex-1 text-[13px] font-medium text-[var(--mtech-text)] truncate">
                {dev.name}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider select-none whitespace-nowrap"
                style={{ color: cfg.color, backgroundColor: cfg.bg }}
              >
                {cfg.label}
              </span>
            </div>

            {/* Hours */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] text-[var(--mtech-text-subtle)]">Horas/sem:</span>
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{ color: cfg.color }}
              >
                {dev.totalHours}h
              </span>
            </div>

            {/* Project badges */}
            {dev.projects.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {dev.projects.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center rounded-md bg-[var(--mtech-accent-muted)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--mtech-accent)] border border-[var(--mtech-accent)]/10 truncate max-w-[140px]"
                    title={`${p.name} — ${p.hours}h/sem`}
                  >
                    {p.name}
                    <span className="ml-1 opacity-60">{p.hours}h</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-3 pt-2 text-[9px] text-[var(--mtech-text-subtle)] border-t border-[var(--mtech-border)]/50">
        {(Object.entries(LOAD_CONFIG) as [LoadStatus, (typeof LOAD_CONFIG)[LoadStatus]][]).map(
          ([key, cfg]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
