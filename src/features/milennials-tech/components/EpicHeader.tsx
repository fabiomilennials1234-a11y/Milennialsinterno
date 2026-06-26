import { type ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { epicColorFromKey } from '../lib/issueSystem';
import type { EpicRollup } from '../lib/rollup';
import { EpicProgressBar } from './EpicProgressBar';

// ---------------------------------------------------------------------------
// EpicHeader — the epic's identity + rollup, at the top of the epic view.
//
//   ▟ EPIC · AGS-EPIC-3                                        [ + Issue ]
//   Checkout reativo de ponta a ponta
//   ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  62%        12/19 issues · 18/29 pts
//
// The epic marker is a solid color square (epic identity hue from the hash) +
// a bolt glyph + the "EPIC" label — deliberately one size up from the type
// glyph so an epic never reads as a Story/Bug/Task. The hash color flows into
// the marker, the progress fill, and (downstream) the rail/dot/chip on every
// child — one epic, one hue, everywhere.
//
// Pure presentational. Engineer pairs against EpicHeaderData / EpicHeaderProps.
// ---------------------------------------------------------------------------

export interface EpicHeaderData {
  id: string;
  /** Epic key, e.g. "AGS-EPIC-3" — rendered mono. */
  key: string;
  title: string;
  /** Explicit identity color (CSS). Omit to derive from the key via hash. */
  color?: string | null;
}

export interface EpicHeaderProps {
  epic: EpicHeaderData;
  rollup: EpicRollup;
  /** Right-aligned actions, e.g. an "add issue" button. */
  actions?: ReactNode;
  /**
   * Demand link slot — sits on the identity line after the key, reading as a
   * metadata chip ("◷ link · demanda · status"). Typically <EpicDemandaLink>.
   * Omit for internal projects or when the link surface lives elsewhere.
   */
  demanda?: ReactNode;
  className?: string;
}

export function EpicHeader({ epic, rollup, actions, demanda, className = '' }: EpicHeaderProps) {
  const color = epic.color ?? epicColorFromKey(epic.key);
  const empty = rollup.issueCount === 0;

  return (
    <header className={`flex flex-col gap-3.5 ${className}`}>
      {/* Identity line — marker · key · actions */}
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px]"
          style={{ backgroundColor: color }}
        >
          <Zap className="h-3 w-3 text-black/85" strokeWidth={2.75} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)]">
          Epic
        </span>
        <span
          data-mono
          className="text-[11px] font-semibold tracking-[0.08em] text-[var(--mtech-text-muted)] select-none"
        >
          {epic.key}
        </span>
        {demanda && (
          <>
            <span aria-hidden className="text-[var(--mtech-text-subtle)] select-none">
              ·
            </span>
            <div className="min-w-0">{demanda}</div>
          </>
        )}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {/* Title — leads the header, editorial weight */}
      <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-[var(--mtech-text)]">
        {epic.title}
      </h1>

      {/* Rollup — progress + tallies */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <EpicProgressBar rollup={rollup} color={color} size="md" className="sm:max-w-[320px]" />

        <div className="flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1.5 text-[var(--mtech-text-muted)]">
            <span data-mono className="font-semibold tabular-nums text-[var(--mtech-text)]">
              {rollup.doneCount}
            </span>
            <span className="text-[var(--mtech-text-subtle)]">/</span>
            <span data-mono className="tabular-nums">
              {rollup.issueCount}
            </span>
            <span className="text-[var(--mtech-text-subtle)]">
              {rollup.issueCount === 1 ? 'issue' : 'issues'}
            </span>
          </span>

          {!empty && (
            <>
              <span aria-hidden className="text-[var(--mtech-text-subtle)]">
                ·
              </span>
              <span
                className="flex items-center gap-1.5 text-[var(--mtech-text-muted)]"
                title="Pontos concluídos sobre pontos totais das issues"
              >
                <span data-mono className="font-semibold tabular-nums text-[var(--mtech-text)]">
                  {rollup.donePoints}
                </span>
                <span className="text-[var(--mtech-text-subtle)]">/</span>
                <span data-mono className="tabular-nums">
                  {rollup.totalPoints}
                </span>
                <span className="text-[var(--mtech-text-subtle)]">pts</span>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
