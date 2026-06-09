-- 20260608223000_concessoes_page_catalog.sql
--
-- Slice #149 (Concessão) — ADR 0009 §5. Cataloga a página "Concessões" no sistema
-- de permissões por página (app_pages) e concede o grant role_default ao cargo
-- sucesso_cliente (CS é quem gerencia margem concedida; ADR 0009 §3). Executivos
-- (ceo/cto/gestor_projetos) herdam por wildcard na ROLE_PAGE_MATRIX — não precisam
-- de linha aqui.
--
-- POR QUÊ: a página /concessoes é gated por PageAccessRoute pageSlug="concessoes",
-- cuja fonte de verdade é user_page_grants (via RPC get_my_page_access). Sem a
-- linha em app_pages + o grant role_default, o CS cairia no fallback de matriz
-- (defense-in-depth) — funciona, mas emite warning. Cataloga aqui pra o caminho
-- canônico (grant) ser o ativo. Espelha 20260428171000_align_app_pages_and_role_defaults.
--
-- Idempotente: ON CONFLICT DO NOTHING / DO UPDATE. Re-rodável sem efeito colateral.

BEGIN;

INSERT INTO public.app_pages (slug, label, route, category) VALUES
  ('concessoes', 'Concessões', '/concessoes', 'page')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      route = EXCLUDED.route,
      category = EXCLUDED.category,
      is_active = true;

-- Grant role_default para sucesso_cliente (mesmo padrão/colunas do backfill
-- 20260428171000). granted_by = primeiro CEO/CTO encontrado (ator de sistema).
DO $$
DECLARE
  v_system_user uuid;
  v_inserted int := 0;
BEGIN
  SELECT ur.user_id INTO v_system_user
  FROM public.user_roles ur
  WHERE ur.role IN ('ceo', 'cto')
  ORDER BY CASE WHEN ur.role = 'ceo' THEN 0 ELSE 1 END, ur.created_at NULLS LAST
  LIMIT 1;

  IF v_system_user IS NULL THEN
    RAISE NOTICE '[concessoes_catalog] Nenhum CEO/CTO encontrado. Backfill de grant pulado.';
    RETURN;
  END IF;

  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, reason)
  SELECT ur.user_id, 'concessoes', 'role_default', NULL, v_system_user,
         'backfill role default concessoes (20260608223000)'
  FROM public.user_roles ur
  JOIN public.app_pages ap ON ap.slug = 'concessoes' AND ap.is_active
  WHERE ur.role = 'sucesso_cliente'
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO UPDATE SET
    revoked_at = NULL,
    revoked_by = NULL,
    granted_by = EXCLUDED.granted_by,
    granted_at = now(),
    reason = EXCLUDED.reason;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '[concessoes_catalog] Grants concessoes inseridos/reativados: %', v_inserted;
END;
$$;

COMMIT;
