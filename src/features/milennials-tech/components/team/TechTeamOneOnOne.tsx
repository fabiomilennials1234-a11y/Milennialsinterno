import { useState, useMemo, useCallback } from 'react';
import {
  Star,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Save,
} from 'lucide-react';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTechDevs } from '../../hooks/useTechDevDailies';
import {
  useTechOneOnOnes,
  useCreateOneOnOne,
  useDevWeekContext,
  type OneOnOneRow,
} from '../../hooks/useTechOneOnOnes';

// ---------------------------------------------------------------------------
// Select styles
// ---------------------------------------------------------------------------

const selectCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] text-xs h-9';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------

function getWeekStart(d: Date = new Date()): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function getWeekOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    options.push({
      value: format(ws, 'yyyy-MM-dd'),
      label: `Semana de ${format(ws, "dd 'de' MMM", { locale: ptBR })}`,
    });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => !disabled && onChange(n)}
          disabled={disabled}
          className="p-0.5 transition-transform hover:scale-110 disabled:hover:scale-100"
        >
          <Star
            className="h-5 w-5 transition-colors"
            fill={n <= value ? 'var(--mtech-accent)' : 'transparent'}
            stroke={n <= value ? 'var(--mtech-accent)' : 'var(--mtech-text-subtle)'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context panel
// ---------------------------------------------------------------------------

function ContextPanel({ devId, weekStart }: { devId: string; weekStart: string }) {
  const { data: ctx, isLoading } = useDevWeekContext(devId, weekStart);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-[var(--mtech-surface-elev)] p-3 animate-pulse h-20" />
    );
  }

  if (!ctx) return null;

  return (
    <div className="rounded-lg border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mtech-text-muted)]">
        Contexto automatico
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-[var(--mtech-success)]" />
          <span className="text-[11px] text-[var(--mtech-text)]">
            <span className="font-semibold tabular-nums">{ctx.tasks_completed}</span>{' '}
            <span className="text-[var(--mtech-text-muted)]">tarefa{ctx.tasks_completed !== 1 ? 's' : ''} concluida{ctx.tasks_completed !== 1 ? 's' : ''}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-[var(--mtech-danger)]" />
          <span className="text-[11px] text-[var(--mtech-text)]">
            <span className="font-semibold tabular-nums">{ctx.tasks_delayed}</span>{' '}
            <span className="text-[var(--mtech-text-muted)]">atrasada{ctx.tasks_delayed !== 1 ? 's' : ''}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-[var(--mtech-accent)]" />
          <span className="text-[11px] text-[var(--mtech-text)]">
            <span className="font-semibold tabular-nums">{ctx.dailies_filled}/{ctx.dailies_total}</span>{' '}
            <span className="text-[var(--mtech-text-muted)]">dailies</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History card
// ---------------------------------------------------------------------------

function HistoryCard({ meeting }: { meeting: OneOnOneRow }) {
  const [expanded, setExpanded] = useState(false);
  const [y, m, d] = meeting.week_start.split('-').map(Number);
  const dateLabel = format(new Date(y, m - 1, d), "dd 'de' MMM yyyy", { locale: ptBR });

  return (
    <div className="rounded-lg border border-[var(--mtech-border)] bg-[var(--mtech-surface)] transition-colors">
      <button
        className="w-full p-3 flex items-center justify-between hover:bg-[var(--mtech-surface-elev)]/50 transition-colors rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[var(--mtech-text)]">
            Semana de {dateLabel}
          </span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className="h-3 w-3"
                fill={n <= meeting.performance_rating ? 'var(--mtech-accent)' : 'transparent'}
                stroke={n <= meeting.performance_rating ? 'var(--mtech-accent)' : 'var(--mtech-text-subtle)'}
                strokeWidth={1.5}
              />
            ))}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-[var(--mtech-text-subtle)]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--mtech-text-subtle)]" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--mtech-border)]/50 pt-2">
          {meeting.positives && (
            <div>
              <p className="text-[10px] font-medium text-[var(--mtech-text-muted)] mb-0.5">Pontos positivos</p>
              <p className="text-[11px] text-[var(--mtech-text)] whitespace-pre-wrap">{meeting.positives}</p>
            </div>
          )}
          {meeting.improvements && (
            <div>
              <p className="text-[10px] font-medium text-[var(--mtech-text-muted)] mb-0.5">Pontos a melhorar</p>
              <p className="text-[11px] text-[var(--mtech-text)] whitespace-pre-wrap">{meeting.improvements}</p>
            </div>
          )}
          {meeting.agreements && (
            <div>
              <p className="text-[10px] font-medium text-[var(--mtech-text-muted)] mb-0.5">Acordos e proximos passos</p>
              <p className="text-[11px] text-[var(--mtech-text)] whitespace-pre-wrap">{meeting.agreements}</p>
            </div>
          )}
          {meeting.notes && (
            <div>
              <p className="text-[10px] font-medium text-[var(--mtech-text-muted)] mb-0.5">Observacoes</p>
              <p className="text-[11px] text-[var(--mtech-text)] whitespace-pre-wrap">{meeting.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TechTeamOneOnOne() {
  const [selectedDev, setSelectedDev] = useState<string>('');
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const weekOptions = useMemo(() => getWeekOptions(), []);

  // Form state
  const [rating, setRating] = useState(3);
  const [positives, setPositives] = useState('');
  const [improvements, setImprovements] = useState('');
  const [agreements, setAgreements] = useState('');
  const [notes, setNotes] = useState('');

  const { data: devs = [], isLoading: loadingDevs } = useTechDevs();
  const { data: history = [], isLoading: loadingHistory } = useTechOneOnOnes(selectedDev || undefined);
  const createMutation = useCreateOneOnOne();

  // Check if a meeting already exists for this dev+week to pre-populate
  const existingMeeting = useMemo(() => {
    return history.find((m) => m.week_start === weekStart);
  }, [history, weekStart]);

  // Pre-populate form when existing meeting found or dev/week changes
  const lastLoadedKey = useMemo(() => `${selectedDev}-${weekStart}`, [selectedDev, weekStart]);
  const [loadedKey, setLoadedKey] = useState('');

  if (lastLoadedKey !== loadedKey && existingMeeting) {
    setRating(existingMeeting.performance_rating);
    setPositives(existingMeeting.positives ?? '');
    setImprovements(existingMeeting.improvements ?? '');
    setAgreements(existingMeeting.agreements ?? '');
    setNotes(existingMeeting.notes ?? '');
    setLoadedKey(lastLoadedKey);
  } else if (lastLoadedKey !== loadedKey && !existingMeeting && !loadingHistory) {
    setRating(3);
    setPositives('');
    setImprovements('');
    setAgreements('');
    setNotes('');
    setLoadedKey(lastLoadedKey);
  }

  const handleSave = useCallback(() => {
    if (!selectedDev) return;
    createMutation.mutate({
      dev_user_id: selectedDev,
      week_start: weekStart,
      performance_rating: rating,
      positives: positives || null,
      improvements: improvements || null,
      agreements: agreements || null,
      notes: notes || null,
    });
  }, [selectedDev, weekStart, rating, positives, improvements, agreements, notes, createMutation]);

  const pastMeetings = useMemo(() => {
    return history.filter((m) => m.week_start !== weekStart);
  }, [history, weekStart]);

  return (
    <div className="space-y-6">
      {/* Dev + Week selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedDev} onValueChange={setSelectedDev}>
          <SelectTrigger className={`${selectCls} w-[200px]`}>
            <Users className="h-3 w-3 mr-1.5 flex-shrink-0 text-[var(--mtech-text-subtle)]" />
            <SelectValue placeholder="Selecionar dev..." />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {loadingDevs ? (
              <SelectItem value="_loading" disabled>Carregando...</SelectItem>
            ) : (
              devs.map((d) => (
                <SelectItem key={d.user_id} value={d.user_id}>{d.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={weekStart} onValueChange={setWeekStart}>
          <SelectTrigger className={`${selectCls} w-[220px]`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {weekOptions.map((w) => (
              <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedDev ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <Users className="h-6 w-6 text-[var(--mtech-text-subtle)]" />
          <p className="text-xs text-[var(--mtech-text-subtle)]">Selecione um dev para iniciar.</p>
        </div>
      ) : (
        <>
          {/* Auto context */}
          <ContextPanel devId={selectedDev} weekStart={weekStart} />

          {/* Form */}
          <div className="rounded-xl border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-[var(--mtech-text)]">
                {existingMeeting ? 'Editar Reuniao' : 'Nova Reuniao'} 1:1
              </h3>
              {existingMeeting && (
                <span className="text-[9px] font-medium text-[var(--mtech-success)] bg-[var(--mtech-success)]/10 px-2 py-0.5 rounded-full">
                  Ja registrada
                </span>
              )}
            </div>

            {/* Rating */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-2">
                Performance geral
              </label>
              <StarRating value={rating} onChange={setRating} disabled={createMutation.isPending} />
            </div>

            {/* Text fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-1">
                  Pontos positivos
                </label>
                <textarea
                  value={positives}
                  onChange={(e) => setPositives(e.target.value)}
                  disabled={createMutation.isPending}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors resize-none disabled:opacity-50"
                  placeholder="O que o dev fez bem..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-1">
                  Pontos a melhorar
                </label>
                <textarea
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  disabled={createMutation.isPending}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors resize-none disabled:opacity-50"
                  placeholder="Onde pode melhorar..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-1">
                  Acordos e proximos passos
                </label>
                <textarea
                  value={agreements}
                  onChange={(e) => setAgreements(e.target.value)}
                  disabled={createMutation.isPending}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors resize-none disabled:opacity-50"
                  placeholder="O que ficou combinado..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--mtech-text-muted)] mb-1">
                  Observacoes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={createMutation.isPending}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-3 py-2 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors resize-none disabled:opacity-50"
                  placeholder="Notas adicionais..."
                />
              </div>
            </div>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {existingMeeting ? 'Atualizar' : 'Salvar'} Reuniao
            </Button>
          </div>

          {/* History */}
          {pastMeetings.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[12px] font-medium text-[var(--mtech-text-muted)] uppercase tracking-wider">
                Historico de reunioes
              </h3>
              {pastMeetings.map((m) => (
                <HistoryCard key={m.id} meeting={m} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
