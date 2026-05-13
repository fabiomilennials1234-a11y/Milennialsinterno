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
 * - full (default): shows full checklist + fields + button + deadline + justification + reset (for modal/detail view)
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
      <div className="h-8 bg-muted/30 rounded animate-pulse" />
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
          <span className="text-[10px] text-amber-600 font-medium">
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
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium px-2 py-1 bg-amber-500/5 rounded-md border border-amber-500/15">
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
          justifiedAt={configState.delay_justified_at}
          onSave={(justification) => saveDelayJustification.mutate({ justification })}
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
          onReset={(reason, newDate) => resetStep.mutate({ reason, newDate })}
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
    </div>
  );
}
