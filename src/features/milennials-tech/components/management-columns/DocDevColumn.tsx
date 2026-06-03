import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FileText, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ManagementColumn } from '../ManagementColumn';
import {
  useTechDevDailies,
  useTechDevs,
  useUpsertDevDaily,
  type DevDailyRow,
  type DevInfo,
} from '../../hooks/useTechDevDailies';
import { getInitials } from '../../hooks/useProfiles';

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

const FIELD_LABELS: Record<string, string> = {
  did_yesterday: 'O que fez ontem?',
  doing_today: 'O que vai fazer hoje?',
  blockers: 'Algo te impedindo?',
  notes: 'Observacoes',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DocDevColumnProps {
  date: string;
}

export function DocDevColumn({ date }: DocDevColumnProps) {
  const { data: devs = [], isLoading: loadingDevs } = useTechDevs();
  const { data: dailies = [], isLoading: loadingDailies } = useTechDevDailies(date);
  const upsert = useUpsertDevDaily();

  const [selectedDev, setSelectedDev] = useState<DevInfo | null>(null);

  const dailyMap = useMemo(() => {
    const map: Record<string, DevDailyRow> = {};
    for (const d of dailies) map[d.dev_user_id] = d;
    return map;
  }, [dailies]);

  const filledCount = devs.filter((d) => getFillStatus(dailyMap[d.user_id]) === 'filled').length;
  const isLoading = loadingDevs || loadingDailies;

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

  return (
    <>
      <ManagementColumn
        title="Doc Dev"
        icon={FileText}
        count={devs.length}
        badge={
          !isLoading && devs.length > 0 ? (
            <span className="text-[9px] text-[var(--mtech-success)] font-medium">
              {filledCount}/{devs.length}
            </span>
          ) : undefined
        }
      >
        {isLoading &&
          [0, 1].map((i) => (
            <div
              key={i}
              className="h-12 rounded-[var(--mtech-radius-md)] bg-[var(--mtech-surface-elev)]"
            />
          ))}

        {!isLoading && devs.length === 0 && (
          <p className="text-center text-[10px] text-[var(--mtech-text-subtle)] py-6">
            Nenhum dev.
          </p>
        )}

        {!isLoading &&
          devs
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((dev) => {
              const daily = dailyMap[dev.user_id];
              const status = getFillStatus(daily);
              const cfg = FILL_CONFIG[status];
              const StatusIcon = cfg.icon;

              return (
                <button
                  key={dev.user_id}
                  onClick={() => setSelectedDev(dev)}
                  className="w-full rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-2.5 text-left transition-colors hover:border-[var(--mtech-accent)]/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/20 text-[9px] font-bold text-[var(--mtech-accent)] select-none">
                      {getInitials(dev.name)}
                    </span>
                    <span className="flex-1 text-[11px] font-medium text-[var(--mtech-text)] truncate">
                      {dev.name}
                    </span>
                    <StatusIcon className="h-3 w-3 flex-shrink-0" style={{ color: cfg.color }} />
                  </div>
                </button>
              );
            })}
      </ManagementColumn>

      {/* Detail dialog */}
      <Dialog open={!!selectedDev} onOpenChange={(open) => !open && setSelectedDev(null)}>
        <DialogContent className="mtech-scope max-w-lg max-h-[80vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--mtech-text)]">
              Daily - {selectedDev?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Daily do dev {selectedDev?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedDev && (
            <div className="space-y-3 mt-2">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <DailyField
                  key={field}
                  field={field}
                  label={label}
                  value={
                    dailyMap[selectedDev.user_id]
                      ? ((dailyMap[selectedDev.user_id][field as keyof DevDailyRow] as string) ?? '')
                      : ''
                  }
                  onSave={(val) => handleSave(selectedDev.user_id, field, val)}
                  disabled={upsert.isPending}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline field with auto-save on blur
// ---------------------------------------------------------------------------

function DailyField({
  field: _field,
  label,
  value,
  onSave,
  disabled,
}: {
  field: string;
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
