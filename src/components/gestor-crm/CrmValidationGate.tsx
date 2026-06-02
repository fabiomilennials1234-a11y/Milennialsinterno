import { useCrmStepValidation } from '@/hooks/useCrmStepValidation';
import type { CrmProduto } from '@/hooks/useCrmKanban';
import { CRM_STEP_LABEL } from '@/hooks/useCrmKanban';
import CrmChecklist from './CrmChecklist';
import CrmRequiredFields from './CrmRequiredFields';
import CrmAdvanceButton from './CrmAdvanceButton';
import CrmStepDeadlineBadge from './CrmStepDeadlineBadge';
import CrmDelayJustificationField from './CrmDelayJustificationField';
import CrmResetLoopSection from './CrmResetLoopSection';
import CrmBlockedCountdown from './CrmBlockedCountdown';
import CrmValidationHistory from './CrmValidationHistory';
import CrmTimeline from './CrmTimeline';
import { Clock } from 'lucide-react';

interface Props {
  configId: string;
  produto: CrmProduto;
  /** Compact mode for card inline, full mode for modal */
  compact?: boolean;
}

/**
 * Validation gate for a CRM config step.
 *
 * Renders checklist + required fields + advance button.
 * Controls whether advance is allowed based on validation state.
 *
 * Two modes:
 * - compact: shows just the button + blocker count + step deadline badge (for kanban cards)
 * - full (default): shows full checklist + fields + button + deadline + justification + reset + history + timeline (for modal/detail view)
 */
export default function CrmValidationGate({ configId, produto, compact }: Props) {
  const {
    currentValidation,
    configState,
    configLoading,
    blockers,
    canAdvance,
    stepDeadlineStatus,
    isOverdue,
    toggleChecklist,
    saveField,
    advanceStep,
    saveDelayJustification,
    resetStep,
  } = useCrmStepValidation(configId, produto);

  if (configLoading || !configState) {
    return (
      <div className="h-8 skeleton-static rounded" />
    );
  }

  if (configState.is_finalizado) {
    return (
      <CrmAdvanceButton
        canAdvance={false}
        blockers={[]}
        onAdvance={() => {}}
        isFinalized
      />
    );
  }

  const stepLabel = CRM_STEP_LABEL[configState.current_step] || configState.current_step;

  // Compact mode: just show button with blocker badge + step deadline
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <CrmStepDeadlineBadge
          status={stepDeadlineStatus.status}
          remainingMs={stepDeadlineStatus.remainingMs}
          totalMs={stepDeadlineStatus.totalMs}
        />
        {blockers.length > 0 && (
          <span className="text-[10px] text-warning font-medium">
            {blockers.length} pendencia{blockers.length > 1 ? 's' : ''}
          </span>
        )}
        <CrmAdvanceButton
          canAdvance={canAdvance}
          blockers={blockers}
          onAdvance={() => advanceStep.mutate()}
          isLoading={advanceStep.isPending}
        />
      </div>
    );
  }

  // Full mode
  const hasChecklist = currentValidation?.checklist_items && currentValidation.checklist_items.length > 0;
  const hasFields = currentValidation?.required_fields && currentValidation.required_fields.length > 0;
  const hasBlockedUntil = configState.blocked_until && new Date(configState.blocked_until) > new Date();
  const hasResetLoop = currentValidation?.has_reset_loop === true;

  return (
    <div className="space-y-4">
      {/* Step header with deadline badge */}
      <div className="flex items-center gap-2 text-sm">
        <Clock size={14} className="text-muted-foreground" />
        <span className="text-muted-foreground">Etapa atual:</span>
        <span className="font-medium text-foreground">{stepLabel}</span>
        <CrmStepDeadlineBadge
          status={stepDeadlineStatus.status}
          remainingMs={stepDeadlineStatus.remainingMs}
          totalMs={stepDeadlineStatus.totalMs}
          className="ml-auto"
        />
      </div>

      {/* Reset count indicator */}
      {configState.reset_count > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-warning font-medium px-2 py-1 bg-warning/5 rounded-md border border-warning/15">
          Reset #{configState.reset_count}
        </div>
      )}

      {/* Blocked countdown (D+N) */}
      {hasBlockedUntil && (
        <CrmBlockedCountdown blockedUntil={configState.blocked_until!} />
      )}

      {/* Delay justification (when overdue) */}
      {isOverdue && (
        <CrmDelayJustificationField
          currentJustification={configState.delay_justification}
          currentCategory={configState.delay_justification_category}
          justifiedAt={configState.delay_justified_at}
          onSave={(justification, category) => saveDelayJustification.mutate({ justification, category })}
          isSaving={saveDelayJustification.isPending}
        />
      )}

      {/* Checklist */}
      {hasChecklist && (
        <CrmChecklist
          items={currentValidation!.checklist_items!}
          state={configState.checklist_state}
          onToggle={(item, checked) => toggleChecklist.mutate({ item, checked })}
          disabled={!!hasBlockedUntil}
        />
      )}

      {/* Required fields */}
      {hasFields && (
        <CrmRequiredFields
          fields={currentValidation!.required_fields!}
          values={configState.field_values}
          onSave={(key, value) => saveField.mutate({ key, value })}
          disabled={!!hasBlockedUntil}
        />
      )}

      {/* Reset loop section */}
      {hasResetLoop && (
        <CrmResetLoopSection
          resetCount={configState.reset_count}
          checklistItems={currentValidation?.checklist_items || []}
          onReset={(reason, newDate, failedItems) => resetStep.mutate({ reason, newDate, failedItems })}
          isResetting={resetStep.isPending}
        />
      )}

      {/* Advance button */}
      <div className="pt-1">
        <CrmAdvanceButton
          canAdvance={canAdvance}
          blockers={blockers}
          onAdvance={() => advanceStep.mutate()}
          isLoading={advanceStep.isPending}
        />
      </div>

      {/* Timeline (7.6) */}
      <div className="pt-2 border-t border-border/30">
        <CrmTimeline
          configId={configId}
          produto={produto}
          currentStep={configState.current_step}
          isFinalizado={configState.is_finalizado}
        />
      </div>

      {/* History (7.4) */}
      <div className="pt-2 border-t border-border/30">
        <CrmValidationHistory configId={configId} />
      </div>
    </div>
  );
}
