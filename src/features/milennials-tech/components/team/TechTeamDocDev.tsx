import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  useTechDevDailies,
  useTechDevs,
  useUpsertDevDaily,
  type DevDailyRow,
  type DevInfo,
} from '../../hooks/useTechDevDailies';
import { getInitials } from '../../hooks/useProfiles';

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

type FillStatus = 'filled' | 'partial' | 'empty';

function getFillStatus(daily: DevDailyRow | undefined): FillStatus {
  if (!daily) return 'empty';
  const fields = [daily.did_yesterday, daily.doing_today, daily.blockers, daily.notes];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  if (filled === 4) return 'filled';
  if (filled > 0) return 'partial';
  return 'empty';
}

const FILL_CONFIG: Record<FillStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  filled: { icon: CheckCircle2, color: 'var(--mtech-success)', label: 'Completo' },
  partial: { icon: AlertCircle, color: '#f59e0b', label: 'Parcial' },
  empty: { icon: Circle, color: 'var(--mtech-text-subtle)', label: 'Vazio' },
};

// ---------------------------------------------------------------------------
// Dev card with form fields
// ---------------------------------------------------------------------------

interface DevCardProps {
  dev: DevInfo;
  daily: DevDailyRow | undefined;
  date: string;
  onSave: (devId: string, field: string, value: string) => void;
  isSaving: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  did_yesterday: 'O que fez ontem?',
  doing_today: 'O que vai fazer hoje?',
  blockers: 'Algo te impedindo?',
  notes: 'Observacoes',
};

function DevCard({ dev, daily, date, onSave, isSaving }: DevCardProps) {
  const status = getFillStatus(daily);
  const cfg = FILL_CONFIG[status];
  const StatusIcon = cfg.icon;

  return (
    <div className="rounded-xl border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-4 transition-colors hover:border-[var(--mtech-accent)]/20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/20 text-[11px] font-bold text-[var(--mtech-accent)] select-none">
          {getInitials(dev.name)}
        </span>
        <span className="flex-1 text-[14px] font-medium text-[var(--mtech-text)]">
          {dev.name}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider select-none"
          style={{ color: cfg.color, backgroundColor: `${cfg.color}1a` }}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {Object.entries(FIELD_LABELS).map(([field, label]) => (
          <DailyField
            key={field}
            field={field}
            label={label}
            value={daily ? (daily[field as keyof DevDailyRow] as string ?? '') : ''}
            onSave={(val) => onSave(dev.user_id, field, val)}
            disabled={isSaving}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual field with auto-save on blur
// ---------------------------------------------------------------------------

interface DailyFieldProps {
  field: string;
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled: boolean;
}

function DailyField({ field: _field, label, value, onSave, disabled }: DailyFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const dirtyRef = useRef(false);

  // Sync from server when value changes
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

export default function TechTeamDocDev() {
  const [date, setDate] = useState(() => toDateStr(new Date()));

  const { data: devs = [], isLoading: loadingDevs } = useTechDevs();
  const { data: dailies = [], isLoading: loadingDailies } = useTechDevDailies(date);
  const upsert = useUpsertDevDaily();

  // Map dailies by dev_user_id for O(1) lookup
  const dailyMap = useMemo(() => {
    const map: Record<string, DevDailyRow> = {};
    for (const d of dailies) map[d.dev_user_id] = d;
    return map;
  }, [dailies]);

  const handleSave = useCallback(
    (devId: string, field: string, value: string) => {
      const existing = dailyMap[devId];
      upsert.mutate({
        dev_user_id: devId,
        date,
        did_yesterday: field === 'did_yesterday' ? value : (existing?.did_yesterday ?? null),
        doing_today: field === 'doing_today' ? value : (existing?.doing_today ?? null),
        blockers: field === 'blockers' ? value : (existing?.blockers ?? null),
        notes: field === 'notes' ? value : (existing?.notes ?? null),
      });
    },
    [date, dailyMap, upsert],
  );

  const goBack = () => setDate((d) => toDateStr(subDays(new Date(d + 'T12:00:00'), 1)));
  const goForward = () => setDate((d) => toDateStr(addDays(new Date(d + 'T12:00:00'), 1)));
  const goToday = () => setDate(toDateStr(new Date()));

  const isLoading = loadingDevs || loadingDailies;

  // Summary
  const filledCount = devs.filter((d) => getFillStatus(dailyMap[d.user_id]) === 'filled').length;
  const partialCount = devs.filter((d) => getFillStatus(dailyMap[d.user_id]) === 'partial').length;

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

        {/* Summary */}
        {!isLoading && devs.length > 0 && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-[var(--mtech-success)]">{filledCount} completo{filledCount !== 1 ? 's' : ''}</span>
            {partialCount > 0 && (
              <span className="text-amber-400">{partialCount} parcial</span>
            )}
            <span className="text-[var(--mtech-text-subtle)]">{devs.length} dev{devs.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Dev cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-[var(--mtech-surface-elev)] animate-pulse" />
          ))}
        </div>
      ) : devs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <Calendar className="h-6 w-6 text-[var(--mtech-text-subtle)]" />
          <p className="text-xs text-[var(--mtech-text-subtle)]">Nenhum dev cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {devs
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((dev) => (
              <DevCard
                key={dev.user_id}
                dev={dev}
                daily={dailyMap[dev.user_id]}
                date={date}
                onSave={handleSave}
                isSaving={upsert.isPending}
              />
            ))}
        </div>
      )}
    </div>
  );
}
