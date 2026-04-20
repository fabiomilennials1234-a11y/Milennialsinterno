import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePageAccess } from '@/hooks/usePageAccess';
import { DEFAULT_PAGES_BY_ROLE } from '@/lib/pageCatalog';

// Shadow comparator para a migração user_page_grants.
//
// Roda em paralelo ao fluxo de permissões existente. NÃO altera nada em tela.
// Objetivo: emitir console.warn estruturado quando o conjunto novo
// (get_my_page_access) divergir do conjunto legado (DEFAULT_PAGES_BY_ROLE[role]
// ∪ profiles.additional_pages), para validarmos o backfill antes do cutover.
//
// Admin (ceo/cto/gestor_projetos) é ignorado: no modelo legado a UI pré-seleciona
// ALL_PAGES via DEFAULT_PAGES_BY_ROLE, e no novo modelo o bypass acontece via
// is_admin() dentro do has_page_access — nenhum dos dois lados guarda grants
// explícitos pra admin, então comparar geraria ruído falso.
//
// 'mtech' só entra no conjunto legado quando o usuário tiver can_access_mtech=true
// (equivalente ao que o backfill gerou: grant source='migration' page_slug='mtech').

type DivergencePayload = {
  event: 'permission_divergence';
  user_id: string;
  role: string;
  pages_old_only: string[];
  pages_new_only: string[];
};

function diffSets(a: Set<string>, b: Set<string>): { onlyA: string[]; onlyB: string[] } {
  const onlyA: string[] = [];
  const onlyB: string[] = [];
  for (const v of a) if (!b.has(v)) onlyA.push(v);
  for (const v of b) if (!a.has(v)) onlyB.push(v);
  onlyA.sort();
  onlyB.sort();
  return { onlyA, onlyB };
}

// Lê apenas additional_pages do próprio profile. Não depende de useUsers() —
// esse hook é chamado para qualquer papel autenticado, inclusive os que não
// teriam permissão de listar todos os profiles via RLS.
function useMyAdditionalPages(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-additional-pages', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('additional_pages')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.additional_pages ?? []) as string[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function usePermissionDivergenceLogger(): void {
  const { user, isAdminUser } = useAuth();
  const pageAccess = usePageAccess();
  const additionalPagesQuery = useMyAdditionalPages(user?.id);
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !user.role) return;
    if (isAdminUser) return;
    if (pageAccess.isLoading || !pageAccess.data) return;
    if (additionalPagesQuery.isLoading || !additionalPagesQuery.data) return;

    const legacy = new Set<string>([
      ...(DEFAULT_PAGES_BY_ROLE[user.role] ?? []),
      ...additionalPagesQuery.data,
    ]);
    if (user.can_access_mtech) legacy.add('mtech');

    const next = new Set<string>(pageAccess.data);

    const { onlyA: pagesOldOnly, onlyB: pagesNewOnly } = diffSets(legacy, next);
    if (pagesOldOnly.length === 0 && pagesNewOnly.length === 0) {
      lastSignatureRef.current = null;
      return;
    }

    // Deduplica para não flood no hot reload / refetches.
    const signature = `${user.id}|${pagesOldOnly.join(',')}|${pagesNewOnly.join(',')}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const payload: DivergencePayload = {
      event: 'permission_divergence',
      user_id: user.id,
      role: user.role,
      pages_old_only: pagesOldOnly,
      pages_new_only: pagesNewOnly,
    };

    console.warn('[permission_divergence]', payload);
  }, [
    user?.id,
    user?.role,
    user?.can_access_mtech,
    isAdminUser,
    pageAccess.isLoading,
    pageAccess.data,
    additionalPagesQuery.isLoading,
    additionalPagesQuery.data,
  ]);
}
