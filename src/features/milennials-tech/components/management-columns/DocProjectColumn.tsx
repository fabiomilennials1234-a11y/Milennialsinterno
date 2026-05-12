import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FolderKanban, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ManagementColumn } from '../ManagementColumn';
import { useTechProjects, type TechProjectRow } from '../../hooks/useTechProjects';
import {
  useTechProjectDailies,
  useUpsertProjectDaily,
  type ProjectDailyRow,
  type ProjectDailyStatus,
} from '../../hooks/useTechProjectDailies';

// ---------------------------------------------------------------------------
// Doc status
// ---------------------------------------------------------------------------

type DocStatus = 'documented' | 'partial' | 'empty';

function getDocStatus(daily: ProjectDailyRow | undefined): DocStatus {
  if (!daily) return 'empty';
  const fields = [daily.progress_today, daily.next_steps, daily.blockers];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  if (filled === 3) return 'documented';
  if (filled > 0) return 'partial';
  return 'empty';
}

const DOC_CONFIG: Record<DocStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  documented: { icon: CheckCircle2, color: 'var(--mtech-success)', label: 'Documentado' },
  partial: { icon: AlertCircle, color: '#f59e0b', label: 'Parcial' },
  empty: { icon: Circle, color: 'var(--mtech-text-subtle)', label: 'Pendente' },
};

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: ProjectDailyStatus; label: string; color: string; bg: string }[] = [
  { value: 'on_track', label: 'On Track', color: 'var(--mtech-success)', bg: 'rgba(48,164,108,0.15)' },
  { value: 'at_risk', label: 'At Risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  { value: 'blocked', label: 'Blocked', color: 'var(--mtech-danger)', bg: 'rgba(229,72,77,0.15)' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DocProjectColumnProps {
  date: string;
}

export function DocProjectColumn({ date }: DocProjectColumnProps) {
  const { data: allProjects = [], isLoading: loadingProjects } = useTechProjects({ status: 'active' });
  const { data: dailies = [], isLoading: loadingDailies } = useTechProjectDailies(date);
  const upsert = useUpsertProjectDaily();

  const [selectedProject, setSelectedProject] = useState<TechProjectRow | null>(null);

  const dailyMap = useMemo(() => {
    const map: Record<string, ProjectDailyRow> = {};
    for (const d of dailies) map[d.project_id] = d;
    return map;
  }, [dailies]);

  const docCount = allProjects.filter((p) => getDocStatus(dailyMap[p.id]) === 'documented').length;
  const isLoading = loadingProjects || loadingDailies;

  const handleSaveField = useCallback(
    (projectId: string, field: string, value: string | number) => {
      const existing = dailyMap[projectId];
      upsert.mutate({
        project_id: projectId,
        date,
        status: field === 'status' ? (value as ProjectDailyStatus) : (existing?.status ?? 'on_track'),
        progress_today: field === 'progress_today' ? (value as string) : (existing?.progress_today ?? null),
        next_steps: field === 'next_steps' ? (value as string) : (existing?.next_steps ?? null),
        blockers: field === 'blockers' ? (value as string) : (existing?.blockers ?? null),
        completion_pct: field === 'completion_pct' ? (value as number) : (existing?.completion_pct ?? 0),
      });
    },
    [date, dailyMap, upsert],
  );

  return (
    <>
      <ManagementColumn
        title="Doc Projeto"
        icon={FolderKanban}
        count={allProjects.length}
        badge={
          !isLoading && allProjects.length > 0 ? (
            <span className="text-[9px] text-[var(--mtech-success)] font-medium">
              {docCount}/{allProjects.length}
            </span>
          ) : undefined
        }
      >
        {isLoading &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-[var(--mtech-radius-md)] bg-[var(--mtech-surface-elev)] animate-pulse"
            />
          ))}

        {!isLoading && allProjects.length === 0 && (
          <p className="text-center text-[10px] text-[var(--mtech-text-subtle)] py-6">
            Nenhum projeto ativo.
          </p>
        )}

        {!isLoading &&
          allProjects.map((project) => {
            const daily = dailyMap[project.id];
            const status = getDocStatus(daily);
            const cfg = DOC_CONFIG[status];
            const StatusIcon = cfg.icon;
            const pctVal = daily?.completion_pct ?? 0;
            const dailyStatus = daily?.status ?? 'on_track';
            const statusOpt = STATUS_OPTIONS.find((s) => s.value === dailyStatus);

            return (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="w-full rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-2.5 text-left transition-colors hover:border-[var(--mtech-accent)]/30 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[var(--mtech-text)] truncate flex-1">
                    {project.name}
                  </span>
                  <StatusIcon className="h-3 w-3 flex-shrink-0" style={{ color: cfg.color }} />
                </div>
                {/* Status badge + pct */}
                <div className="flex items-center justify-between gap-2">
                  {statusOpt && (
                    <span
                      className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: statusOpt.color, backgroundColor: statusOpt.bg }}
                    >
                      {statusOpt.label}
                    </span>
                  )}
                  <span className="text-[9px] font-semibold text-[var(--mtech-accent)] tabular-nums">
                    {pctVal}%
                  </span>
                </div>
                {/* Mini progress bar */}
                <div className="h-1 w-full rounded-full bg-[var(--mtech-surface-elev)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pctVal}%`,
                      background: pctVal === 100 ? 'var(--mtech-success)' : 'var(--mtech-accent)',
                    }}
                  />
                </div>
              </button>
            );
          })}
      </ManagementColumn>

      {/* Detail dialog */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <DialogContent className="mtech-scope max-w-lg max-h-[80vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--mtech-text)]">
              Daily - {selectedProject?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Daily do projeto {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4 mt-2">
              {/* Status toggle */}
              <div className="flex items-center gap-1.5">
                {STATUS_OPTIONS.map((opt) => {
                  const currentStatus = dailyMap[selectedProject.id]?.status ?? 'on_track';
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSaveField(selectedProject.id, 'status', opt.value)}
                      disabled={upsert.isPending}
                      className="rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all disabled:opacity-50"
                      style={{
                        color: currentStatus === opt.value ? opt.color : 'var(--mtech-text-subtle)',
                        backgroundColor: currentStatus === opt.value ? opt.bg : 'transparent',
                        border: `1px solid ${currentStatus === opt.value ? opt.color + '33' : 'var(--mtech-border)'}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Text fields */}
              <AutoSaveTextarea
                label="O que avancou hoje neste projeto?"
                value={dailyMap[selectedProject.id]?.progress_today ?? ''}
                onSave={(val) => handleSaveField(selectedProject.id, 'progress_today', val)}
                disabled={upsert.isPending}
              />
              <AutoSaveTextarea
                label="Quais os proximos passos?"
                value={dailyMap[selectedProject.id]?.next_steps ?? ''}
                onSave={(val) => handleSaveField(selectedProject.id, 'next_steps', val)}
                disabled={upsert.isPending}
              />
              <AutoSaveTextarea
                label="Ha algum impedimento ou risco?"
                value={dailyMap[selectedProject.id]?.blockers ?? ''}
                onSave={(val) => handleSaveField(selectedProject.id, 'blockers', val)}
                disabled={upsert.isPending}
              />

              {/* Completion slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-[var(--mtech-text-muted)]">
                    % de conclusao
                  </label>
                  <span className="text-[12px] font-semibold text-[var(--mtech-accent)] tabular-nums">
                    {dailyMap[selectedProject.id]?.completion_pct ?? 0}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={dailyMap[selectedProject.id]?.completion_pct ?? 0}
                  onChange={(e) =>
                    handleSaveField(selectedProject.id, 'completion_pct', Number(e.target.value))
                  }
                  disabled={upsert.isPending}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, var(--mtech-accent) ${dailyMap[selectedProject.id]?.completion_pct ?? 0}%, var(--mtech-surface-elev) ${dailyMap[selectedProject.id]?.completion_pct ?? 0}%)`,
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Auto-save textarea
// ---------------------------------------------------------------------------

function AutoSaveTextarea({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const dirtyRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    dirtyRef.current = false;
  }, [value]);

  const handleBlur = useCallback(() => {
    if (dirtyRef.current && localValue !== value) {
      onSave(localValue);
      dirtyRef.current = false;
    }
  }, [localValue, value, onSave]);

  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-1">
        {label}
      </label>
      <textarea
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          dirtyRef.current = true;
        }}
        onBlur={handleBlur}
        disabled={disabled}
        rows={2}
        className="w-full rounded-lg border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors resize-none disabled:opacity-50"
        placeholder="..."
      />
    </div>
  );
}
