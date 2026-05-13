import { useCrmStepValidation } from '@/hooks/useCrmStepValidation';
import type { CrmProduto } from '@/hooks/useCrmKanban';
import { CRM_STEP_LABEL } from '@/hooks/useCrmKanban';
import CrmChecklist from './CrmChecklist';
import CrmRequiredFields from './CrmRequiredFields';
import CrmAdvanceButton from './CrmAdvanceButton';
import { Clock, Timer } from 'lucide-react';

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
 * - compact: shows just the button + blocker count (for kanban cards)
 * - full (default): shows full checklist + fields + button (for modal/detail view)
 */
export default function CrmValidationGate({ configId, produto, compact }: Props) {
  const {
    currentValidation,
    configState,
    configLoading,
    blockers,
    canAdvance,
    toggleChecklist,
    saveField,
    advanceStep,
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

  // Compact mode: just show button with blocker badge
  if (compact) {
    return (
      <div className="flex items-center gap-2">
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

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div className="flex items-center gap-2 text-sm">
        <Clock size={14} className="text-muted-foreground" />
        <span className="text-muted-foreground">Etapa atual:</span>
        <span className="font-medium text-foreground">{stepLabel}</span>
      </div>

      {/* Blocked until timer */}
      {hasBlockedUntil && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Timer size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Etapa bloqueada ate{' '}
            <strong>
              {new Date(configState.blocked_until!).toLocaleDateString('pt-BR')}{' '}
              {new Date(configState.blocked_until!).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </p>
        </div>
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
