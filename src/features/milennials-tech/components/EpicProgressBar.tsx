import { Check } from 'lucide-react';
import type { EpicRollup } from '../lib/rollup';

// ---------------------------------------------------------------------------
// EpicProgressBar — the epic's completion read, driven by an EpicRollup.
//
// The fill carries the epic's IDENTITY color (same hue as the rail/dot/chip
// elsewhere), so progress reads as "this epic" rather than a generic green bar.
// Completion is communicated three ways, redundantly (never color alone):
// the fill width, the percentage value, and — only at 100% — a quiet success
// check. Progress is over ISSUES (doneCount/issueCount), matching the rollup.
//
// Pure presentational. Engineer pairs against EpicProgressBarProps.
// ---------------------------------------------------------------------------

export interface EpicProgressBarProps {
  rollup: EpicRollup;
  /** Epic identity color (CSS color). Defaults to muted text when omitted. */
  color?: string | null;
  /** 'md' (epic header) | 'sm' (inline, dense lists). */
  size?: 'sm' | 'md';
  /** Show the trailing "62%" value. Default true. */
  showValue?: boolean;
  className?: string;
}

const TRACK = { sm: 'h-1', md: 'h-1.5' } as const;

export function EpicProgressBar({
  rollup,
  color,
  size = 'md',
  showValue = true,
  className = '',
}: EpicProgressBarProps) {
  const pct = Math.max(0, Math.min(100, rollup.progressPct));
  const complete = rollup.issueCount > 0 && pct >= 100;
  const empty = rollup.issueCount === 0;
  const fill = color ?? 'var(--mtech-text-subtle)';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          empty
            ? 'Epic sem issues'
            : `${rollup.doneCount} de ${rollup.issueCount} issues concluídas`
        }
        className={`relative min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--mtech-surface-elev)] ${TRACK[size]}`}
      >
        {!empty && (
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{
              width: `${pct}%`,
              backgroundColor: fill,
              // A whisper of inner light so the fill reads as a material, not a flat block.
              boxShadow: complete ? `0 0 0 0.5px ${fill} inset` : undefined,
            }}
          />
        )}
      </div>

      {showValue && (
        <span
          data-mono
          className={`flex flex-shrink-0 items-center gap-1 tabular-nums ${
            size === 'md' ? 'text-[12px]' : 'text-[11px]'
          } font-semibold`}
          style={{ color: complete ? 'var(--mtech-success)' : 'var(--mtech-text-muted)' }}
        >
          {complete && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
          {empty ? '—' : `${pct}%`}
        </span>
      )}
    </div>
  );
}
