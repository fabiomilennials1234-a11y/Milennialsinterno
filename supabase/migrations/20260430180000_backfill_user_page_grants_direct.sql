-- 20260430180000_backfill_user_page_grants_direct.sql
--
-- Backfill one-shot: profiles.additional_pages -> user_page_grants source='direct'.
--
-- Contexto:
--   A migration 20260420170000_user_page_grants.sql introduziu o modelo unificado
--   de grants e fez backfill com source='migration'. Em paralelo, o caminho de
--   edicao de usuarios no client (CreateUserModal/EditUserModal) deveria sincronizar
--   profiles.additional_pages -> user_page_grants(source='direct') via grant_pages
--   RPC, mas esse caminho ficou atras de feature flag (VITE_USE_PAGE_GRANTS) que
--   esta off em runtime.
--
--   Resultado em prod (verificado em 2026-04-30):
--     - 0 rows com source='direct' em user_page_grants
--     - 21 rows source='migration' (do backfill original)
--     - 52 rows source='role_default'
--     - profiles.additional_pages populado para 3 usuarios, totalizando 24 pares
--       (user, slug) sem grant correspondente em user_page_grants
--
--   Como o route guard (has_page_access / get_my_page_access) le SOMENTE
--   user_page_grants, esses usuarios nao acessam as paginas que admin marcou.
--   O grant source='migration' do backfill original ja resolveu o estado naquele
--   momento, mas edicoes feitas depois ficaram orfas.
--
--   Esta migration cria grants source='direct' para cada par (user, slug) ainda
--   nao representado, refletindo a intencao explicita do admin (additional_pages
--   so e populado por acao manual de admin).
--
-- Idempotencia:
--   ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL DO NOTHING
--   garante re-execucao segura. Reaplicar nao gera duplicatas nem reseta
--   revoked_at de grants existentes.
--
-- Filtro defensivo:
--   Pares cujo slug nao existe (ou esta inativo) em app_pages sao ignorados.
--   Em 2026-04-30, 1 par (user 83deb7c9... slug 'atrizes-gravacao') cai nesse
--   filtro porque 'atrizes-gravacao' nao esta em app_pages.
--
-- Granted_by:
--   Usa o CEO mais antigo (mesma estrategia da migration original). Em bancos
--   sem CEO/CTO, emite NOTICE e pula sem falhar.
--
-- Escopo:
--   - Insere apenas. Nao deleta. Nao revoga. Nao toca outras tabelas.
--   - Nao consome can_access_mtech (ja coberto pela migration original com
--     source='migration', e adicionar source='direct' em cima sem evidencia
--     de alteracao manual seria ruido).

BEGIN;

DO $$
DECLARE
  v_system_user uuid;
  v_inserted int := 0;
  v_skipped_invalid int := 0;
BEGIN
  -- System granter: primeiro CEO; fallback CTO; senao pula.
  SELECT ur.user_id INTO v_system_user
  FROM public.user_roles ur
  WHERE ur.role::text = 'ceo'
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  IF v_system_user IS NULL THEN
    SELECT ur.user_id INTO v_system_user
    FROM public.user_roles ur
    WHERE ur.role::text = 'cto'
    ORDER BY ur.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_system_user IS NULL THEN
    RAISE NOTICE '[backfill_direct] Nenhum CEO/CTO em user_roles. Backfill PULADO.';
    RETURN;
  END IF;

  -- Conta pares filtrados (slug invalido ou inativo) so para o NOTICE.
  SELECT count(*) INTO v_skipped_invalid
  FROM (
    SELECT p.user_id, unnest(p.additional_pages) AS slug
    FROM public.profiles p
    WHERE p.additional_pages IS NOT NULL
      AND array_length(p.additional_pages, 1) > 0
  ) pairs
  WHERE NOT EXISTS (
    SELECT 1 FROM public.app_pages ap
    WHERE ap.slug = pairs.slug AND ap.is_active
  );

  -- Insercao principal: cada par (user, slug) vira grant source='direct'.
  -- ON CONFLICT garante idempotencia. Pares com slug invalido sao filtrados
  -- antes do INSERT (evita ruido na FK e respeita o invariante de app_pages).
  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, granted_at, reason)
  SELECT
    p.user_id,
    page_src.slug,
    'direct',
    NULL,
    v_system_user,
    now(),
    'backfill from profiles.additional_pages (20260430180000) - feature flag VITE_USE_PAGE_GRANTS off in runtime'
  FROM public.profiles p
  CROSS JOIN LATERAL unnest(p.additional_pages) AS page_src(slug)
  WHERE p.additional_pages IS NOT NULL
    AND array_length(p.additional_pages, 1) > 0
    AND EXISTS (
      SELECT 1 FROM public.app_pages ap
      WHERE ap.slug = page_src.slug AND ap.is_active
    )
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE '[backfill_direct] Inseridos: % grants source=direct. Pares com slug invalido pulados: %. System granter: %',
    v_inserted, v_skipped_invalid, v_system_user;
END;
$$;

COMMIT;
