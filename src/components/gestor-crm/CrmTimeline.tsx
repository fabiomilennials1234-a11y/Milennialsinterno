import { useMemo } from 'react';
import { useCrmValidationLog } from '@/hooks/useCrmValidationLog';
import {
  CRM_STEP_LABEL,
  CRM_STEPS_BY_PRODUTO,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import { CheckCircle2, Circle, ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  configId: string;
  produto: CrmProduto;
  currentStep: string;
  isFinalizado: boolean;
}

interface TimelineStep {
  stepKey: string;
  label: string;
  status: 'completed' | 'current' | 'future';
  enteredAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  performerName: string | null;
}

function formatDuration(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Full timeline showing all steps for a product config.
 * Completed steps show timestamp + duration + who did it.
 * Current step highlighted. Future steps grayed.
 */
export default function CrmTimeline({ configId, produto, currentStep, isFinalizado }: Props) {
  const { data: logs = [], isLoading } = useCrmValidationLog(configId);
  const steps = CRM_STEPS_BY_PRODUTO[produto];

  const timeline = useMemo((): TimelineStep[] => {
    // Build advance event map: step_key -> { timestamp, performer, next_step }
    const advanceEvents = logs
      .filter(l => l.action === 'advance')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Map: step_key -> when it was completed (advance action logged FROM this step)
    const completedMap = new Map<string, { at: string; performer: string | null }>();
    for (const ev of advanceEvents) {
      completedMap.set(ev.step_key, {
        at: ev.created_at,
        performer: ev.performer_name || null,
      });
    }

    // Finalization event
    const finalEvent = logs.find(l => l.action === 'finalized');
    if (finalEvent) {
      completedMap.set(finalEvent.step_key, {
        at: finalEvent.created_at,
        performer: finalEvent.performer_name || null,
      });
    }

    // Reconstruct entry timestamps from advance chain
    // First step entered_at = config.created_at (not available here, approximate from first log)
    const entryMap = new Map<string, string>();

    // The first step's entry is the earliest log entry
    if (logs.length > 0) {
      const earliest = [...logs].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0];
      entryMap.set(steps[0], earliest.created_at);
    }

    // Each advance to next_step = entry time for that step
    for (const ev of advanceEvents) {
      const nextStep = ev.details?.next_step as string;
      if (nextStep) {
        entryMap.set(nextStep, ev.created_at);
      }
    }

    const currentIdx = steps.indexOf(currentStep);

    return steps.map((stepKey, idx): TimelineStep => {
      let status: 'completed' | 'current' | 'future';
      if (isFinalizado) {
        status = 'completed';
      } else if (idx < currentIdx) {
        status = 'completed';
      } else if (idx === currentIdx) {
        status = 'current';
      } else {
        status = 'future';
      }

      // Override: if we have a completion event, it's completed regardless
      if (completedMap.has(stepKey)) {
        status = 'completed';
      }

      const enteredAt = entryMap.get(stepKey) || null;
      const completed = completedMap.get(stepKey);
      const completedAt = completed?.at || null;

      let durationMs: number | null = null;
      if (enteredAt && completedAt) {
        durationMs = new Date(completedAt).getTime() - new Date(enteredAt).getTime();
        if (durationMs < 0) durationMs = null;
      }

      return {
        stepKey,
        label: CRM_STEP_LABEL[stepKey] || stepKey,
        status,
        enteredAt,
        completedAt,
        durationMs,
        performerName: completed?.performer || null,
      };
    });
  }, [logs, steps, currentStep, isFinalizado]);

  if (isLoading) {
    return <div className="h-20 bg-muted/30 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
        <ArrowRight size={12} />
        Linha do tempo
      </p>

      <div className="relative space-y-0">
        {timeline.map((step, idx) => (
          <div key={step.stepKey} className="flex items-stretch gap-3">
            {/* Vertical line + icon */}
            <div className="flex flex-col items-center w-5 shrink-0">
              {step.status === 'completed' ? (
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 z-10" />
              ) : step.status === 'current' ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/20 shrink-0 z-10" />
              ) : (
                <Circle size={14} className="text-muted-foreground/30 shrink-0 z-10" />
              )}
              {idx < timeline.length - 1 && (
                <div className={cn(
                  'w-px flex-1 min-h-[20px]',
                  step.status === 'completed' ? 'bg-emerald-500/40' : 'bg-border/50'
                )} />
              )}
            </div>

            {/* Content */}
            <div className={cn(
              'pb-3 flex-1 min-w-0',
              step.status === 'future' && 'opacity-40'
            )}>
              <p className={cn(
                'text-xs font-medium leading-snug',
                step.status === 'current' && 'text-primary font-semibold',
                step.status === 'completed' && 'text-foreground',
                step.status === 'future' && 'text-muted-foreground'
              )}>
                {step.label}
              </p>

              {step.status === 'completed' && (step.completedAt || step.durationMs !== null) && (
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  {step.completedAt && (
                    <span>{formatDate(step.completedAt)}</span>
                  )}
                  {step.durationMs !== null && (
                    <span className="flex items-center gap-0.5">
                      <Clock size={9} />
                      {formatDuration(step.durationMs)}
                    </span>
                  )}
                  {step.performerName && (
                    <span className="truncate max-w-[120px]">{step.performerName}</span>
                  )}
                </div>
              )}

              {step.status === 'current' && (
                <span className="inline-block mt-0.5 text-[10px] font-medium text-primary/70">
                  Em andamento
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
