import type { UserRole } from '@/types/auth';

// Slice 3 (#138) — modo do board CRM por papel. PRD #135, ADR 0006.
//
// Módulo PURO: papel -> 'manage' | 'readonly'. É a camada de UX que decide se o
// board mostra ou esconde as interações (Começar / checklist / agendar / Pronto).
// NÃO é a fronteira de segurança — essa é a RPC (autorização SECURITY DEFINER,
// #136) e a RLS (#136/#137). Defesa em profundidade: mesmo que a UI escape, as
// RPCs de transição barram quem não é gestor do card.

export type CrmBoardMode = 'manage' | 'readonly';

// Allowlist explícita de quem GERENCIA o board. Default (qualquer outro papel,
// incl. gestor_ads) = readonly — menor privilégio de UX. Adicionar um papel
// gestor aqui é uma decisão deliberada e visível.
const MANAGE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'gestor_crm',
  'gestor_projetos',
  'ceo',
  'cto',
]);

export function crmBoardMode(role: UserRole): CrmBoardMode {
  return MANAGE_ROLES.has(role) ? 'manage' : 'readonly';
}
