import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, FolderKanban, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useTechProjects, type TechProjectRow } from '../../hooks/useTechProjects';
import {
  useTechProjectDailies,
  useUpsertProjectDaily,
  type ProjectDailyRow,
  type ProjectDailyStatus,
} from '../../hooks/useTechProjectDailies';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function displayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return format(new Date(y, m - 1, d), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}

// ---------------------------------------------------------------------------
// Fill status
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
// Project card
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: TechProjectRow;
  daily: ProjectDailyRow | undefined;
  date: string;
  onSaveField: (projectId: string, field: string, value: string | number) => void;
  isSaving: boolean;
}

function ProjectCard({ project, daily, date: _date, onSaveField, isSaving }: ProjectCardProps) {
  const docStatus = getDocStatus(daily);
  const cfg = DOC_CONFIG[docStatus];
  const StatusIcon = cfg.icon;
  const currentStatus = daily?.status ?? 'on_track';
  const currentPct = daily?.completion_pct ?? 0;

  return (
    <div className="rounded-xl border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-4 transition-colors hover:border-[var(--mtech-accent)]/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <FolderKanban className="h-4 w-4 text-[var(--mtech-accent)]" />
          <span className="text-[14px] font-medium text-[var(--mtech-text)]">
            {project.name}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider select-none"
          style={{ color: cfg.color, backgroundColor: `${cfg.color}1a` }}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
      </div>

      {/* Status toggle */}
      <div className="flex items-center gap-1.5 mb-4">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSaveField(project.id, 'status', opt.value)}
            disabled={isSaving}
            className="rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all disabled:opacity-50"
            style={{
              color: currentStatus === opt.value ? opt.color : 'var(--mtech-text-subtle)',
              backgroundColor: currentStatus === opt.value ? opt.bg : 'transparent',
              border: `1px solid ${currentStatus === opt.value ? opt.color + '33' : 'var(--mtech-border)'}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Text fields */}
      <div className="space-y-3">
        <AutoSaveTextarea
          label="O que avancou hoje neste projeto?"
          value={daily?.progress_today ?? ''}
          onSave={(val) => onSaveField(project.id, 'progress_today', val)}
          disabled={isSaving}
        />
        <AutoSaveTextarea
          label="Quais os proximos passos?"
          value={daily?.next_steps ?? ''}
          onSave={(val) => onSaveField(project.id, 'next_steps', val)}
          disabled={isSaving}
        />
        <AutoSaveTextarea
          label="Ha algum impedimento ou risco?"
          value={daily?.blockers ?? ''}
          onSave={(val) => onSaveField(project.id, 'blockers', val)}
          disabled={isSaving}
        />
      </div>

      {/* Completion slider */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium text-[var(--mtech-text-muted)]">
            % de conclusao estimada
          </label>
          <span className="text-[12px] font-semibold text-[var(--mtech-accent)] tabular-nums">
            {currentPct}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={currentPct}
          onChange={(e) => onSaveField(project.id, 'completion_pct', Number(e.target.value))}
          disabled={isSaving}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50"
          style={{
            background: `linear-gradient(to right, var(--mtech-accent) ${currentPct}%, var(--mtech-surface-elev) ${currentPct}%)`,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-save textarea
// ---------------------------------------------------------------------------

interface AutoSaveTextareaProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled: boolean;
}

function AutoSaveTextarea({ label, value, onSave, disabled }: AutoSaveTextareaProps) {
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TechTeamDocProject() {
  const [date, setDate] = useState(() => toDateStr(new Date()));

  const { data: allProjects = [], isLoading: loadingProjects } = useTechProjects({ status: 'active' });
  const { data: dailies = [], isLoading: loadingDailies } = useTechProjectDailies(date);
  const upsert = useUpsertProjectDaily();

  // Map dailies by project_id
  const dailyMap = useMemo(() => {
    const map: Record<string, ProjectDailyRow> = {};
    for (const d of dailies) map[d.project_id] = d;
    return map;
  }, [dailies]);

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

  const goBack = () => setDate((d) => toDateStr(subDays(new Date(d + 'T12:00:00'), 1)));
  const goForward = () => setDate((d) => toDateStr(addDays(new Date(d + 'T12:00:00'), 1)));
  const goToday = () => setDate(toDateStr(new Date()));

  const isLoading = loadingProjects || loadingDailies;

  // Summary
  const docCount = allProjects.filter((p) => getDocStatus(dailyMap[p.id]) === 'documented').length;

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="h-8 w-8 text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:bg-[var(--mtech-surface-elev)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[var(--mtech-accent)]" />
            <span className="text-[13px] font-medium text-[var(--mtech-text)] capitalize">
              {displayDate(date)}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goForward}
            disabled={isToday(date)}
            className="h-8 w-8 text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:bg-[var(--mtech-surface-elev)] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isToday(date) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              className="h-7 px-2 text-[10px] text-[var(--mtech-accent)] hover:bg-[var(--mtech-accent-muted)]"
            >
              Hoje
            </Button>
          )}
        </div>

        {!isLoading && allProjects.length > 0 && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-[var(--mtech-success)]">{docCount}/{allProjects.length} documentados</span>
          </div>
        )}
      </div>

      {/* Project cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 rounded-xl bg-[var(--mtech-surface-elev)] animate-pulse" />
          ))}
        </div>
      ) : allProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <FolderKanban className="h-6 w-6 text-[var(--mtech-text-subtle)]" />
          <p className="text-xs text-[var(--mtech-text-subtle)]">Nenhum projeto ativo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {allProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              daily={dailyMap[project.id]}
              date={date}
              onSaveField={handleSaveField}
              isSaving={upsert.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
