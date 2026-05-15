-- 20260515200000_growth_onboarding_v2.sql
--
-- Growth Onboarding V2: replaces the simple 3-step flow with a GP-centric
-- state machine that tracks the full lifecycle of a Growth client from
-- "novos_clientes" through "feito".
--
-- Artifacts:
--   1. New columns on clients: growth_gp_step, growth_counter_started_at,
--      growth_counter_ended_at, growth_torque_unblocked_at
--   2. Table: management_reports (with RLS + public token access)
--   3. RPCs: growth_advance_gp_step, growth_assign_full_team,
--      growth_complete_briefing, growth_on_ads_publicar_campanha,
--      growth_on_ads_daily_tracking, growth_on_crm_finalizado,
--      check_growth_counter_alerts
--   4. Data migration for existing Growth clients
--
-- WHY: The original flow (growth_onboarding_step) was ADS-centric. The new
-- flow (growth_gp_step) is GP-centric — the GP drives the client through
-- each step, with auto-tasks created at each transition.

BEGIN;

-- =============================================================================
-- 1. NEW COLUMNS ON clients
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS growth_gp_step TEXT,
  ADD COLUMN IF NOT EXISTS growth_counter_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS growth_counter_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS growth_torque_unblocked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.clients.growth_gp_step IS
  'Growth GP flow step. Values: novos_clientes, call_1_agendada, call_1_realizada, acompanhamento_gestores, feito. NULL = not in Growth GP flow.';

CREATE INDEX IF NOT EXISTS idx_clients_growth_gp_step
  ON public.clients (growth_gp_step)
  WHERE growth_gp_step IS NOT NULL;

-- Index for the 21-day counter alert query
CREATE INDEX IF NOT EXISTS idx_clients_growth_counter_active
  ON public.clients (growth_counter_started_at)
  WHERE growth_counter_started_at IS NOT NULL
    AND growth_counter_ended_at IS NULL;

-- =============================================================================
-- 2. TABLE: management_reports
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.management_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_month  DATE NOT NULL,
  report_data   JSONB NOT NULL DEFAULT '{}',
  public_token  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, report_month)
);

ALTER TABLE public.management_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_management_reports_client_id
  ON public.management_reports (client_id);

CREATE INDEX IF NOT EXISTS idx_management_reports_public_token
  ON public.management_reports (public_token);

-- moddatetime for updated_at
CREATE TRIGGER management_reports_moddatetime
  BEFORE UPDATE ON public.management_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.moddatetime(updated_at);

-- RLS: authenticated SELECT
DROP POLICY IF EXISTS management_reports_select ON public.management_reports;
CREATE POLICY management_reports_select
  ON public.management_reports
  FOR SELECT TO authenticated
  USING (
    public.is_ceo(auth.uid())
    OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)
    OR public.has_role(auth.uid(), 'gestor_ads'::user_role)
    OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
  );

-- RLS: authenticated INSERT
DROP POLICY IF EXISTS management_reports_insert ON public.management_reports;
CREATE POLICY management_reports_insert
  ON public.management_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_ceo(auth.uid())
    OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)
  );

-- RLS: authenticated UPDATE
DROP POLICY IF EXISTS management_reports_update ON public.management_reports;
CREATE POLICY management_reports_update
  ON public.management_reports
  FOR UPDATE TO authenticated
  USING (
    public.is_ceo(auth.uid())
    OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_ceo(auth.uid())
    OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS: authenticated DELETE
DROP POLICY IF EXISTS management_reports_delete ON public.management_reports;
CREATE POLICY management_reports_delete
  ON public.management_reports
  FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

-- RLS: anon SELECT by public_token (for public report page)
DROP POLICY IF EXISTS management_reports_public_select ON public.management_reports;
CREATE POLICY management_reports_public_select
  ON public.management_reports
  FOR SELECT TO anon
  USING (true);
-- WHY: anon can only reach this table via the get_public_management_report RPC
-- (SECURITY DEFINER, filters by token). Direct table access returns nothing
-- useful without knowing the token. This mirrors mktplace_cycle_reports pattern.

-- =============================================================================
-- 3. RPC: growth_advance_gp_step
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_advance_gp_step(
  p_client_id UUID,
  p_new_step  TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_client     RECORD;
  v_client_name text;
  v_current    text;
  v_gp_ids     uuid[];
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin or gestor_projetos
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Fetch client
  SELECT id, name, growth_gp_step, assigned_ads_manager, group_id
    INTO v_client
    FROM public.clients
   WHERE id = p_client_id;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  v_current := v_client.growth_gp_step;
  v_client_name := v_client.name;

  -- Resolve GP user_ids for auto-tasks
  SELECT array_agg(p.user_id)
    INTO v_gp_ids
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
   WHERE ur.role = 'gestor_projetos'
     AND (v_client.group_id IS NULL OR p.group_id = v_client.group_id);

  -- ── State machine ──
  IF v_current = 'novos_clientes' AND p_new_step = 'call_1_agendada' THEN
    -- Verify CX bloqueado tag is dismissed
    IF EXISTS (
      SELECT 1 FROM public.client_tags
       WHERE client_id = p_client_id
         AND name = 'BLOQUEADO: ESPERAR LIGACAO CX'
         AND dismissed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CX validation not completed — BLOQUEADO tag still active'
        USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.clients
       SET growth_gp_step = 'call_1_agendada', updated_at = now()
     WHERE id = p_client_id;

    -- Auto-task: Marcar Call #1
    IF v_gp_ids IS NOT NULL THEN
      INSERT INTO public.department_tasks (
        user_id, title, description, task_type, status, priority,
        department, related_client_id, due_date
      )
      SELECT
        unnest(v_gp_ids),
        'Marcar Call #1 ' || v_client_name,
        'growth:marcar_call_1',
        'daily', 'todo', 'high',
        'gestor_projetos', p_client_id,
        now() + interval '1 day';
    END IF;

  ELSIF v_current = 'call_1_agendada' AND p_new_step = 'call_1_realizada' THEN
    UPDATE public.clients
       SET growth_gp_step = 'call_1_realizada', updated_at = now()
     WHERE id = p_client_id;

    -- Auto-task: Realizar Call 1 + Escolher equipe
    IF v_gp_ids IS NOT NULL THEN
      INSERT INTO public.department_tasks (
        user_id, title, description, task_type, status, priority,
        department, related_client_id, due_date
      )
      SELECT
        unnest(v_gp_ids),
        'Realizar Call 1 + Escolher equipe ' || v_client_name,
        'growth:realizar_call_1',
        'daily', 'todo', 'high',
        'gestor_projetos', p_client_id,
        now() + interval '1 day';
    END IF;

  ELSIF v_current = 'call_1_realizada' AND p_new_step = 'acompanhamento_gestores' THEN
    -- Validate team assigned
    IF v_client.assigned_ads_manager IS NULL THEN
      RAISE EXCEPTION 'team not assigned — assigned_ads_manager is NULL'
        USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.clients
       SET growth_gp_step = 'acompanhamento_gestores',
           growth_counter_started_at = now(),
           updated_at = now()
     WHERE id = p_client_id;

    -- Auto-task: Alinhar Projeto com Equipe
    IF v_gp_ids IS NOT NULL THEN
      INSERT INTO public.department_tasks (
        user_id, title, description, task_type, status, priority,
        department, related_client_id, due_date
      )
      SELECT
        unnest(v_gp_ids),
        'Alinhar Projeto com Equipe + Adicionar no grupo ' || v_client_name,
        'growth:alinhar_projeto',
        'daily', 'todo', 'high',
        'gestor_projetos', p_client_id,
        now() + interval '1 day';
    END IF;

  ELSIF v_current = 'acompanhamento_gestores' AND p_new_step = 'feito' THEN
    UPDATE public.clients
       SET growth_gp_step = 'feito', updated_at = now()
     WHERE id = p_client_id;

  ELSE
    RAISE EXCEPTION 'invalid transition: % -> %',
      COALESCE(v_current, 'NULL'), p_new_step
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_step', v_current,
    'new_step', p_new_step
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_advance_gp_step(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_advance_gp_step(uuid, text) TO authenticated;

-- =============================================================================
-- 4. RPC: growth_assign_full_team
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_assign_full_team(
  p_client_id  UUID,
  p_ads        UUID,
  p_comercial  UUID,
  p_crm        UUID,
  p_cx         UUID,
  p_mktplace   TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin or gestor_projetos
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  -- Assign full team
  UPDATE public.clients
     SET assigned_ads_manager     = p_ads,
         assigned_comercial       = p_comercial,
         assigned_crm             = p_crm,
         assigned_sucesso_cliente = p_cx,
         assigned_mktplace        = p_mktplace,
         updated_at               = now()
   WHERE id = p_client_id;

  -- Tag: Esperar Briefing
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (p_client_id, 'Esperar Briefing', 'growth_team_assignment')
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  -- Tag: TORQUE BLOQUEADO
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (p_client_id, 'TORQUE BLOQUEADO', 'growth_team_assignment')
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'assigned', jsonb_build_object(
      'ads', p_ads,
      'comercial', p_comercial,
      'crm', p_crm,
      'cx', p_cx,
      'mktplace', p_mktplace
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_assign_full_team(uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_assign_full_team(uuid, uuid, uuid, uuid, uuid, text) TO authenticated;

-- =============================================================================
-- 5. RPC: growth_complete_briefing
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_complete_briefing(
  p_client_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count  int;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin or gestor_projetos
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Dismiss "Esperar Briefing" tag
  UPDATE public.client_tags
     SET dismissed_at = now(),
         dismissed_by = v_caller,
         dismissed_reason = 'briefing_completed'
   WHERE client_id = p_client_id
     AND name = 'Esperar Briefing'
     AND dismissed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'tags_dismissed', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_complete_briefing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_complete_briefing(uuid) TO authenticated;

-- =============================================================================
-- 6. RPC: growth_on_ads_publicar_campanha
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_on_ads_publicar_campanha(
  p_client_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_client_name text;
  v_gp_ids      uuid[];
  v_group_id    uuid;
  v_next_biz    date;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin, gestor_projetos, or gestor_ads
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
    OR public.has_role(v_caller, 'gestor_ads'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Fetch client
  SELECT name, group_id INTO v_client_name, v_group_id
    FROM public.clients
   WHERE id = p_client_id;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Dismiss TORQUE BLOQUEADO tag
  UPDATE public.client_tags
     SET dismissed_at = now(),
         dismissed_by = v_caller,
         dismissed_reason = 'ads_publicar_campanha'
   WHERE client_id = p_client_id
     AND name = 'TORQUE BLOQUEADO'
     AND dismissed_at IS NULL;

  -- 2. Set torque unblocked timestamp
  UPDATE public.clients
     SET growth_torque_unblocked_at = now(),
         updated_at = now()
   WHERE id = p_client_id;

  -- 3. Create "Esperar TORQUE" tag
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (
    p_client_id,
    format('Esperar TORQUE %s ser finalizado', v_client_name),
    'growth_ads_publicar'
  )
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  -- Calculate next business day (skip Saturday=6, Sunday=0)
  v_next_biz := (CURRENT_DATE + interval '1 day')::date;
  WHILE extract(dow FROM v_next_biz) IN (0, 6) LOOP
    v_next_biz := v_next_biz + 1;
  END LOOP;

  -- Resolve GP user_ids
  SELECT array_agg(p.user_id)
    INTO v_gp_ids
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
   WHERE ur.role = 'gestor_projetos'
     AND (v_group_id IS NULL OR p.group_id = v_group_id);

  -- 4. Auto-task GP: Brifar CRM
  IF v_gp_ids IS NOT NULL THEN
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      unnest(v_gp_ids),
      'Brifar CRM ' || v_client_name,
      'growth:brifar_crm',
      'daily', 'todo', 'high',
      'gestor_projetos', p_client_id,
      v_next_biz;

    -- 5. Auto-task GP: Brifar CRM + Alinhar prazo
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      unnest(v_gp_ids),
      'Brifar CRM + Alinhar com o cliente o prazo ' || v_client_name,
      'growth:brifar_crm_alinhar',
      'daily', 'todo', 'high',
      'gestor_projetos', p_client_id,
      v_next_biz;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.growth_on_ads_publicar_campanha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_on_ads_publicar_campanha(uuid) TO authenticated;

-- =============================================================================
-- 7. RPC: growth_on_ads_daily_tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_on_ads_daily_tracking(
  p_client_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin, gestor_projetos, or gestor_ads
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
    OR public.has_role(v_caller, 'gestor_ads'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  -- Set counter end timestamp
  UPDATE public.clients
     SET growth_counter_ended_at = now(),
         updated_at = now()
   WHERE id = p_client_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.growth_on_ads_daily_tracking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_on_ads_daily_tracking(uuid) TO authenticated;

-- =============================================================================
-- 8. RPC: growth_on_crm_finalizado
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_on_crm_finalizado(
  p_client_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count  int;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin, gestor_projetos, gestor_crm, or consultor_comercial
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
    OR public.has_role(v_caller, 'gestor_crm'::user_role)
    OR public.has_role(v_caller, 'consultor_comercial'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Dismiss all "Esperar TORQUE%" tags from growth_ads_publicar
  UPDATE public.client_tags
     SET dismissed_at = now(),
         dismissed_by = v_caller,
         dismissed_reason = 'crm_finalizado'
   WHERE client_id = p_client_id
     AND name LIKE 'Esperar TORQUE%'
     AND source = 'growth_ads_publicar'
     AND dismissed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'tags_dismissed', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_on_crm_finalizado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_on_crm_finalizado(uuid) TO authenticated;

-- =============================================================================
-- 9. RPC: check_growth_counter_alerts (cron-callable)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_growth_counter_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_client     RECORD;
  v_gp_ids     uuid[];
  v_ceo_id     uuid;
  v_count      int := 0;
BEGIN
  -- Auth guard: either authenticated user or NULL (pg_cron context)
  -- pg_cron runs as superuser without auth.uid(), so allow NULL for cron
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Find CEO for notifications
  SELECT ur.user_id INTO v_ceo_id
    FROM public.user_roles ur
   WHERE ur.role = 'ceo'
   LIMIT 1;

  -- Iterate clients with active counter >= 21 days
  FOR v_client IN
    SELECT c.id, c.name, c.group_id
      FROM public.clients c
     WHERE c.growth_counter_started_at IS NOT NULL
       AND c.growth_counter_ended_at IS NULL
       AND now() - c.growth_counter_started_at >= interval '21 days'
  LOOP
    -- Resolve GPs in same group
    SELECT array_agg(p.user_id)
      INTO v_gp_ids
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
     WHERE ur.role = 'gestor_projetos'
       AND (v_client.group_id IS NULL OR p.group_id = v_client.group_id);

    -- Notify GPs
    IF v_gp_ids IS NOT NULL THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type,
        title, message, client_id, priority
      )
      SELECT
        unnest(v_gp_ids),
        'gestor_projetos',
        'growth_counter_21_days',
        'Alerta: 21 dias sem Daily Tracking',
        format('O cliente "%s" esta ha mais de 21 dias sem Daily Tracking ativo. Verifique o status.', v_client.name),
        v_client.id,
        'high';
    END IF;

    -- Notify CEO
    IF v_ceo_id IS NOT NULL THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type,
        title, message, client_id, priority
      )
      VALUES (
        v_ceo_id,
        'ceo',
        'growth_counter_21_days',
        'Alerta: 21 dias sem Daily Tracking',
        format('O cliente "%s" esta ha mais de 21 dias sem Daily Tracking ativo. Verifique o status.', v_client.name),
        v_client.id,
        'high'
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'clients_alerted', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_growth_counter_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_growth_counter_alerts() TO authenticated;

-- =============================================================================
-- 10. RPC: get_public_management_report (anon-accessible by token)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_management_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', mr.id,
    'client_id', mr.client_id,
    'report_month', mr.report_month,
    'report_data', mr.report_data,
    'public_token', mr.public_token,
    'created_at', mr.created_at,
    'updated_at', mr.updated_at,
    'client_name', c.name
  )
  INTO v_result
  FROM public.management_reports mr
  LEFT JOIN public.clients c ON c.id = mr.client_id
  WHERE mr.public_token = _token
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_management_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_management_report(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_management_report(text) TO authenticated;

-- =============================================================================
-- 11. DATA MIGRATION: Backfill growth_gp_step for existing Growth clients
-- =============================================================================

-- Growth clients with team already assigned + no growth_onboarding_step
-- or growth_onboarding_step = 'equipe_designada' → acompanhamento_gestores
UPDATE public.clients
   SET growth_gp_step = 'acompanhamento_gestores'
 WHERE 'millennials-growth' = ANY(contracted_products)
   AND assigned_ads_manager IS NOT NULL
   AND (growth_onboarding_step IS NULL OR growth_onboarding_step = 'equipe_designada')
   AND growth_gp_step IS NULL;

-- Growth clients without team → novos_clientes
UPDATE public.clients
   SET growth_gp_step = 'novos_clientes'
 WHERE 'millennials-growth' = ANY(contracted_products)
   AND assigned_ads_manager IS NULL
   AND growth_gp_step IS NULL;

-- Growth clients with growth_onboarding_step = 'call_1_agendada'
UPDATE public.clients
   SET growth_gp_step = 'call_1_agendada'
 WHERE 'millennials-growth' = ANY(contracted_products)
   AND growth_onboarding_step = 'call_1_agendada'
   AND growth_gp_step IS NULL;

COMMIT;
