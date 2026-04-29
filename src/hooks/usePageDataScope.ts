import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { ROLE_PAGE_MATRIX } from '@/types/auth';

export type DataScope = 'mine' | 'all';

interface UsePageDataScopeResult {
  scope: DataScope;
  setScope: (s: DataScope) => void;
  /** True quando user pode ver "todas" — tem grant E não é owner natural. */
  canShowAll: boolean;
  /** True quando role default já cobre o slug (owner natural). */
  isOwner: boolean;
}

/**
 * Decide se o user pode alternar entre "minhas" / "todas" para uma página.
 *
 * - Admin (CEO/CTO/gestor_projetos) sempre vê tudo no backend, mas o toggle
 *   ainda existe para inspecionar UX de "minhas" caso queira.
 * - Non-admin com role default que cobre o slug: NÃO mostra toggle (já é dono).
 * - Non-admin com page_grant explícito sem ser dono: toggle aparece.
 *
 * Persistência: `localStorage` por (userId, pageSlug). Reseta no logout.
 */
export function usePageDataScope(pageSlug: string): UsePageDataScopeResult {
  const { user, isAdminUser, isCEO } = useAuth();
  const pageAccess = usePageAccess();

  const isOwnerByRole = useMemo(() => {
    if (!user?.role) return false;
    const entries = ROLE_PAGE_MATRIX[user.role] ?? [];
    return entries.some((e) => e.pageSlug === pageSlug);
  }, [user?.role, pageSlug]);

  const isAdmin = isAdminUser || isCEO;
  const hasGrant = pageAccess.data?.includes(pageSlug) ?? false;
  const canShowAll = (isAdmin || hasGrant) && !isOwnerByRole;

  const storageKey = useMemo(
    () => `page-data-scope:${user?.id ?? 'anon'}:${pageSlug}`,
    [user?.id, pageSlug],
  );

  const [scope, setScopeState] = useState<DataScope>(() => {
    if (typeof window === 'undefined') return 'mine';
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'all' ? 'all' : 'mine';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(storageKey);
    setScopeState(saved === 'all' ? 'all' : 'mine');
  }, [storageKey]);

  const setScope = useCallback(
    (s: DataScope) => {
      setScopeState(s);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, s);
      }
    },
    [storageKey],
  );

  return {
    scope: canShowAll ? scope : 'mine',
    setScope,
    canShowAll,
    isOwner: isOwnerByRole,
  };
}
