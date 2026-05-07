// =============================================================
// State machine — Project Steps (8 etapas fixas)
//
// Follows useCrmKanban pattern: ordered steps, labels, task titles,
// getNextStep, isLastStep. Universal for all tech projects.
// =============================================================

export const PROJECT_STEPS = [
  'briefing',
  'arquitetura',
  'setup_ambiente',
  'desenvolvimento',
  'code_review',
  'testes',
  'deploy',
  'acompanhamento',
] as const;

export type ProjectStep = typeof PROJECT_STEPS[number];

export const PROJECT_STEP_LABEL: Record<ProjectStep, string> = {
  briefing: 'Briefing Tecnico',
  arquitetura: 'Arquitetura / Design',
  setup_ambiente: 'Setup de Ambiente',
  desenvolvimento: 'Desenvolvimento',
  code_review: 'Code Review',
  testes: 'Testes / QA',
  deploy: 'Deploy',
  acompanhamento: 'Acompanhamento',
};

export const PROJECT_TASK_TITLE: Record<ProjectStep, (projectName: string) => string> = {
  briefing: (n) => `Levantar requisitos e documentar briefing — ${n}`,
  arquitetura: (n) => `Definir arquitetura e stack — ${n}`,
  setup_ambiente: (n) => `Configurar repositorio e ambiente — ${n}`,
  desenvolvimento: (n) => `Iniciar desenvolvimento — ${n}`,
  code_review: (n) => `Revisar codigo e aprovar PRs — ${n}`,
  testes: (n) => `Executar QA e validar entrega — ${n}`,
  deploy: (n) => `Realizar deploy e verificar producao — ${n}`,
  acompanhamento: (n) => `Acompanhar pos-entrega (7 dias) — ${n}`,
};

/** Returns next step or null if current is last */
export function getNextProjectStep(current: string): string | null {
  const idx = (PROJECT_STEPS as readonly string[]).indexOf(current);
  if (idx < 0 || idx >= PROJECT_STEPS.length - 1) return null;
  return PROJECT_STEPS[idx + 1];
}

/** True if current is the last step ('acompanhamento') */
export function isLastProjectStep(current: string): boolean {
  return PROJECT_STEPS[PROJECT_STEPS.length - 1] === current;
}

// ================= PROJECT STATUS =================

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed';
export type ProjectType = 'client' | 'internal';
export type ProjectPriority = 'critical' | 'high' | 'medium' | 'low';
export type ProjectMemberRole = 'lead' | 'dev' | 'design' | 'qa';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planejamento',
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluido',
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  client: 'Cliente',
  internal: 'Interno',
};

export const PROJECT_PRIORITY_LABEL: Record<ProjectPriority, string> = {
  critical: 'Critica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
};

export const PROJECT_MEMBER_ROLE_LABEL: Record<ProjectMemberRole, string> = {
  lead: 'Lead',
  dev: 'Dev',
  design: 'Design',
  qa: 'QA',
};

// ================= WEEKDAY HELPERS =================

export const PROJECT_DAYS = [
  { id: 'segunda', label: 'SEG' },
  { id: 'terca', label: 'TER' },
  { id: 'quarta', label: 'QUA' },
  { id: 'quinta', label: 'QUI' },
  { id: 'sexta', label: 'SEX' },
] as const;

const DAY_MAP: Record<number, string> = {
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
};

/** Current weekday (segunda..sexta). Weekend falls back to sexta. */
export function getCurrentProjectWeekday(): string {
  const day = new Date().getDay(); // 0=dom, 1=seg, ..., 6=sab
  return DAY_MAP[day] || 'sexta';
}
