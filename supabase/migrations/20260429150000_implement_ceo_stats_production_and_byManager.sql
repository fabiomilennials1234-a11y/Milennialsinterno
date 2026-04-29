-- 20260429150000_implement_ceo_stats_production_and_byManager.sql
--
-- P1.2: substitui placeholders das sub-RPCs por agregacoes reais:
--   - get_ceo_stats_production:  avgDays/totalCompleted/pending por board
--     especializado (design, video, produtora, atrizes) lendo kanban_cards.
--   - get_ceo_stats_churn:       byManager + distratoClients reais.
--   - get_ceo_stats_client_labels: byManager + topRuimManager reais.
--
-- Continua placeholder (proximos cortes):
--   - get_ceo_stats_group_squad
--   - get_ceo_stats_financial.byProduct / monthlyTrend
--   - get_ceo_stats_tasks.overdueByArea

BEGIN;

-- ── get_ceo_stats_production ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ceo_stats_production()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();

  -- Mapeamento card_type -> status final esperado.
  v_design     jsonb;
  v_video      jsonb;
  v_produtora  jsonb;
  v_atrizes    jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH agg AS (
    SELECT
      card_type,
      ROUND(
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
            FILTER (WHERE status = ANY(final_statuses)),
          0
        )::numeric,
        1
      ) AS avg_days,
      COUNT(*) FILTER (WHERE status = ANY(final_statuses))::int AS total_completed,
      COUNT(*) FILTER (
        WHERE COALESCE(archived, false) = false
          AND (status IS NULL OR NOT (status = ANY(final_statuses)))
      )::int AS pending
    FROM public.kanban_cards
    JOIN (VALUES
      ('design',    ARRAY['aprovado']),
      ('video',     ARRAY['aprovado']),
      ('dev',       ARRAY['aprovados']),
      ('atrizes',   ARRAY['aprovados']),
      ('produtora', ARRAY['gravado'])
    ) AS m(card_type_match, final_statuses) ON m.card_type_match = card_type
    GROUP BY card_type
  )
  SELECT
    (SELECT jsonb_build_object('avgDays', COALESCE(avg_days, 0), 'totalCompleted', COALESCE(total_completed, 0), 'pending', COALESCE(pending, 0))
       FROM agg WHERE card_type = 'design'),
    (SELECT jsonb_build_object('avgDays', COALESCE(avg_days, 0), 'totalCompleted', COALESCE(total_completed, 0), 'pending', COALESCE(pending, 0))
       FROM agg WHERE card_type = 'video'),
    (SELECT jsonb_build_object('avgDays', COALESCE(avg_days, 0), 'totalCompleted', COALESCE(total_completed, 0), 'pending', COALESCE(pending, 0))
       FROM agg WHERE card_type = 'produtora'),
    (SELECT jsonb_build_object('avgDays', COALESCE(avg_days, 0), 'totalCompleted', COALESCE(total_completed, 0), 'pending', COALESCE(pending, 0))
       FROM agg WHERE card_type = 'atrizes')
  INTO v_design, v_video, v_produtora, v_atrizes;

  RETURN jsonb_build_object(
    'design',    COALESCE(v_design,    jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0)),
    'video',     COALESCE(v_video,     jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0)),
    'produtora', COALESCE(v_produtora, jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0)),
    'atrizes',   COALESCE(v_atrizes,   jsonb_build_object('avgDays', 0, 'totalCompleted', 0, 'pending', 0))
  );
END;
$$;

-- ── get_ceo_stats_churn ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ceo_stats_churn()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_month_start date := date_trunc('month', current_date)::date;
  v_prev_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_total_churned int;
  v_churned_this_month int;
  v_churned_last_month int;
  v_distrato int;
  v_by_manager jsonb;
  v_top_manager jsonb;
  v_distrato_clients jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(archived, false) = true OR status = 'churned')::int,
    COUNT(*) FILTER (WHERE archived_at >= v_month_start)::int,
    COUNT(*) FILTER (WHERE archived_at >= v_prev_month_start AND archived_at < v_month_start)::int,
    COUNT(*) FILTER (WHERE distrato_step IS NOT NULL AND COALESCE(archived, false) = false)::int
  INTO v_total_churned, v_churned_this_month, v_churned_last_month, v_distrato
  FROM public.clients;

  -- byManager: agrupa churns por gestor de ads.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'name',    name,
    'count',   total
  ) ORDER BY total DESC), '[]'::jsonb)
  INTO v_by_manager
  FROM (
    SELECT p.user_id, p.name, COUNT(*)::int AS total
    FROM public.clients c
    JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
    WHERE (COALESCE(c.archived, false) = true OR c.status = 'churned')
      AND c.assigned_ads_manager IS NOT NULL
    GROUP BY p.user_id, p.name
  ) t;

  -- topChurnManager: gestor com mais churns.
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'name',    p.name,
    'count',   COUNT(*)::int
  )
  INTO v_top_manager
  FROM public.clients c
  JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
  WHERE (COALESCE(c.archived, false) = true OR c.status = 'churned')
    AND c.assigned_ads_manager IS NOT NULL
  GROUP BY p.user_id, p.name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- distratoClients: lista clientes em distrato com nome + step.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',            c.id,
    'name',          c.name,
    'distrato_step', c.distrato_step,
    'monthly_value', c.monthly_value
  ) ORDER BY c.name), '[]'::jsonb)
  INTO v_distrato_clients
  FROM public.clients c
  WHERE c.distrato_step IS NOT NULL
    AND COALESCE(c.archived, false) = false;

  RETURN jsonb_build_object(
    'totalChurned',       v_total_churned,
    'churnedThisMonth',   v_churned_this_month,
    'churnedLastMonth',   v_churned_last_month,
    'distratoInProgress', v_distrato,
    'byManager',          v_by_manager,
    'topChurnManager',    v_top_manager,
    'distratoClients',    v_distrato_clients
  );
END;
$$;

-- ── get_ceo_stats_client_labels ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ceo_stats_client_labels()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_total int;
  v_otimo int;
  v_bom int;
  v_medio int;
  v_ruim int;
  v_sem int;
  v_by_manager jsonb;
  v_top_ruim jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT (public.is_executive(v_caller) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE client_label = 'otimo')::int,
    COUNT(*) FILTER (WHERE client_label = 'bom')::int,
    COUNT(*) FILTER (WHERE client_label = 'medio')::int,
    COUNT(*) FILTER (WHERE client_label = 'ruim')::int,
    COUNT(*) FILTER (WHERE client_label IS NULL OR client_label NOT IN ('otimo','bom','medio','ruim'))::int
  INTO v_total, v_otimo, v_bom, v_medio, v_ruim, v_sem
  FROM public.clients
  WHERE COALESCE(archived, false) = false
    AND COALESCE(status, '') <> 'churned'
    AND distrato_step IS NULL;

  -- byManager: distribuicao de labels por gestor de ads.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'name',    name,
    'total',   total,
    'otimo',   otimo,
    'bom',     bom,
    'medio',   medio,
    'ruim',    ruim,
    'sem',     sem
  ) ORDER BY total DESC), '[]'::jsonb)
  INTO v_by_manager
  FROM (
    SELECT
      p.user_id,
      p.name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE c.client_label = 'otimo')::int AS otimo,
      COUNT(*) FILTER (WHERE c.client_label = 'bom')::int   AS bom,
      COUNT(*) FILTER (WHERE c.client_label = 'medio')::int AS medio,
      COUNT(*) FILTER (WHERE c.client_label = 'ruim')::int  AS ruim,
      COUNT(*) FILTER (WHERE c.client_label IS NULL OR c.client_label NOT IN ('otimo','bom','medio','ruim'))::int AS sem
    FROM public.clients c
    JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
    WHERE COALESCE(c.archived, false) = false
      AND COALESCE(c.status, '') <> 'churned'
      AND c.distrato_step IS NULL
      AND c.assigned_ads_manager IS NOT NULL
    GROUP BY p.user_id, p.name
  ) t;

  -- topRuimManager: gestor com mais clientes 'ruim'.
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'name',    p.name,
    'count',   COUNT(*)::int
  )
  INTO v_top_ruim
  FROM public.clients c
  JOIN public.profiles p ON p.user_id = c.assigned_ads_manager
  WHERE c.client_label = 'ruim'
    AND COALESCE(c.archived, false) = false
    AND COALESCE(c.status, '') <> 'churned'
    AND c.distrato_step IS NULL
    AND c.assigned_ads_manager IS NOT NULL
  GROUP BY p.user_id, p.name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'total',         v_total,
    'otimo',         v_otimo,
    'bom',           v_bom,
    'medio',         v_medio,
    'ruim',          v_ruim,
    'semLabel',      v_sem,
    'byManager',     v_by_manager,
    'topRuimManager',v_top_ruim
  );
END;
$$;

COMMIT;
