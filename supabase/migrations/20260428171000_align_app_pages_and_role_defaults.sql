-- 20260428171000_align_app_pages_and_role_defaults.sql
--
-- P0.1b: alinhar app_pages com o catálogo real do frontend e popular grants
-- role_default para usuários existentes. Sem isso, o cutover para has_page_access
-- bloquearia páginas padrão do cargo porque a migration original só backfillou
-- additional_pages e mtech.

BEGIN;

-- Catálogo canônico conforme ROLE_PAGE_MATRIX/pageCatalog em 2026-04-28.
INSERT INTO public.app_pages (slug, label, route, category) VALUES
  ('gestor-ads',          'Gestão de Tráfego PRO+',           '/gestor-ads',            'page'),
  ('sucesso-cliente',     'Sucesso do Cliente PRO+',          '/sucesso-cliente',       'page'),
  ('consultor-comercial', 'Treinador Comercial PRO+',         '/consultor-comercial',   'page'),
  ('consultor-mktplace',  'Consultor(a) de MKT Place PRO+',   '/consultor-mktplace',    'page'),
  ('outbound',            'Outbound PRO+',                    '/millennials-outbound',  'page'),
  ('financeiro',          'Financeiro PRO+',                  '/financeiro',            'page'),
  ('gestor-projetos',     'Gestão de Projetos PRO+',          '/gestor-projetos',       'page'),
  ('gestor-crm',          'CRM PRO+',                         '/gestor-crm',            'page'),
  ('design',              'Design PRO+',                      '/design',                'page'),
  ('editor-video',        'Editor de Vídeo PRO+',             '/editor-video',          'page'),
  ('devs',                'Desenvolvedor PRO+',               '/devs',                  'page'),
  ('atrizes-gravacao',    'Gravação PRO+',                    '/atrizes-gravacao',      'page'),
  ('rh',                  'RH PRO+',                          '/rh',                    'page'),
  ('produtora',           'Produtora',                        '/kanban/produtora',      'board'),
  ('cliente-list',        'Lista de Clientes',                '/lista-clientes',        'page'),
  ('cadastro-clientes',   'Cadastro de Clientes',             '/cadastro-clientes',     'page'),
  ('upsells',             'UP Sells',                         '/upsells',               'page'),
  ('comissoes',           'Comissões',                        '/comissoes',             'page'),
  ('mtech',               'Milennials Tech',                  '/milennials-tech',       'feature')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      route = EXCLUDED.route,
      category = EXCLUDED.category,
      is_active = true;

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
    RAISE NOTICE '[role_default_grants] Nenhum CEO/CTO encontrado. Backfill pulado.';
    RETURN;
  END IF;

  WITH role_defaults(role, page_slug) AS (
    VALUES
      ('gestor_ads', 'gestor-ads'),
      ('gestor_ads', 'design'),
      ('gestor_ads', 'editor-video'),
      ('gestor_ads', 'devs'),
      ('gestor_ads', 'produtora'),
      ('gestor_ads', 'atrizes-gravacao'),
      ('gestor_ads', 'gestor-crm'),
      ('gestor_ads', 'consultor-comercial'),

      ('outbound', 'gestor-ads'),
      ('outbound', 'design'),
      ('outbound', 'editor-video'),
      ('outbound', 'devs'),
      ('outbound', 'produtora'),
      ('outbound', 'atrizes-gravacao'),
      ('outbound', 'gestor-crm'),
      ('outbound', 'consultor-comercial'),
      ('outbound', 'outbound'),

      ('sucesso_cliente', 'sucesso-cliente'),
      ('sucesso_cliente', 'gestor-ads'),
      ('sucesso_cliente', 'design'),
      ('sucesso_cliente', 'editor-video'),
      ('sucesso_cliente', 'devs'),
      ('sucesso_cliente', 'produtora'),
      ('sucesso_cliente', 'atrizes-gravacao'),
      ('sucesso_cliente', 'gestor-crm'),
      ('sucesso_cliente', 'consultor-comercial'),
      ('sucesso_cliente', 'rh'),
      ('sucesso_cliente', 'cliente-list'),
      ('sucesso_cliente', 'cadastro-clientes'),
      ('sucesso_cliente', 'upsells'),

      ('design', 'design'),
      ('editor_video', 'editor-video'),
      ('editor_video', 'atrizes-gravacao'),
      ('devs', 'devs'),
      ('devs', 'design'),
      ('devs', 'mtech'),
      ('atrizes_gravacao', 'atrizes-gravacao'),
      ('atrizes_gravacao', 'editor-video'),
      ('produtora', 'produtora'),
      ('gestor_crm', 'gestor-crm'),
      ('consultor_comercial', 'consultor-comercial'),
      ('consultor_mktplace', 'consultor-mktplace'),
      ('financeiro', 'financeiro'),
      ('financeiro', 'cliente-list'),
      ('financeiro', 'comissoes'),
      ('rh', 'rh')
  )
  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, reason)
  SELECT ur.user_id, rd.page_slug, 'role_default', NULL, v_system_user,
         'backfill role defaults (20260428171000)'
  FROM public.user_roles ur
  JOIN role_defaults rd ON rd.role = ur.role::text
  JOIN public.app_pages ap ON ap.slug = rd.page_slug AND ap.is_active
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO UPDATE SET
    revoked_at = NULL,
    revoked_by = NULL,
    granted_by = EXCLUDED.granted_by,
    granted_at = now(),
    reason = EXCLUDED.reason;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '[role_default_grants] Grants inseridos/reativados: %', v_inserted;
END;
$$;

COMMIT;
