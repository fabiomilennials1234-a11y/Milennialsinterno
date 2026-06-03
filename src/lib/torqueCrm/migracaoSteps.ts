// src/lib/torqueCrm/migracaoSteps.ts
//
// Slice 1 (#91) — Board Torque CRM. Módulo PURO (sem React, sem Supabase).
//
// Achata a state-machine antiga (`crm_configuracoes.current_step`) no checklist
// novo `[{id,label,done}]` (ADR 0006). É o espelho em TS da lógica que a
// migration SQL `20260603xxxxxx_torque_crm_foundation.sql` aplica aos cards
// vivos: marca como `done` o PREFIXO de steps ATÉ (inclusive) o current_step,
// na ordem canônica de CRM_STEPS_BY_PRODUTO. Garante não-perda de progresso.
//
// Por que existe um módulo puro além da migration SQL: a migration roda UMA vez
// sobre os vivos; este helper roda quando um card NOVO entra no board (seed) ou
// quando precisamos derivar checklist a partir de um step legado em runtime.
// A vitest aqui prova a invariante; a pgTAP prova a mesma invariante no SQL.
import {
  CRM_STEPS_BY_PRODUTO,
  CRM_STEP_LABEL,
  type CrmProduto,
} from "@/hooks/useCrmKanban";

// ChecklistItem tem FONTE ÚNICA no módulo genérico `checklist.ts` (Slice #93).
// Reexportado aqui para não quebrar os imports existentes (board, hooks) que o
// puxavam daqui na Slice #91.
export type { ChecklistItem } from "./checklist";

/**
 * Deriva o checklist do board a partir do `current_step` da state-machine antiga.
 *
 * Regra (preserva progresso): para o tier `produto`, gera um item por step na
 * ordem de `CRM_STEPS_BY_PRODUTO`. Marca `done=true` em todo step cujo índice é
 * <= índice do `currentStep`. Se `currentStep` não pertence à state-machine do
 * produto, NENHUM item é marcado (não inventa progresso) — o card recomeça do
 * checklist limpo do tier.
 *
 * @param produto tier do card (torque | automation | copilot)
 * @param currentStep step atual na máquina antiga
 * @returns checklist na ordem do tier, com prefixo done
 */
export function stepToChecklist(
  produto: CrmProduto,
  currentStep: string,
): ChecklistItem[] {
  const steps = CRM_STEPS_BY_PRODUTO[produto];
  const cutoff = steps.indexOf(currentStep); // -1 se step inválido → nada done
  return steps.map((id, i) => ({
    id,
    label: CRM_STEP_LABEL[id] ?? id,
    done: cutoff >= 0 && i <= cutoff,
  }));
}
