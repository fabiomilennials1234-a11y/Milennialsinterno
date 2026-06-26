import { type ReactNode } from 'react';
import { AlertTriangle, Plus, RotateCw, Zap } from 'lucide-react';
import { EpicHeader, type EpicHeaderData } from './EpicHeader';
import { EpicIssueRow, type EpicChildIssue } from './EpicIssueRow';
import type { EpicRollup } from '../lib/rollup';

// ---------------------------------------------------------------------------
// EpicView — the full epic surface: identity + rollup header over the dense
// list of child issues. Composes EpicHeader + EpicIssueRow and owns the four
// states a list always has — loading, empty, error, and the happy path (which
// scrolls under overflow).
//
// Progress is over ISSUES; sub-tasks never appear here (they hang off their
// parent issue in the issue-view). Pure presentational. Engineer pairs against
// EpicViewProps and feeds it a precomputed EpicRollup.
// ---------------------------------------------------------------------------

export interface EpicViewProps {
  epic: EpicHeaderData;
  rollup: EpicRollup;
  issues: EpicChildIssue[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onIssueClick?: (id: string) => void;
  /** Add an issue to the epic. Surfaces in the header + the empty state. */
  onAddIssue?: () => void;
  /** Demand-link slot on the identity line, typically <EpicDemandaLink>. */
  headerDemanda?: ReactNode;
  /** Highlighted row id (j/k navigation). */
  selectedId?: string | null;
  className?: string;
}

function AddIssueButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] px-2.5 text-[12px] font-medium text-[var(--mtech-text-muted)] transition-colors hover:border-[var(--mtech-border-strong)] hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      Issue
    </button>
  );
}

export function EpicView({
  epic,
  rollup,
  issues,
  loading = false,
  error = null,
  onRetry,
  onIssueClick,
  onAddIssue,
  headerDemanda,
  selectedId,
  className = '',
}: EpicViewProps) {
  return (
    <section
      className={`mtech-scope flex flex-col overflow-hidden rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] ${className}`}
      style={{ boxShadow: 'var(--mtech-shadow-card)' }}
    >
      {/* Header */}
      <div className="border-b border-[var(--mtech-border)] px-5 py-4 md:px-6 md:py-5">
        {loading ? (
          <EpicHeaderSkeleton />
        ) : (
          <EpicHeader
            epic={epic}
            rollup={rollup}
            demanda={headerDemanda}
            actions={onAddIssue ? <AddIssueButton onClick={onAddIssue} /> : undefined}
          />
        )}
      </div>

      {/* Body */}
      <div className="min-h-[160px]">
        {loading ? (
          <EpicListSkeleton />
        ) : error ? (
          <EpicErrorState message={error} onRetry={onRetry} />
        ) : issues.length === 0 ? (
          <EpicEmptyState onAddIssue={onAddIssue} />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-[var(--mtech-border)] overflow-y-auto">
            {issues.map((issue) => (
              <li key={issue.id}>
                <EpicIssueRow
                  issue={issue}
                  onClick={onIssueClick}
                  isSelected={selectedId === issue.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function EpicEmptyState({ onAddIssue }: { onAddIssue?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text-subtle)]"
      >
        <Zap className="h-5 w-5" strokeWidth={2} />
      </span>
      <p className="text-[14px] font-medium text-[var(--mtech-text)]">Epic ainda sem issues</p>
      <p className="mt-1 max-w-[300px] text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
        Um epic é o guarda-chuva. Adicione as primeiras issues para o progresso começar a contar.
      </p>
      {onAddIssue && (
        <button
          type="button"
          onClick={onAddIssue}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[var(--mtech-radius-sm)] bg-[var(--mtech-accent)] px-3.5 text-[12px] font-semibold text-black transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
          Adicionar issue
        </button>
      )}
    </div>
  );
}

function EpicErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--mtech-radius-md)] border border-[var(--mtech-danger)]/30 bg-[var(--mtech-danger)]/10 text-[var(--mtech-danger)]"
      >
        <AlertTriangle className="h-5 w-5" strokeWidth={2} />
      </span>
      <p className="text-[14px] font-medium text-[var(--mtech-text)]">Não deu para carregar o epic</p>
      <p className="mt-1 max-w-[320px] text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border-strong)] bg-[var(--mtech-input-bg)] px-3.5 text-[12px] font-medium text-[var(--mtech-text-muted)] transition-colors hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
        >
          <RotateCw className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Tentar de novo
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons — coherent pulse on surface-elev (matches the tracer baseline).
// ---------------------------------------------------------------------------

function EpicHeaderSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-5 rounded-[5px] bg-[var(--mtech-surface-elev)]" />
        <span className="h-3 w-24 rounded bg-[var(--mtech-surface-elev)]" />
      </div>
      <span className="h-5 w-2/3 rounded bg-[var(--mtech-surface-elev)]" />
      <div className="flex items-center gap-5">
        <span className="h-1.5 w-[320px] max-w-full rounded-full bg-[var(--mtech-surface-elev)]" />
        <span className="h-3 w-28 rounded bg-[var(--mtech-surface-elev)]" />
      </div>
    </div>
  );
}

function EpicListSkeleton() {
  return (
    <ul className="animate-pulse divide-y divide-[var(--mtech-border)]">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex h-10 items-center gap-2.5 px-3">
          <span className="h-4 w-4 flex-shrink-0 rounded-[3px] bg-[var(--mtech-surface-elev)]" />
          <span className="h-3 w-14 flex-shrink-0 rounded bg-[var(--mtech-surface-elev)]" />
          <span
            className="h-3 flex-1 rounded bg-[var(--mtech-surface-elev)]"
            style={{ maxWidth: `${52 + ((i * 13) % 34)}%` }}
          />
          <span className="h-[20px] w-16 flex-shrink-0 rounded-full bg-[var(--mtech-surface-elev)]" />
          <span className="h-5 w-5 flex-shrink-0 rounded-full bg-[var(--mtech-surface-elev)]" />
        </li>
      ))}
    </ul>
  );
}
