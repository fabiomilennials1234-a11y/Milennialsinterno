-- 20260429190000_tv_dashboard_stats_rpc.sql
--
-- P1.2: agrega TV Dashboard em RPC unica para evitar 8 queries com select(*)
-- baixando ate 5000 kanban_cards + 2000 ads_tasks + 2000 comercial_tasks +
-- 2000 clients + 2000 client_onboarding + 1000 columns + 500 profiles +
-- 500 user_roles no browser.
--
-- Retorna jsonb com array `all` de ProfessionalStats. Frontend faz split por
-- role.
--
-- Acesso: authenticated (TV dashboard interno, qualquer membro do time).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_tv_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_start timestamptz := v_today::timestamptz;
  v_now timestamptz := now();
  v_payload jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  WITH professionals AS (
    SELECT
      p.user_id,
      COALESCE(p.name, 'Sem nome') AS name,
      p.avatar AS avatar,
      ur.role::text AS role
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role::text IN (
      'design','editor_video','consultor_comercial','devs','gestor_ads',
      'outbound','gestor_projetos','sucesso_cliente','gestor_crm',
      'financeiro','rh','produtora','atrizes_gravacao'
    )
  ),
  done_columns AS (
    SELECT id
    FROM public.kanban_columns
    WHERE lower(title) LIKE '%conclu%'
       OR lower(title) LIKE '%done%'
       OR lower(title) LIKE '%entregue%'
       OR lower(title) LIKE '%finalizado%'
  ),
  -- Kanban-based stats por user.
  kanban_stats AS (
    SELECT
      kc.assigned_to AS user_id,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (SELECT 1 FROM done_columns dc WHERE dc.id = kc.column_id)
      )::int AS pending,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM done_columns dc WHERE dc.id = kc.column_id)
          AND kc.updated_at >= v_today_start
      )::int AS done_today,
      COUNT(*) FILTER (
        WHERE kc.due_date IS NOT NULL
          AND kc.due_date < v_today
          AND NOT EXISTS (SELECT 1 FROM done_columns dc WHERE dc.id = kc.column_id)
      )::int AS delayed
    FROM public.kanban_cards kc
    WHERE COALESCE(kc.archived, false) = false
      AND kc.assigned_to IS NOT NULL
    GROUP BY kc.assigned_to
  ),
  comercial_stats AS (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE status <> 'done')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'done' AND updated_at >= v_today_start)::int AS done_today,
      COUNT(*) FILTER (
        WHERE due_date IS NOT NULL
          AND due_date::timestamptz < v_now
          AND status <> 'done'
      )::int AS delayed
    FROM public.comercial_tasks
    WHERE COALESCE(archived, false) = false
      AND user_id IS NOT NULL
    GROUP BY user_id
  ),
  ads_stats AS (
    SELECT
      ads_manager_id AS user_id,
      COUNT(*) FILTER (WHERE status <> 'done')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'done' AND updated_at >= v_today_start)::int AS done_today,
      COUNT(*) FILTER (
        WHERE due_date IS NOT NULL
          AND due_date < v_today
          AND status <> 'done'
      )::int AS delayed
    FROM public.ads_tasks
    WHERE COALESCE(archived, false) = false
      AND ads_manager_id IS NOT NULL
    GROUP BY ads_manager_id
  ),
  onboarding_active AS (
    SELECT DISTINCT client_id
    FROM public.client_onboarding
    WHERE completed_at IS NULL
  ),
  ads_client_counts AS (
    SELECT
      assigned_ads_manager AS user_id,
      COUNT(*) FILTER (WHERE client_label = 'otimo')::int AS otimo,
      COUNT(*) FILTER (WHERE client_label = 'bom')::int   AS bom,
      COUNT(*) FILTER (WHERE client_label = 'medio')::int AS medio,
      COUNT(*) FILTER (WHERE client_label = 'ruim')::int  AS ruim,
      COUNT(*) FILTER (WHERE id IN (SELECT client_id FROM onboarding_active))::int AS onboarding,
      COUNT(*)::int AS total
    FROM public.clients
    WHERE COALESCE(archived, false) = false
      AND assigned_ads_manager IS NOT NULL
    GROUP BY assigned_ads_manager
  )
  SELECT jsonb_build_object(
    'all', COALESCE(jsonb_agg(jsonb_build_object(
      'id',              p.user_id,
      'name',            p.name,
      'avatar',          p.avatar,
      'role',            p.role,
      'pendingTasks',    CASE
        WHEN p.role = 'consultor_comercial' THEN COALESCE(cs.pending,    0)
        WHEN p.role = 'gestor_ads'           THEN COALESCE(ads.pending,   0)
        ELSE                                       COALESCE(ks.pending,    0)
      END,
      'completedToday',  CASE
        WHEN p.role = 'consultor_comercial' THEN COALESCE(cs.done_today, 0)
        WHEN p.role = 'gestor_ads'           THEN COALESCE(ads.done_today,0)
        ELSE                                       COALESCE(ks.done_today, 0)
      END,
      'delayedTasks',    CASE
        WHEN p.role = 'consultor_comercial' THEN COALESCE(cs.delayed,    0)
        WHEN p.role = 'gestor_ads'           THEN COALESCE(ads.delayed,   0)
        ELSE                                       COALESCE(ks.delayed,    0)
      END,
      'clientCounts',    CASE WHEN p.role = 'gestor_ads' THEN
        jsonb_build_object(
          'otimo',      COALESCE(acc.otimo,      0),
          'bom',        COALESCE(acc.bom,        0),
          'medio',      COALESCE(acc.medio,      0),
          'ruim',       COALESCE(acc.ruim,       0),
          'onboarding', COALESCE(acc.onboarding, 0),
          'total',      COALESCE(acc.total,      0)
        )
        ELSE NULL END
    )), '[]'::jsonb)
  )
  INTO v_payload
  FROM professionals p
  LEFT JOIN kanban_stats     ks  ON ks.user_id  = p.user_id
  LEFT JOIN comercial_stats  cs  ON cs.user_id  = p.user_id
  LEFT JOIN ads_stats        ads ON ads.user_id = p.user_id
  LEFT JOIN ads_client_counts acc ON acc.user_id = p.user_id;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tv_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tv_dashboard_stats() TO authenticated;

COMMENT ON FUNCTION public.get_tv_dashboard_stats() IS
  'TV Dashboard agregado. Substitui 8 queries baixando milhares de rows no browser.';

COMMIT;
