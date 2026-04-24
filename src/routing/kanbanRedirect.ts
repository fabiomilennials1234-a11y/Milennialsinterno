import type { UserRole } from "@/types/auth";

/**
 * Resolve destino de redirecionamento pro wrapper `KanbanRoute` em App.tsx.
 *
 * Contexto: o board `comercial` é único global, com scope de cards via RLS por
 * `client.group_id` (decisão Opus B, migration 20260423120000). O role
 * `consultor_comercial` tem hub PRO+ próprio em `/consultor-comercial` — ao
 * tentar abrir `/kanban/comercial` ele cai no board legacy. Redirecionamos
 * pro hub.
 *
 * Retorna o path de destino se precisa redirecionar, ou `null` se deve
 * continuar na rota atual.
 *
 * Mantido como função pura pra permitir teste isolado do reducer de
 * redirect sem montar Router/AuthProvider.
 */
export function resolveKanbanRedirect(
  boardId: string | undefined,
  role: UserRole | null | undefined,
): string | null {
  if (boardId === "comercial" && role === "consultor_comercial") {
    return "/consultor-comercial";
  }
  return null;
}
