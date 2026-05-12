import { useState, useMemo, useCallback } from 'react';
import { Users, Star, Save } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ManagementColumn } from '../ManagementColumn';
import { useTechDevs, type DevInfo } from '../../hooks/useTechDevDailies';
import {
  useTechOneOnOnes,
  useCreateOneOnOne,
  useDevWeekContext,
  type OneOnOneRow,
} from '../../hooks/useTechOneOnOnes';
import { getInitials } from '../../hooks/useProfiles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentWeekStart(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OneOnOneColumn() {
  const { data: devs = [], isLoading: loadingDevs } = useTechDevs();
  const { data: allMeetings = [], isLoading: loadingMeetings } = useTechOneOnOnes();
  const [selectedDev, setSelectedDev] = useState<DevInfo | null>(null);

  const weekStart = getCurrentWeekStart();

  // Latest meeting per dev
  const latestByDev = useMemo(() => {
    const map: Record<string, OneOnOneRow> = {};
    for (const m of allMeetings) {
      if (!map[m.dev_user_id] || m.week_start > map[m.dev_user_id].week_start) {
        map[m.dev_user_id] = m;
      }
    }
    return map;
  }, [allMeetings]);

  const isLoading = loadingDevs || loadingMeetings;

  return (
    <>
      <ManagementColumn
        title="1:1"
        icon={Users}
        count={devs.length}
      >
        {isLoading &&
          [0, 1].map((i) => (
            <div
              key={i}
              className="h-12 rounded-[var(--mtech-radius-md)] bg-[var(--mtech-surface-elev)] animate-pulse"
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
              const latest = latestByDev[dev.user_id];
              const hasThisWeek = latest?.week_start === weekStart;
              const rating = latest?.performance_rating ?? 0;

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
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] font-medium text-[var(--mtech-text)] truncate">
                        {dev.name}
                      </span>
                      {latest && (
                        <span className="text-[9px] text-[var(--mtech-text-subtle)]">
                          {(() => {
                            const [y, m, d] = latest.week_start.split('-').map(Number);
                            return format(new Date(y, m - 1, d), "dd MMM", { locale: ptBR });
                          })()}
                        </span>
                      )}
                    </div>
                    {/* Stars */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className="h-2.5 w-2.5"
                          fill={n <= rating ? 'var(--mtech-accent)' : 'transparent'}
                          stroke={n <= rating ? 'var(--mtech-accent)' : 'var(--mtech-text-subtle)'}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  </div>
                  {hasThisWeek && (
                    <span className="inline-block mt-1 text-[8px] font-medium text-[var(--mtech-success)] bg-[var(--mtech-success)]/10 px-1.5 py-0.5 rounded-full">
                      Esta semana
                    </span>
                  )}
                </button>
              );
            })}
      </ManagementColumn>

      {/* Detail dialog */}
      {selectedDev && (
        <OneOnOneDialog
          dev={selectedDev}
          weekStart={weekStart}
          existingMeeting={latestByDev[selectedDev.user_id]?.week_start === weekStart ? latestByDev[selectedDev.user_id] : undefined}
          onClose={() => setSelectedDev(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function OneOnOneDialog({
  dev,
  weekStart,
  existingMeeting,
  onClose,
}: {
  dev: DevInfo;
  weekStart: string;
  existingMeeting?: OneOnOneRow;
  onClose: () => void;
}) {
  const createMutation = useCreateOneOnOne();
  const { data: ctx } = useDevWeekContext(dev.user_id, weekStart);

  const [rating, setRating] = useState(existingMeeting?.performance_rating ?? 3);
  const [positives, setPositives] = useState(existingMeeting?.positives ?? '');
  const [improvements, setImprovements] = useState(existingMeeting?.improvements ?? '');
  const [agreements, setAgreements] = useState(existingMeeting?.agreements ?? '');
  const [notes, setNotes] = useState(existingMeeting?.notes ?? '');

  const handleSave = useCallback(() => {
    createMutation.mutate(
      {
        dev_user_id: dev.user_id,
        week_start: weekStart,
        performance_rating: rating,
        positives: positives || null,
        improvements: improvements || null,
        agreements: agreements || null,
        notes: notes || null,
      },
      { onSuccess: () => onClose() },
    );
  }, [dev.user_id, weekStart, rating, positives, improvements, agreements, notes, createMutation, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="mtech-scope max-w-lg max-h-[85vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--mtech-text)]">
            1:1 - {dev.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Reuniao 1:1 com {dev.name}
          </DialogDescription>
        </DialogHeader>

        {/* Context */}
        {ctx && (
          <div className="rounded-lg border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mtech-text-muted)]">
              Contexto automatico
            </p>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <span className="text-[var(--mtech-success)]">
                <strong>{ctx.tasks_completed}</strong> concluidas
              </span>
              <span className="text-[var(--mtech-danger)]">
                <strong>{ctx.tasks_delayed}</strong> atrasadas
              </span>
              <span className="text-[var(--mtech-accent)]">
                <strong>{ctx.dailies_filled}/{ctx.dailies_total}</strong> dailies
              </span>
            </div>
          </div>
        )}

        {/* Rating */}
        <div>
          <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-2">
            Performance geral
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                disabled={createMutation.isPending}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className="h-5 w-5"
                  fill={n <= rating ? 'var(--mtech-accent)' : 'transparent'}
                  stroke={n <= rating ? 'var(--mtech-accent)' : 'var(--mtech-text-subtle)'}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Text fields */}
        <div className="space-y-3">
          <TextareaField label="Pontos positivos" value={positives} onChange={setPositives} disabled={createMutation.isPending} />
          <TextareaField label="Pontos a melhorar" value={improvements} onChange={setImprovements} disabled={createMutation.isPending} />
          <TextareaField label="Acordos e proximos passos" value={agreements} onChange={setAgreements} disabled={createMutation.isPending} />
          <TextareaField label="Observacoes" value={notes} onChange={setNotes} disabled={createMutation.isPending} />
        </div>

        <Button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5 w-full"
        >
          <Save className="h-3.5 w-3.5" />
          {existingMeeting ? 'Atualizar' : 'Salvar'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        className="w-full rounded-lg border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors resize-none disabled:opacity-50"
        placeholder="..."
      />
    </div>
  );
}
