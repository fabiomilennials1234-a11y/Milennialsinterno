import { CornerDownRight, ListTree } from 'lucide-react';

// ---------------------------------------------------------------------------
// SubtaskIndicator — the two-way sub-task signal, discreet but legible.
//
// A sub-task is a real issue with its own status/assignee, distinguished only
// by having a parent. Two orthogonal facts need surfacing on a board/card:
//
//   variant="is-subtask"   → THIS card is a sub-task. Shows a corner-return
//                            glyph + the parent's mono key (the Jira parent
//                            breadcrumb). Optional onParentClick to jump up.
//   variant="has-subtasks" → THIS issue OWNS sub-tasks. Shows a tree glyph +
//                            "done/total" (or just total). The fraction is the
//                            cheapest possible progress signal on a dense card.
//
// Both are muted by default — they inform, they don't shout. Pure presentational.
// Engineer pairs against SubtaskIndicatorProps.
// ---------------------------------------------------------------------------

export type SubtaskIndicatorProps = (
  | {
      variant: 'is-subtask';
      /** Parent issue key, e.g. "AGS-12". Rendered mono. */
      parentKey: string;
      /** Jump to the parent. When set, the breadcrumb becomes interactive. */
      onParentClick?: () => void;
    }
  | {
      variant: 'has-subtasks';
      /** Total sub-tasks. */
      total: number;
      /** Completed sub-tasks. When given, renders "done/total". */
      done?: number;
    }
) & {
  size?: 'sm' | 'md';
  className?: string;
};

const TEXT = { sm: 'text-[10px]', md: 'text-[11px]' } as const;
const ICON = { sm: 'h-3 w-3', md: 'h-3.5 w-3.5' } as const;

export function SubtaskIndicator(props: SubtaskIndicatorProps) {
  const { size = 'sm', className = '' } = props;

  if (props.variant === 'is-subtask') {
    const interactive = !!props.onParentClick;
    const content = (
      <>
        <CornerDownRight
          className={`${ICON[size]} flex-shrink-0 text-[var(--mtech-text-subtle)]`}
          strokeWidth={2.25}
          aria-hidden
        />
        <span
          data-mono
          className={`truncate font-semibold tracking-[0.06em] ${TEXT[size]} text-[var(--mtech-text-muted)]`}
        >
          {props.parentKey}
        </span>
      </>
    );

    if (interactive) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            props.onParentClick?.();
          }}
          aria-label={`Sub-tarefa de ${props.parentKey}`}
          className={`inline-flex max-w-full items-center gap-1 rounded-[var(--mtech-radius-sm)] px-1 py-0.5 transition-colors hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)] ${className}`}
        >
          {content}
        </button>
      );
    }

    return (
      <span
        title={`Sub-tarefa de ${props.parentKey}`}
        aria-label={`Sub-tarefa de ${props.parentKey}`}
        className={`inline-flex max-w-full items-center gap-1 ${className}`}
      >
        {content}
      </span>
    );
  }

  // variant === 'has-subtasks'
  if (props.total <= 0) return null;
  const hasDone = props.done !== undefined;
  const label = hasDone
    ? `${props.done} de ${props.total} sub-tarefas concluídas`
    : `${props.total} ${props.total === 1 ? 'sub-tarefa' : 'sub-tarefas'}`;

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-[var(--mtech-text-subtle)] select-none ${className}`}
    >
      <ListTree className={`${ICON[size]} flex-shrink-0`} strokeWidth={2.25} aria-hidden />
      <span data-mono className={`tabular-nums font-medium ${TEXT[size]}`}>
        {hasDone ? `${props.done}/${props.total}` : props.total}
      </span>
    </span>
  );
}
