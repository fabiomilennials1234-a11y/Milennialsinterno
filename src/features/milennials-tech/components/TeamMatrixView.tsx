import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Users, ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAllProjectMembers,
  useUpdateProjectMemberHours,
  type AllProjectMemberRow,
} from '../hooks/useTechProjectMembers';
import { useTechProjects } from '../hooks/useTechProjects';
import { getInitials } from '../hooks/useProfiles';

// ---------------------------------------------------------------------------
// Constants
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
// Styles
// ---------------------------------------------------------------------------

const selectCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] text-xs h-8';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

// ---------------------------------------------------------------------------
// Inline edit cell
// ---------------------------------------------------------------------------

interface EditableCellProps {
  value: number;
  onSave: (hours: number) => void;
  isSaving: boolean;
  projectId: string;
}

function EditableCell({ value, onSave, isSaving, projectId }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Sync draft when external value changes
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    const parsed = Math.max(0, Math.round(Number(draft) || 0));
    setEditing(false);
    if (parsed !== value) onSave(parsed);
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        setDraft(String(value));
        setEditing(false);
      }
    },
    [commit, value],
  );

  const handleNavigate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/milennials-tech/kanban?project=${projectId}`);
    },
    [navigate, projectId],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-14 h-7 rounded-md bg-[var(--mtech-input-bg)] border border-[var(--mtech-accent)]/50 text-center text-xs font-medium text-[var(--mtech-text)] outline-none focus:border-[var(--mtech-accent)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    );
  }

  return (
    <div className="group/cell relative flex items-center justify-center">
      <button
        onClick={() => setEditing(true)}
        disabled={isSaving}
        className="w-14 h-7 rounded-md text-xs font-medium transition-all cursor-pointer hover:bg-[var(--mtech-surface-elev)] hover:border-[var(--mtech-border-strong)] border border-transparent text-[var(--mtech-text)]"
        title="Clique para editar horas"
      >
        {isSaving ? '...' : `${value}h`}
      </button>
      <button
        onClick={handleNavigate}
        className="absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--mtech-surface-elev)]"
        title="Ver tarefas no Kanban"
      >
        <ExternalLink className="h-3 w-3 text-[var(--mtech-text-subtle)]" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty cell (dev not assigned to project)
// ---------------------------------------------------------------------------

function EmptyCell() {
  return (
    <div className="flex items-center justify-center h-7">
      <span className="text-xs text-[var(--mtech-text-subtle)]/40 select-none">&mdash;</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TeamMatrixView() {
  const { data: allMembers = [], isLoading: loadingMembers } = useAllProjectMembers();
  const { data: projects = [], isLoading: loadingProjects } = useTechProjects({ status: 'active' });
  const updateHours = useUpdateProjectMemberHours();

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterDev, setFilterDev] = useState<string>('all');
  const [filterLoad, setFilterLoad] = useState<LoadStatus | 'all'>('all');

  // ----- Derived data -----

  // Map: userId -> { name, allocations: Map<projectId, hours> }
  const matrix = useMemo(() => {
    const devMap = new Map<
      string,
      { userId: string; name: string; allocations: Map<string, number> }
    >();

    for (const row of allMembers) {
      let dev = devMap.get(row.user_id);
      if (!dev) {
        dev = { userId: row.user_id, name: row.user_name ?? 'Sem nome', allocations: new Map() };
        devMap.set(row.user_id, dev);
      }
      dev.allocations.set(row.project_id, row.allocated_hours_week);
    }

    return devMap;
  }, [allMembers]);

  // Active project columns (filtered by project filter)
  const activeProjects = useMemo(() => {
    if (filterProject === 'all') return projects;
    return projects.filter((p) => p.id === filterProject);
  }, [projects, filterProject]);

  // Devs (rows), filtered
  const devRows = useMemo(() => {
    let rows = Array.from(matrix.values());

    // Filter by dev
    if (filterDev !== 'all') {
      rows = rows.filter((d) => d.userId === filterDev);
    }

    // Filter by project — only show devs who have allocation in filtered project
    if (filterProject !== 'all') {
      rows = rows.filter((d) => d.allocations.has(filterProject));
    }

    // Compute totals for load filter
    rows = rows.map((d) => ({ ...d }));

    // Filter by load status
    if (filterLoad !== 'all') {
      rows = rows.filter((d) => {
        const total = Array.from(d.allocations.values()).reduce((s, h) => s + h, 0);
        return getLoadStatus(total) === filterLoad;
      });
    }

    // Sort by name
    rows.sort((a, b) => a.name.localeCompare(b.name));

    return rows;
  }, [matrix, filterDev, filterProject, filterLoad]);

  // All unique devs for filter dropdown
  const allDevs = useMemo(() => {
    const devs = Array.from(matrix.values())
      .map((d) => ({ userId: d.userId, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return devs;
  }, [matrix]);

  const hasActiveFilters = filterProject !== 'all' || filterDev !== 'all' || filterLoad !== 'all';

  // ----- Saving state tracking -----
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleSave = useCallback(
    (projectId: string, userId: string, hours: number) => {
      const key = `${projectId}-${userId}`;
      setSavingKey(key);
      updateHours.mutate(
        { projectId, userId, allocatedHoursWeek: hours },
        { onSettled: () => setSavingKey(null) },
      );
    },
    [updateHours],
  );

  // ----- Loading -----
  if (loadingMembers || loadingProjects) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
        <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-[var(--mtech-border)]/50 last:border-0">
              <div className="h-4 w-24 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
              <div className="h-4 w-12 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
              <div className="h-4 w-12 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
              <div className="h-4 w-16 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ----- Empty state -----
  if (allMembers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Users className="h-8 w-8 text-[var(--mtech-text-subtle)]" />
        <p className="text-sm text-[var(--mtech-text-subtle)]">
          Nenhum membro alocado em projetos.
        </p>
        <p className="text-xs text-[var(--mtech-text-subtle)]/60">
          Adicione membros nos projetos para ver a matriz de equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-[var(--mtech-text-subtle)]" />

        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className={`${selectCls} w-[150px]`}>
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">Todos projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDev} onValueChange={setFilterDev}>
          <SelectTrigger className={`${selectCls} w-[150px]`}>
            <SelectValue placeholder="Dev" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">Todos devs</SelectItem>
            {allDevs.map((d) => (
              <SelectItem key={d.userId} value={d.userId}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterLoad} onValueChange={(v) => setFilterLoad(v as LoadStatus | 'all')}>
          <SelectTrigger className={`${selectCls} w-[150px]`}>
            <SelectValue placeholder="Carga" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">Todas cargas</SelectItem>
            <SelectItem value="available">Disponivel</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="overloaded">Sobrecarregado</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterProject('all');
              setFilterDev('all');
              setFilterLoad('all');
            }}
            className="text-[10px] text-[var(--mtech-accent)] hover:underline ml-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Matrix table */}
      <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] overflow-hidden">
        <div className="overflow-x-auto scrollbar-apple">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--mtech-border)]">
                <th className="sticky left-0 z-10 bg-[var(--mtech-surface)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--mtech-text-subtle)]">
                  Dev
                </th>
                {activeProjects.map((p) => (
                  <th
                    key={p.id}
                    className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--mtech-text-subtle)] whitespace-nowrap"
                    title={p.name}
                  >
                    <span className="max-w-[100px] truncate inline-block">{p.name}</span>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--mtech-text-muted)]">
                  Total/sem
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--mtech-text-muted)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {devRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeProjects.length + 3}
                    className="px-4 py-8 text-center text-sm text-[var(--mtech-text-subtle)]"
                  >
                    Nenhum resultado com esses filtros.
                  </td>
                </tr>
              ) : (
                devRows.map((dev, idx) => {
                  const totalHours = Array.from(dev.allocations.values()).reduce((s, h) => s + h, 0);
                  const load = getLoadStatus(totalHours);
                  const cfg = LOAD_CONFIG[load];

                  return (
                    <tr
                      key={dev.userId}
                      className={`border-b border-[var(--mtech-border)]/40 last:border-0 transition-colors hover:bg-[var(--mtech-surface-elev)]/40 ${
                        idx % 2 === 0 ? '' : 'bg-[var(--mtech-surface-elev)]/20'
                      }`}
                    >
                      {/* Dev name (sticky) */}
                      <td className="sticky left-0 z-10 bg-[var(--mtech-surface)] px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/20 text-[10px] font-bold text-[var(--mtech-accent)] select-none">
                            {getInitials(dev.name)}
                          </span>
                          <span className="text-[13px] font-medium text-[var(--mtech-text)] truncate max-w-[140px]">
                            {dev.name}
                          </span>
                        </div>
                      </td>

                      {/* Project columns */}
                      {activeProjects.map((p) => {
                        const hours = dev.allocations.get(p.id);
                        const key = `${p.id}-${dev.userId}`;

                        return (
                          <td key={p.id} className="px-3 py-2.5 text-center">
                            {hours != null ? (
                              <EditableCell
                                value={hours}
                                onSave={(h) => handleSave(p.id, dev.userId, h)}
                                isSaving={savingKey === key}
                                projectId={p.id}
                              />
                            ) : (
                              <EmptyCell />
                            )}
                          </td>
                        );
                      })}

                      {/* Total */}
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: cfg.color }}
                        >
                          {totalHours}h
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider select-none whitespace-nowrap"
                          style={{ color: cfg.color, backgroundColor: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer: totals per project */}
            {devRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-[var(--mtech-border)]">
                  <td className="sticky left-0 z-10 bg-[var(--mtech-surface)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--mtech-text-subtle)]">
                    Total
                  </td>
                  {activeProjects.map((p) => {
                    const projectTotal = devRows.reduce(
                      (sum, dev) => sum + (dev.allocations.get(p.id) ?? 0),
                      0,
                    );
                    return (
                      <td key={p.id} className="px-3 py-2.5 text-center">
                        <span className="text-xs font-semibold text-[var(--mtech-text-muted)] tabular-nums">
                          {projectTotal}h
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-sm font-bold text-[var(--mtech-text)] tabular-nums">
                      {devRows.reduce(
                        (sum, dev) =>
                          sum + Array.from(dev.allocations.values()).reduce((s, h) => s + h, 0),
                        0,
                      )}
                      h
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-[var(--mtech-text-subtle)]">
        <span className="uppercase tracking-wider font-medium">Carga:</span>
        {(Object.entries(LOAD_CONFIG) as [LoadStatus, typeof LOAD_CONFIG[LoadStatus]][]).map(
          ([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              {cfg.label}
              {key === 'available' && ` (0-${LOAD_THRESHOLDS.low}h)`}
              {key === 'normal' && ` (${LOAD_THRESHOLDS.low}-${LOAD_THRESHOLDS.high}h)`}
              {key === 'overloaded' && ` (${LOAD_THRESHOLDS.high}h+)`}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
