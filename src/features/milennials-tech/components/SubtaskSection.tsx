import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getInitials } from '../hooks/useProfiles';
import { ISSUE_STATUS_CONFIG, type IssueStatus } from '../lib/issueSystem';
import type { AssigneeOption } from './backlogTypes';

// ---------------------------------------------------------------------------
// SubtaskSection — the sub-task breakdown + inline create, on the issue-view.
//
// A sub-task is a real issue with its own status + assignee, but the domain
// forbids two things it would otherwise inherit: it does NOT point and it does
// NOT belong to an epic. So the inline composer deliberately exposes only a
// title + an assignee — no estimate field, no epic selector. Surfacing them
// would invite a state the DB rejects.
//
// The affordance is inline and keyboard-first: "+ Sub-tarefa" expands a single
// row (title autofocus · optional assignee · Enter to create · Esc to close).
// A quiet done/total progress sits in the header. Pure presentational — the
// engineer wires onCreate to the mutation.
// ---------------------------------------------------------------------------

export interface SubtaskItem {
  id: string;
  /** "AGS-42" — rendered mono. */
  key: string;
  title: string;
  status: IssueStatus;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
}

export interface SubtaskCreatePayload {
  title: string;
  assigneeId: string | null;
}

export interface SubtaskSectionProps {
  subtasks: SubtaskItem[];
  assignees: AssigneeOption[];
  onCreate: (payload: SubtaskCreatePayload) => void;
  isCreating?: boolean;
  onSubtaskClick?: (id: string) => void;
  /** Inline server error (e.g. permission / collision). */
  error?: string | null;
  /** Hide the create affordance (read-only viewer). */
  readOnly?: boolean;
  className?: string;
}

const NONE = '__none__';
const inputCls =
  'h-8 bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[13px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const selectContentCls =
  'mtech-scope bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

function StatusDot({ status }: { status: IssueStatus }) {
  const cfg = ISSUE_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span title={cfg.label} aria-label={`Status: ${cfg.label}`} className="flex-shrink-0">
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: cfg.color }} aria-hidden />
    </span>
  );
}

function MiniAssignee({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  if (!name) {
    return (
      <span
        title="Sem responsável"
        aria-label="Sem responsável"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--mtech-border-strong)] text-[9px] text-[var(--mtech-text-subtle)] select-none"
      >
        ?
      </span>
    );
  }
  return (
    <span
      title={name}
      aria-label={`Responsável: ${name}`}
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[9px] font-bold text-[var(--mtech-accent)] select-none"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

function SubtaskRow({
  subtask,
  onClick,
}: {
  subtask: SubtaskItem;
  onClick?: (id: string) => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={`${subtask.key} ${subtask.title}`}
      onClick={clickable ? () => onClick(subtask.id) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(subtask.id);
              }
            }
          : undefined
      }
      className={`flex h-9 items-center gap-2.5 rounded-[var(--mtech-radius-sm)] px-2 text-left ${
        clickable
          ? 'cursor-pointer transition-colors hover:bg-[var(--mtech-surface-elev)] focus-visible:outline-none focus-visible:bg-[var(--mtech-surface-elev)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]'
          : ''
      }`}
    >
      <StatusDot status={subtask.status} />
      <span
        data-mono
        className="w-[58px] flex-shrink-0 truncate text-[11px] font-semibold tracking-[0.06em] text-[var(--mtech-text-subtle)] select-none"
      >
        {subtask.key}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          subtask.status === 'DONE'
            ? 'text-[var(--mtech-text-subtle)] line-through'
            : 'text-[var(--mtech-text)]'
        }`}
      >
        {subtask.title}
      </span>
      <MiniAssignee name={subtask.assigneeName} avatarUrl={subtask.assigneeAvatar} />
    </div>
  );
}

export function SubtaskSection({
  subtasks,
  assignees,
  onCreate,
  isCreating = false,
  onSubtaskClick,
  error = null,
  readOnly = false,
  className = '',
}: SubtaskSectionProps) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === 'DONE').length;
  const titleValid = title.trim().length >= 2;

  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  // Close + reset the composer once a create round-trip finishes.
  const wasCreating = useRef(isCreating);
  useEffect(() => {
    if (wasCreating.current && !isCreating && !error) {
      setTitle('');
      setAssigneeId(null);
      setComposing(false);
    }
    wasCreating.current = isCreating;
  }, [isCreating, error]);

  function submit() {
    if (!titleValid || isCreating) return;
    onCreate({ title: title.trim(), assigneeId });
  }

  function cancel() {
    setTitle('');
    setAssigneeId(null);
    setComposing(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  return (
    <section className={className}>
      {/* Header — label · progress */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-muted)]">
          Sub-tarefas
        </h3>
        {total > 0 && (
          <span
            data-mono
            className="text-[11px] tabular-nums text-[var(--mtech-text-subtle)]"
            title={`${done} de ${total} concluídas`}
          >
            {done}/{total}
          </span>
        )}
        {total > 0 && (
          <div
            className="ml-1 h-1 w-16 overflow-hidden rounded-full bg-[var(--mtech-surface-elev)]"
            role="progressbar"
            aria-valuenow={total === 0 ? 0 : Math.round((done / total) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${done} de ${total} sub-tarefas concluídas`}
          >
            <span
              className="block h-full rounded-full bg-[var(--mtech-success)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* List */}
      {total > 0 ? (
        <div className="overflow-hidden rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)]">
          <div className="divide-y divide-[var(--mtech-border)] p-1">
            {subtasks.map((s) => (
              <SubtaskRow key={s.id} subtask={s} onClick={onSubtaskClick} />
            ))}
          </div>
        </div>
      ) : (
        !readOnly &&
        !composing && (
          <p className="mb-2 text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
            Quebre esta issue em partes menores. Sub-tarefas têm responsável e status próprios — mas
            não pontuam.
          </p>
        )
      )}

      {/* Inline composer */}
      {!readOnly && (
        <div className="mt-2">
          {composing ? (
            <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border-strong)] bg-[var(--mtech-bg)]/40 p-2">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="O que é a sub-tarefa?"
                  className={`${inputCls} flex-1`}
                  aria-label="Título da sub-tarefa"
                />
                <Select
                  value={assigneeId ?? NONE}
                  onValueChange={(v) => setAssigneeId(v === NONE ? null : v)}
                >
                  <SelectTrigger
                    className={`${inputCls} w-[150px] flex-shrink-0`}
                    aria-label="Responsável"
                  >
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent className={`${selectContentCls} max-h-56`}>
                    <SelectItem value={NONE}>Sem responsável</SelectItem>
                    {assignees.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[8px] font-bold text-[var(--mtech-accent)]">
                            {a.avatarUrl ? (
                              <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              getInitials(a.name)
                            )}
                          </span>
                          {a.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--mtech-text-subtle)]">
                  <kbd className="font-sans">Enter</kbd> cria ·{' '}
                  <kbd className="font-sans">Esc</kbd> cancela
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancel}
                    className="inline-flex h-7 items-center gap-1 rounded-[var(--mtech-radius-sm)] px-2.5 text-[12px] font-medium text-[var(--mtech-text-muted)] transition-colors hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!titleValid || isCreating}
                    className="inline-flex h-7 items-center rounded-[var(--mtech-radius-sm)] bg-[var(--mtech-accent)] px-3 text-[12px] font-semibold text-black transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] disabled:opacity-50 disabled:hover:brightness-100"
                  >
                    {isCreating ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </div>

              {error && (
                <p className="mt-2 rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-danger)]/30 bg-[var(--mtech-danger)]/10 px-2.5 py-1.5 text-[11px] text-[var(--mtech-danger)]">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="inline-flex h-8 w-full items-center gap-1.5 rounded-[var(--mtech-radius-sm)] border border-dashed border-[var(--mtech-border)] px-2.5 text-[12px] font-medium text-[var(--mtech-text-muted)] transition-colors hover:border-[var(--mtech-border-strong)] hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Adicionar sub-tarefa
            </button>
          )}
        </div>
      )}
    </section>
  );
}
