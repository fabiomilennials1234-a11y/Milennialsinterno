import { Layers } from 'lucide-react';
import { BoardSwimlane } from './BoardColumn';
import { WorkflowBoard } from './WorkflowBoard';
import { SQUAD_CONFIG, type IssueSquad } from './backlogTypes';
import type { BoardColumnModel } from '../lib/boardModel';
import type { WorkflowBoardProps } from './workflowBoardContract';

// ---------------------------------------------------------------------------
// SprintBoard (#161) — the sprint surface, grouped into squad swimlanes.
//
// One BoardSwimlane per squad (Frontend / Backend / Sem squad), each wrapping
// its OWN WorkflowBoard instance. Drag-and-drop is therefore scoped *inside* a
// squad: rbd's DragDropContext lives in WorkflowBoard, so a card can never be
// dragged across the Front/Back boundary by construction — the swimlane is the
// hard wall the workflow asks for, not a hint.
//
// Squad order is fixed (FRONT → BACK), with an optional "Sem squad" lane last,
// rendered only when it actually holds issues — an empty bucket for unassigned
// work would be noise, so it stays invisible until it earns its row.
//
// Zero data, zero query, zero supabase. Lanes arrive shaped; every interaction
// is a callback out, forwarded verbatim to each WorkflowBoard. The container
// owns membership, legality and persistence.
// ---------------------------------------------------------------------------

export interface SprintBoardLane {
  squad: IssueSquad | null;
  columns: BoardColumnModel[];
  count: number;
}

export interface SprintBoardProps {
  /** Ordered: FRONT, BACK, then null ("Sem squad") when it carries issues. */
  lanes: SprintBoardLane[];
  isLegalTarget: WorkflowBoardProps['isLegalTarget'];
  onMove: WorkflowBoardProps['onMove'];
  onReject: WorkflowBoardProps['onReject'];
  onToggleBlocked: WorkflowBoardProps['onToggleBlocked'];
  onOpenCard?: WorkflowBoardProps['onOpenCard'];
}

const LANE_LABEL: Record<IssueSquad, string> = {
  FRONT: 'Frontend',
  BACK: 'Backend',
};

function laneLabel(squad: IssueSquad | null): string {
  return squad ? LANE_LABEL[squad] : 'Sem squad';
}

function laneAccent(squad: IssueSquad | null): string {
  return squad ? SQUAD_CONFIG[squad].color : 'var(--mtech-text-subtle)';
}

// ---------------------------------------------------------------------------
// Empty sprint — the board has no issues in any lane. This is the resting
// state of a fresh PLANNING sprint, so the copy points at the next action
// (pull from backlog) instead of apologising for the void.
// ---------------------------------------------------------------------------

function SprintBoardEmpty() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[var(--mtech-radius-lg)] border border-dashed border-[var(--mtech-border)] px-6 text-center">
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-surface)]"
      >
        <Layers className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
      </span>
      <div className="space-y-1">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--mtech-text)]">
          Puxe issues do backlog pra montar o sprint
        </p>
        <p className="text-[12px] text-[var(--mtech-text-subtle)]">
          As issues aparecem aqui agrupadas por squad — Frontend e Backend.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SprintBoard
// ---------------------------------------------------------------------------

export function SprintBoard({
  lanes,
  isLegalTarget,
  onMove,
  onReject,
  onToggleBlocked,
  onOpenCard,
}: SprintBoardProps) {
  // A null-squad lane only earns a row once it holds work; squad lanes always
  // render (an empty Front/Back lane still teaches the board's structure).
  const visibleLanes = lanes.filter((lane) => lane.squad !== null || lane.count > 0);
  const totalCount = visibleLanes.reduce((sum, lane) => sum + lane.count, 0);

  if (visibleLanes.length === 0 || totalCount === 0) {
    return <SprintBoardEmpty />;
  }

  return (
    <div className="flex flex-col gap-5">
      {visibleLanes.map((lane, index) => {
        const key = lane.squad ?? '__none__';
        // The keyboard legend is a board-level affordance, not a per-lane one:
        // repeating it under every swimlane is the gap #161 flagged. We show it
        // exactly once — under the last *visible* lane — so it reads as the
        // board's footer. `visibleLanes` is already filtered (the null lane
        // drops out when empty), so "last" tracks the live layout: when only
        // Front/Back render, Back carries the legend; when "Sem squad" earns a
        // row, it inherits it.
        const isLastVisibleLane = index === visibleLanes.length - 1;
        return (
          <BoardSwimlane
            key={key}
            label={laneLabel(lane.squad)}
            count={lane.count}
            accentColor={laneAccent(lane.squad)}
          >
            <div className="min-w-0 flex-1">
              <WorkflowBoard
                columns={lane.columns}
                isLegalTarget={isLegalTarget}
                onMove={onMove}
                onReject={onReject}
                onToggleBlocked={onToggleBlocked}
                onOpenCard={onOpenCard}
                hideKeyboardLegend={!isLastVisibleLane}
              />
            </div>
          </BoardSwimlane>
        );
      })}
    </div>
  );
}
