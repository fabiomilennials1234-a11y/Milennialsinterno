export * from './types';

// ---------------------------------------------------------------------------
// Issue visual system (#154) — public surface for #156/#157/roadmap.
// Presentational components + their contract types + the canonical config.
// ---------------------------------------------------------------------------

export {
  type IssueType,
  type IssueStatus,
  type Squad,
  type StoryPointValue,
  type IssueExceptionState,
  FIBONACCI,
  ISSUE_TYPE_CONFIG,
  ISSUE_STATUS_CONFIG,
  BOARD_STATUS_ORDER,
  ISSUE_EXCEPTION_CONFIG,
  EPIC_PALETTE,
  epicColorFromKey,
} from './lib/issueSystem';

// ---------------------------------------------------------------------------
// Workflow engine + board (#157).
// ---------------------------------------------------------------------------

export {
  canTransition,
  nextStatuses,
  applyTransition,
  type TransitionCtx,
} from './lib/workflow';
export { toIssueCardData, type IssueCardRelations } from './lib/issueCardAdapter';
export {
  buildBoardColumns,
  isLegalTarget,
  type BoardColumnModel,
} from './lib/boardModel';
export type {
  WorkflowBoardProps,
  WorkflowBoardColumn,
} from './components/workflowBoardContract';
export { WorkflowBoard, WorkflowBoardSkeleton } from './components/WorkflowBoard';
export {
  WorkflowBoardContainer,
  type WorkflowBoardContainerProps,
} from './components/WorkflowBoardContainer';

export {
  SprintBurndownChart,
  type SprintBurndownChartProps,
  type BurndownSeries,
  type BurndownPoint,
} from './components/SprintBurndownChart';

export {
  SprintVelocityChart,
  type SprintVelocityChartProps,
  type VelocitySeries,
  type VelocityPoint,
} from './components/SprintVelocityChart';

export { IssueTypeBadge, type IssueTypeBadgeProps } from './components/IssueTypeBadge';
export { StoryPoints, type StoryPointsProps } from './components/StoryPoints';
export { IssueStateBadges, type IssueStateBadgesProps } from './components/IssueStateBadges';
export {
  IssueCard,
  type IssueCardProps,
  type IssueCardData,
  type IssueCardAssignee,
} from './components/IssueCard';
export {
  BoardColumn,
  type BoardColumnProps,
  BoardSwimlane,
  type BoardSwimlaneProps,
} from './components/BoardColumn';
export {
  IssueViewLayout,
  type IssueViewLayoutProps,
  IssueViewSidebarSection,
  type IssueViewSidebarSectionProps,
  IssueViewSidebarField,
  type IssueViewSidebarFieldProps,
} from './components/IssueViewLayout';

// ---------------------------------------------------------------------------
// Backlog surface (#156) — cross-project single queue + issue creation.
// ---------------------------------------------------------------------------

export {
  type BacklogIssue,
  type BacklogFilters,
  type IssuePriority,
  type IssueSquad,
  type ProjectOption,
  type ClientOption,
  type AssigneeOption,
  EMPTY_BACKLOG_FILTERS,
  activeFilterCount,
  hasAnyFilter,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  SQUAD_CONFIG,
  SQUAD_ORDER,
} from './components/backlogTypes';

export { IssueRow, type IssueRowProps } from './components/IssueRow';
export { BacklogQueue, type BacklogQueueProps } from './components/BacklogQueue';
export { BacklogFilterBar, type BacklogFilterBarProps } from './components/BacklogFilterBar';
export {
  IssueCreateModal,
  type IssueCreateModalProps,
  type IssueCreatePayload,
} from './components/IssueCreateModal';

// ---------------------------------------------------------------------------
// Epic + Sub-task + rollup (#158).
// ---------------------------------------------------------------------------

export {
  computeEpicRollup,
  type EpicRollup,
  type RollupIssue,
} from './lib/rollup';

// ---------------------------------------------------------------------------
// Roadmap (#166) — timeline geometry + Now/Next/Later board.
// ---------------------------------------------------------------------------

export {
  projectEpicBar,
  buildTimeAxis,
  moveEpicDates,
  resizeEpicEdge,
  type DateWindow,
  type EpicDates,
  type EpicBar,
  type AxisTick,
} from './lib/roadmapTimeline';
export { RoadmapTimeline, type RoadmapTimelineProps } from './components/RoadmapTimeline';
export {
  RoadmapNowNextLater,
  type RoadmapNowNextLaterProps,
} from './components/RoadmapNowNextLater';

export { EpicProgressBar, type EpicProgressBarProps } from './components/EpicProgressBar';
export {
  EpicHeader,
  type EpicHeaderProps,
  type EpicHeaderData,
} from './components/EpicHeader';
export {
  EpicIssueRow,
  type EpicIssueRowProps,
  type EpicChildIssue,
} from './components/EpicIssueRow';
export { EpicView, type EpicViewProps } from './components/EpicView';
export {
  EpicDemandaField,
  type EpicDemandaFieldProps,
  type DemandaOption,
  type DemandaScope,
} from './components/EpicDemandaField';
export {
  EpicDemandaLink,
  type EpicDemandaLinkProps,
} from './components/EpicDemandaLink';
export {
  EpicFormModal,
  type EpicFormModalProps,
  type EpicCreatePayload,
} from './components/EpicFormModal';
export {
  SubtaskIndicator,
  type SubtaskIndicatorProps,
} from './components/SubtaskIndicator';
export {
  SubtaskSection,
  type SubtaskSectionProps,
  type SubtaskItem,
  type SubtaskCreatePayload,
} from './components/SubtaskSection';

export {
  EpicViewContainer,
  type EpicViewContainerProps,
} from './components/EpicViewContainer';
export {
  SubtaskSectionContainer,
  type SubtaskSectionContainerProps,
} from './components/SubtaskSectionContainer';
