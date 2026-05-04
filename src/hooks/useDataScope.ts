import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';

export interface DataScopeResult {
  /** True quando o user vê dados completos da página (admin/CEO/page_grant). */
  seesAll: boolean;
  /**
   * True quando o cálculo de `seesAll` é confiável.
   * Admin/CEO: true síncrono.
   * Demais: true após `usePageAccess` resolver (sucesso ou erro).
   * Use como gate em `enabled` da useQuery pra evitar query "fantasma"
   * com seesAll=false antes de pageAccess chegar.
   */
  isReady: boolean;
  /**
   * Identidade estável pra entrar em `queryKey`. Muda quando `seesAll` muda,
   * forçando React Query a refetch quando o user passa de "pending" pra "all".
   */
  scopeKey: 'all' | 'mine' | 'pending';
}

/**
 * Resolve scope de leitura por página.
 *
 * Substitui o padrão duplicado:
 *   const { isAdminUser, isCEO } = useAuth();
 *   const { data: pageAccess = [] } = usePageAccess();
 *   const seesAll = isAdminUser || isCEO || pageAccess.includes(slug);
 *
 * Esse padrão tinha race: queryKey não incluía pageAccess, então refetch
 * não acontecia quando a RPC resolvia. Aqui `scopeKey` resolve isso.
 *
 * Slug undefined → seesAll=false fail-closed (exceto admin/CEO bypass).
 * Erro na RPC pageAccess → isReady=true com seesAll=false (fail-closed).
 */
export function useDataScope(pageSlug: string | undefined): DataScopeResult {
  const { isAdminUser, isCEO } = useAuth();
  const { data: pageAccess, isSuccess, isError } = usePageAccess();

  const adminBypass = isAdminUser || isCEO;
  const isReady = adminBypass || isSuccess || isError;
  const seesAll =
    adminBypass || (!!pageSlug && (pageAccess?.includes(pageSlug) ?? false));
  const scopeKey: DataScopeResult['scopeKey'] = !isReady
    ? 'pending'
    : seesAll
      ? 'all'
      : 'mine';

  return { seesAll, isReady, scopeKey };
}
