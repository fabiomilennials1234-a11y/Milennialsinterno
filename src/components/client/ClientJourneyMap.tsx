import { type ReactNode, useMemo } from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JourneyStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming' | 'skipped';
}

export interface JourneyPhase {
  label: string;
  stepCount: number;
  completedCount: number;
}

export interface JourneyPipeline {
  id: string;
  label: string;
  icon: ReactNode;
  color: string; // Tailwind color token root, e.g. 'amber', 'rose', 'violet', 'sky'
  steps: JourneyStep[];
  currentStepIndex: number;
  isCompleted: boolean;
  isActive: boolean;
  phases?: JourneyPhase[];
  currentPhaseIndex?: number;
}

export interface ClientJourneyMapProps {
  pipelines: JourneyPipeline[];
  isLoading?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Color map — maps semantic token to concrete Tailwind classes.
// Keeps the component free of arbitrary hex values.
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<
  string,
  {
    dot: string;
    dotCompleted: string;
    line: string;
    lineDone: string;
    glow: string;
    glowRing: string;
    badge: string;
    badgeText: string;
    phaseBar: string;
    phaseBarTrack: string;
    icon: string;
  }
> = {
  amber: {
    dot: 'bg-amber-500',
    dotCompleted: 'bg-amber-500',
    line: 'bg-amber-500/20',
    lineDone: 'bg-amber-500/60',
    glow: 'shadow-[0_0_6px_1px_theme(colors.amber.500/0.45)]',
    glowRing: 'ring-amber-500/50',
    badge: 'bg-amber-500/10',
    badgeText: 'text-amber-500',
    phaseBar: 'bg-amber-500',
    phaseBarTrack: 'bg-amber-500/15',
    icon: 'text-amber-500',
  },
  rose: {
    dot: 'bg-rose-500',
    dotCompleted: 'bg-rose-500',
    line: 'bg-rose-500/20',
    lineDone: 'bg-rose-500/60',
    glow: 'shadow-[0_0_6px_1px_theme(colors.rose.500/0.45)]',
    glowRing: 'ring-rose-500/50',
    badge: 'bg-rose-500/10',
    badgeText: 'text-rose-500',
    phaseBar: 'bg-rose-500',
    phaseBarTrack: 'bg-rose-500/15',
    icon: 'text-rose-500',
  },
  violet: {
    dot: 'bg-violet-500',
    dotCompleted: 'bg-violet-500',
    line: 'bg-violet-500/20',
    lineDone: 'bg-violet-500/60',
    glow: 'shadow-[0_0_6px_1px_theme(colors.violet.500/0.45)]',
    glowRing: 'ring-violet-500/50',
    badge: 'bg-violet-500/10',
    badgeText: 'text-violet-500',
    phaseBar: 'bg-violet-500',
    phaseBarTrack: 'bg-violet-500/15',
    icon: 'text-violet-500',
  },
  sky: {
    dot: 'bg-sky-500',
    dotCompleted: 'bg-sky-500',
    line: 'bg-sky-500/20',
    lineDone: 'bg-sky-500/60',
    glow: 'shadow-[0_0_6px_1px_theme(colors.sky.500/0.45)]',
    glowRing: 'ring-sky-500/50',
    badge: 'bg-sky-500/10',
    badgeText: 'text-sky-500',
    phaseBar: 'bg-sky-500',
    phaseBarTrack: 'bg-sky-500/15',
    icon: 'text-sky-500',
  },
};

const DEFAULT_COLORS = COLOR_MAP.sky;

function getColors(color: string) {
  return COLOR_MAP[color] ?? DEFAULT_COLORS;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single dot in the stepper track */
function StepDot({
  step,
  colors,
}: {
  step: JourneyStep;
  colors: ReturnType<typeof getColors>;
}) {
  const isCurrent = step.status === 'current';
  const isCompleted = step.status === 'completed';
  const isSkipped = step.status === 'skipped';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            isCurrent && [
              'w-2.5 h-2.5 ring-[3px]',
              colors.dot,
              colors.glowRing,
              colors.glow,
              'motion-safe:animate-journey-dot-pulse',
            ],
            isCompleted && ['w-2 h-2', colors.dotCompleted],
            isSkipped && 'w-1.5 h-1.5 bg-muted-foreground/30',
            !isCurrent && !isCompleted && !isSkipped && [
              'w-1.5 h-1.5 border border-muted-foreground/30 bg-transparent',
            ],
          )}
          aria-label={`${step.label} — ${
            isCompleted
              ? 'concluido'
              : isCurrent
                ? 'etapa atual'
                : isSkipped
                  ? 'pulado'
                  : 'pendente'
          }`}
          tabIndex={-1}
        >
          {isCompleted && (
            <Check
              className="w-1.5 h-1.5 text-white"
              strokeWidth={4}
              aria-hidden="true"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-xs font-medium max-w-[200px]"
      >
        <span>{step.label}</span>
        {isCurrent && (
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            Etapa atual
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Connecting line segment between dots */
function StepLine({
  done,
  colors,
}: {
  done: boolean;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div
      className={cn(
        'flex-1 h-px min-w-[6px] transition-colors duration-200',
        done ? colors.lineDone : colors.line,
      )}
      aria-hidden="true"
    />
  );
}

/** Dots-based stepper for pipelines with manageable step counts */
function DotsStepper({
  steps,
  colors,
}: {
  steps: JourneyStep[];
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0" role="list">
      {steps.map((step, i) => (
        <div key={step.id} className="contents" role="listitem">
          <StepDot step={step} colors={colors} />
          {i < steps.length - 1 && (
            <StepLine
              done={
                step.status === 'completed' ||
                step.status === 'current'
              }
              colors={colors}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Phase-based progress for CRM pipelines with many steps */
function PhaseStepper({
  phases,
  currentPhaseIndex,
  colors,
}: {
  phases: JourneyPhase[];
  currentPhaseIndex: number;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0" role="list">
      {phases.map((phase, i) => {
        const isCurrentPhase = i === currentPhaseIndex;
        const isDone = phase.completedCount >= phase.stepCount;
        const pct =
          phase.stepCount > 0
            ? Math.round((phase.completedCount / phase.stepCount) * 100)
            : 0;

        return (
          <Tooltip key={phase.label}>
            <TooltipTrigger asChild>
              <div
                role="listitem"
                className={cn(
                  'flex flex-col gap-1 flex-1 min-w-0 cursor-default',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                )}
                tabIndex={-1}
                aria-label={`${phase.label}: ${phase.completedCount} de ${phase.stepCount} concluidos`}
              >
                {/* Phase label */}
                <span
                  className={cn(
                    'text-[10px] leading-none truncate',
                    isCurrentPhase
                      ? cn('font-semibold', colors.badgeText)
                      : isDone
                        ? 'font-medium text-muted-foreground'
                        : 'font-normal text-muted-foreground/60',
                  )}
                >
                  {phase.label}
                </span>
                {/* Mini progress bar */}
                <div
                  className={cn(
                    'h-1 w-full rounded-full overflow-hidden',
                    colors.phaseBarTrack,
                  )}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      colors.phaseBar,
                      isCurrentPhase && 'motion-safe:animate-journey-bar-glow',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <span className="font-medium">{phase.label}</span>
              <span className="block text-[10px] text-muted-foreground">
                {phase.completedCount}/{phase.stepCount} etapas
              </span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Status badge (right side) */
function PipelineStatus({
  pipeline,
  colors,
  stepsSummary,
}: {
  pipeline: JourneyPipeline;
  colors: ReturnType<typeof getColors>;
  stepsSummary: string;
}) {
  if (pipeline.isCompleted) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 shrink-0"
        aria-label="Pipeline concluida"
      >
        <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
        Concluido
      </span>
    );
  }

  return (
    <span
      className={cn(
        'text-[10px] font-medium shrink-0 tabular-nums',
        colors.badgeText,
        'opacity-80',
      )}
    >
      {stepsSummary}
    </span>
  );
}

/** Single pipeline row */
function PipelineRow({ pipeline }: { pipeline: JourneyPipeline }) {
  const colors = getColors(pipeline.color);
  const hasPhases =
    pipeline.phases && pipeline.phases.length > 0;

  const stepsSummary = useMemo(() => {
    if (hasPhases && pipeline.phases) {
      const totalSteps = pipeline.phases.reduce(
        (sum, p) => sum + p.stepCount,
        0,
      );
      const completedSteps = pipeline.phases.reduce(
        (sum, p) => sum + p.completedCount,
        0,
      );
      return `${completedSteps}/${totalSteps}`;
    }
    const completed = pipeline.steps.filter(
      (s) => s.status === 'completed',
    ).length;
    return `${completed}/${pipeline.steps.length}`;
  }, [pipeline, hasPhases]);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-150',
        'hover:bg-muted/30',
        pipeline.isCompleted && 'opacity-70',
      )}
      role="region"
      aria-label={`Pipeline ${pipeline.label}`}
    >
      {/* Icon + Label */}
      <div className="flex items-center gap-2 shrink-0 w-[120px] min-w-[100px]">
        <span
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded-md shrink-0 [&_svg]:w-3 [&_svg]:h-3',
            colors.badge,
            colors.icon,
          )}
          aria-hidden="true"
        >
          {pipeline.icon}
        </span>
        <span className="text-xs font-medium text-foreground truncate">
          {pipeline.label}
        </span>
      </div>

      {/* Stepper track */}
      <div className="flex-1 min-w-0">
        {hasPhases && pipeline.phases ? (
          <PhaseStepper
            phases={pipeline.phases}
            currentPhaseIndex={pipeline.currentPhaseIndex ?? 0}
            colors={colors}
          />
        ) : (
          <DotsStepper steps={pipeline.steps} colors={colors} />
        )}
      </div>

      {/* Status */}
      <PipelineStatus
        pipeline={pipeline}
        colors={colors}
        stepsSummary={stepsSummary}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors exact layout
// ---------------------------------------------------------------------------

function JourneyMapSkeleton() {
  return (
    <div className="space-y-1 px-1" aria-busy="true" aria-label="Carregando jornada do cliente">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-3">
          <div className="flex items-center gap-2 w-[120px]">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <div className="flex-1 flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="contents">
                <Skeleton className="w-2 h-2 rounded-full" />
                {j < 5 && <Skeleton className="flex-1 h-px" />}
              </div>
            ))}
          </div>
          <Skeleton className="h-3 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ClientJourneyMap({
  pipelines,
  isLoading = false,
  className,
}: ClientJourneyMapProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card/50 p-3', className)}>
        <div className="flex items-center gap-2 mb-2 px-3">
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>
        <JourneyMapSkeleton />
      </div>
    );
  }

  // No pipelines = render nothing. The parent hides the section.
  if (!pipelines || pipelines.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card/50 p-3',
        className,
      )}
    >
      {/* Section heading — typographic hierarchy, no icon decoration */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">
        Jornada
      </h3>

      {/* Pipeline rows */}
      <div className="space-y-0.5">
        {pipelines.map((pipeline) => (
          <PipelineRow key={pipeline.id} pipeline={pipeline} />
        ))}
      </div>

    </div>
  );
}
