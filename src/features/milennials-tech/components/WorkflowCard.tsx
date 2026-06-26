import { useState, useId, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Ban, Undo2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { IssueCard, type IssueCardData } from './IssueCard';

// ---------------------------------------------------------------------------
// WorkflowCard — the board card, made transition-aware.
//
// Wraps the #154 IssueCard (untouched, purely visual here) inside a single
// rbd Draggable that doubles as the keyboard drag handle. Adds two affordances
// that live ON the card, revealed on hover/focus and bound to single-key
// shortcuts on the focused card:
//
//   · Bloquear / Desbloquear (B) — blocking opens a reason popover; reason is
//     mandatory. Unblocking is immediate.
//   · Reprovar (R)               — only in REVIEW / AWAITING_APPROVAL; sends the
//     issue to CHANGES_REQUESTED via onReject.
//
// One tab stop per card (the drag handle). The action buttons are mouse targets
// and are reachable by keyboard through the B / R shortcuts — the same model
// Linear uses for focused-item actions. Pure presentational: every state change
// is emitted upward, never owned here.
// ---------------------------------------------------------------------------

export interface WorkflowCardProps {
  issue: IssueCardData;
  /** Position within its column — required by rbd Draggable. */
  index: number;
  /** Reject is only meaningful in REVIEW / AWAITING_APPROVAL. */
  canReject: boolean;
  /** When the issue has zero legal targets, drag is disabled (terminal state). */
  draggable: boolean;
  /** True while any card on the board is mid-drag — suppresses the action bar. */
  isAnyDragActive: boolean;
  onOpenCard?: (id: string) => void;
  onReject: (id: string) => void;
  onToggleBlocked: (id: string, blocked: boolean, reason?: string) => void;
}

// ---------------------------------------------------------------------------
// BlockReasonForm — the popover body. Mandatory, trimmed reason.
// ---------------------------------------------------------------------------

function BlockReasonForm({
  issueKey,
  onConfirm,
  onCancel,
}: {
  issueKey: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const fieldId = useId();
  const valid = reason.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onConfirm(reason.trim());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Ban
          className="h-3.5 w-3.5 flex-shrink-0 text-[var(--mtech-state-blocked)]"
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="text-[13px] font-semibold text-[var(--mtech-text)]">
          Bloquear{' '}
          <span data-mono className="text-[var(--mtech-text-muted)]">
            {issueKey}
          </span>
        </span>
      </div>

      <textarea
        id={fieldId}
        autoFocus
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
          // Keep card-level shortcuts from firing while typing.
          e.stopPropagation();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="O que está bloqueando esta issue?"
        aria-label="Motivo do bloqueio"
        className="w-full resize-none rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] px-2.5 py-2 text-[12px] leading-snug text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--mtech-text-subtle)]">
          Motivo obrigatório
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--mtech-radius-sm)] px-2.5 py-1 text-[11px] font-medium text-[var(--mtech-text-muted)] transition-colors hover:bg-[var(--mtech-surface)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="rounded-[var(--mtech-radius-sm)] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: 'var(--mtech-state-blocked)' }}
          >
            Bloquear
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionButton — the hover-revealed icon control.
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  onClick,
  color,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="flex h-6 w-6 items-center justify-center rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text-muted)] transition-colors hover:border-[var(--mtech-border-strong)]"
      onMouseEnter={(e) => (e.currentTarget.style.color = color)}
      onMouseLeave={(e) => (e.currentTarget.style.color = '')}
    >
      {children}
    </button>
  );
}

export function WorkflowCard({
  issue,
  index,
  canReject,
  draggable,
  isAnyDragActive,
  onOpenCard,
  onReject,
  onToggleBlocked,
}: WorkflowCardProps) {
  const [blockOpen, setBlockOpen] = useState(false);

  const toggleBlock = () => {
    if (issue.isBlocked) {
      onToggleBlocked(issue.id, false);
    } else {
      setBlockOpen(true);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // rbd owns Space / arrows / Escape via its global keyboard sensor.
    // We only claim the discrete-action keys, and never while the popover types.
    if (e.defaultPrevented || blockOpen) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') {
      e.preventDefault();
      onOpenCard?.(issue.id);
    } else if (k === 'b') {
      e.preventDefault();
      toggleBlock();
    } else if (k === 'r' && canReject) {
      e.preventDefault();
      onReject(issue.id);
    }
  };

  const barVisible = !isAnyDragActive;

  return (
    <Draggable draggableId={issue.id} index={index} isDragDisabled={!draggable}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          aria-label={`${issue.key}: ${issue.title}`}
          onKeyDown={handleKeyDown}
          onClick={() => onOpenCard?.(issue.id)}
          className={`group relative rounded-[var(--mtech-radius-md)] outline-none transition-shadow focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)] motion-reduce:transition-none ${
            draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
          style={provided.draggableProps.style}
        >
          <IssueCard issue={issue} isDragging={snapshot.isDragging} />

          {/* Action bar — revealed on hover/focus, or held open while blocking. */}
          {barVisible && (
            <div
              className={`absolute right-1.5 top-1.5 flex items-center gap-1 transition-opacity duration-100 motion-reduce:transition-none ${
                blockOpen
                  ? 'opacity-100'
                  : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
              }`}
            >
              {canReject && (
                <ActionButton
                  label="Reprovar (R) — envia para Alterações pedidas"
                  color="var(--mtech-status-changes)"
                  onClick={() => onReject(issue.id)}
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden />
                </ActionButton>
              )}

              <Popover open={blockOpen} onOpenChange={setBlockOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={issue.isBlocked ? 'Desbloquear (B)' : 'Bloquear (B)'}
                    title={issue.isBlocked ? 'Desbloquear (B)' : 'Bloquear (B)'}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBlock();
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-[var(--mtech-radius-sm)] border transition-colors"
                    style={
                      issue.isBlocked
                        ? {
                            color: 'var(--mtech-state-blocked)',
                            backgroundColor: 'var(--mtech-state-blocked-bg)',
                            borderColor: 'transparent',
                          }
                        : {
                            color: 'var(--mtech-text-muted)',
                            backgroundColor: 'var(--mtech-surface-elev)',
                            borderColor: 'var(--mtech-border)',
                          }
                    }
                  >
                    <Ban className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={6}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-72 rounded-[var(--mtech-radius-lg)] border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] p-3.5"
                  style={{ boxShadow: 'var(--mtech-shadow-card)' }}
                >
                  <BlockReasonForm
                    issueKey={issue.key}
                    onConfirm={(reason) => {
                      onToggleBlocked(issue.id, true, reason);
                      setBlockOpen(false);
                    }}
                    onCancel={() => setBlockOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
