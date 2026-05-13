import { useMemo } from 'react';
import { useDepartmentTasks, type DepartmentTask } from './useDepartmentTasks';
import { useCrmConfiguracoes, CRM_PRODUTO_LABEL, type CrmProduto } from './useCrmKanban';
import { useStepValidations, type StepValidation } from './useCrmStepValidation';

// =============================================================
// Hook: useCrmDailyTasks
//
// Enriches CRM department tasks with config-level metadata:
// - Step deadline status (ok/warning/critical/overdue)
// - Blocked until (D+N gate)
// - Checklist progress (2/4)
// - Produto label
// - Task group: atrasadas > hoje > pendentes > aguardando
// =============================================================

export type CrmTaskGroup = 'atrasadas' | 'hoje' | 'pendentes' | 'aguardando';

export interface EnrichedCrmTask {
  task: DepartmentTask;
  produto: CrmProduto | null;
  configId: string | null;
  stepKey: string | null;
  /** Checklist progress: { done: number; total: number } or null */
  checklistProgress: { done: number; total: number } | null;
  /** Whether the task is blocked by D+N gate */
  isBlockedDN: boolean;
  /** The blocked_until timestamp, if any */
  blockedUntil: string | null;
  /** Step deadline status */
  deadlineStatus: 'ok' | 'warning' | 'critical' | 'overdue' | 'none';
  /** Group for UI ordering */
  group: CrmTaskGroup;
}

export function useCrmDailyTasks() {
  const { data: tasks = [], isLoading: tasksLoading } = useDepartmentTasks('gestor_crm', 'daily');
  const { data: configs = [], isLoading: configsLoading } = useCrmConfiguracoes();
  const { data: v8Validations = [] } = useStepValidations('v8');
  const { data: automationValidations = [] } = useStepValidations('automation');
  const { data: copilotValidations = [] } = useStepValidations('copilot');

  const enriched = useMemo(() => {
    // Build lookup maps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configsByClientProduto = new Map<string, Record<string, any>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const cfg of configs as Record<string, any>[]) {
      configsByClientProduto.set(`${cfg.client_id}:${cfg.produto}`, cfg);
    }

    const validationsByProdutoStep = new Map<string, StepValidation>();
    for (const v of [...v8Validations, ...automationValidations, ...copilotValidations]) {
      validationsByProdutoStep.set(`${v.produto}:${v.step_key}`, v);
    }

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return tasks
      .filter(t => t.status !== 'done')
      .map((task): EnrichedCrmTask => {
        // Parse CRM config info from description
        const desc = task.description || '';
        const crmConfigMatch = desc.match(/^crm-config:(v8|automation|copilot)$/);
        const produto = crmConfigMatch ? (crmConfigMatch[1] as CrmProduto) : null;

        let configId: string | null = null;
        let stepKey: string | null = null;
        let checklistProgress: { done: number; total: number } | null = null;
        let isBlockedDN = false;
        let blockedUntil: string | null = null;
        let deadlineStatus: 'ok' | 'warning' | 'critical' | 'overdue' | 'none' = 'none';

        if (produto && task.related_client_id) {
          const cfg = configsByClientProduto.get(`${task.related_client_id}:${produto}`);
          if (cfg) {
            configId = cfg.id;
            stepKey = cfg.current_step;

            // Checklist progress
            const validation = validationsByProdutoStep.get(`${produto}:${cfg.current_step}`);
            if (validation?.checklist_items?.length) {
              const state = cfg.checklist_state || {};
              const done = validation.checklist_items.filter((item: string) => state[item]).length;
              checklistProgress = { done, total: validation.checklist_items.length };
            }

            // D+N block
            if (cfg.blocked_until) {
              const blockTime = new Date(cfg.blocked_until).getTime();
              if (blockTime > now) {
                isBlockedDN = true;
                blockedUntil = cfg.blocked_until;
              }
            }

            // Step deadline
            if (validation?.deadline_days && cfg.step_entered_at) {
              const entered = new Date(cfg.step_entered_at).getTime();
              const totalMs = validation.deadline_days * 24 * 60 * 60 * 1000;
              const deadlineMs = entered + totalMs;
              const remainingMs = deadlineMs - now;
              const ratio = remainingMs / totalMs;

              if (remainingMs <= 0) deadlineStatus = 'overdue';
              else if (ratio <= 0.25) deadlineStatus = 'critical';
              else if (ratio <= 0.50) deadlineStatus = 'warning';
              else deadlineStatus = 'ok';
            }
          }
        }

        // Determine group
        let group: CrmTaskGroup;
        if (isBlockedDN) {
          group = 'aguardando';
        } else if (task.due_date && new Date(task.due_date).getTime() < todayStart.getTime()) {
          group = 'atrasadas';
        } else if (deadlineStatus === 'overdue') {
          group = 'atrasadas';
        } else if (task.due_date && new Date(task.due_date).getTime() <= todayEnd.getTime()) {
          group = 'hoje';
        } else {
          group = 'pendentes';
        }

        return {
          task,
          produto,
          configId,
          stepKey,
          checklistProgress,
          isBlockedDN,
          blockedUntil,
          deadlineStatus,
          group,
        };
      })
      // Sort: atrasadas first, then hoje, then pendentes, then aguardando
      .sort((a, b) => {
        const groupOrder: Record<CrmTaskGroup, number> = {
          atrasadas: 0,
          hoje: 1,
          pendentes: 2,
          aguardando: 3,
        };
        return groupOrder[a.group] - groupOrder[b.group];
      });
  }, [tasks, configs, v8Validations, automationValidations, copilotValidations]);

  const grouped = useMemo(() => {
    const groups: Record<CrmTaskGroup, EnrichedCrmTask[]> = {
      atrasadas: [],
      hoje: [],
      pendentes: [],
      aguardando: [],
    };
    for (const item of enriched) {
      groups[item.group].push(item);
    }
    return groups;
  }, [enriched]);

  return {
    enrichedTasks: enriched,
    grouped,
    isLoading: tasksLoading || configsLoading,
  };
}
