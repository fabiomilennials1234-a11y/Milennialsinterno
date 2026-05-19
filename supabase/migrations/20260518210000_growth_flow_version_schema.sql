-- 20260518210000_growth_flow_version_schema.sql
--
-- Issue #11: Grandfathering — growth_flow_version + v2 step values
--
-- WHY: Growth onboarding is being restructured (PRD #10). Existing clients
-- follow v1 state machine; new clients follow v2. This column lets the RPC
-- route transitions correctly and prevents cross-version step contamination.
--
-- Artifacts:
--   1. New column: clients.growth_flow_version (INTEGER NOT NULL DEFAULT 2)
--   2. Backfill: existing clients with growth_gp_step IS NOT NULL → version 1
--   3. Trigger patch: trg_set_growth_gp_step also sets growth_flow_version = 2
--   4. RPC: growth_advance_gp_step rewritten with version-aware state machine
--      - V1: novos_clientes → call_1_agendada → call_1_realizada → acompanhamento_gestores → feito
--      - V2: novos_clientes → realizar_call_1 → escolher_equipe → alinhar_projeto → acompanhamento_gestores → feito
--      - Cross-version transitions rejected

BEGIN;

-- =============================================================================
-- 1. NEW COLUMN: clients.growth_flow_version
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS growth_flow_version INTEGER NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.clients.growth_flow_version IS
  'Growth onboarding flow version. 1 = legacy (call_1_agendada/call_1_realizada), 2 = new (realizar_call_1/escolher_equipe/alinhar_projeto). Default 2 for new clients.';

-- =============================================================================
-- 2. BACKFILL: existing clients with growth_gp_step → version 1
-- =============================================================================

UPDATE public.clients
   SET growth_flow_version = 1
 WHERE growth_gp_step IS NOT NULL
   AND growth_flow_version = 2;  -- only touch rows that got the default

-- =============================================================================
-- 3. TRIGGER PATCH: trg_set_growth_gp_step sets version = 2 for new Growth clients
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_set_growth_gp_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.growth_gp_step IS NULL
     AND NEW.contracted_products IS NOT NULL
     AND 'millennials-growth' = ANY(NEW.contracted_products)
  THEN
    NEW.growth_gp_step := 'novos_clientes';
    NEW.growth_flow_version := 2;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_set_growth_gp_step() IS
  'Automatically sets growth_gp_step to novos_clientes and growth_flow_version to 2 for new Growth clients.';

-- =============================================================================
-- 4. RPC: growth_advance_gp_step — version-aware state machine
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
  v_version    int;
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
  SELECT id, name, growth_gp_step, growth_flow_version,
         assigned_ads_manager, group_id
    INTO v_client
    FROM public.clients
   WHERE id = p_client_id;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  v_current := v_client.growth_gp_step;
  v_version := v_client.growth_flow_version;
  v_client_name := v_client.name;

  -- Resolve GP user_ids for auto-tasks
  SELECT array_agg(p.user_id)
    INTO v_gp_ids
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
   WHERE ur.role = 'gestor_projetos'
     AND (v_client.group_id IS NULL OR p.group_id = v_client.group_id);

  -- ══════════════════════════════════════════════════════════════════════════
  -- V1 STATE MACHINE
  -- novos_clientes → call_1_agendada → call_1_realizada → acompanhamento_gestores → feito
  -- ══════════════════════════════════════════════════════════════════════════
  IF v_version = 1 THEN

    -- Reject v2-only steps
    IF p_new_step IN ('realizar_call_1', 'escolher_equipe', 'alinhar_projeto') THEN
      RAISE EXCEPTION 'step "%" is not valid for flow version 1', p_new_step
        USING ERRCODE = 'P0002';
    END IF;

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
      IF v_client.assigned_ads_manager IS NULL THEN
        RAISE EXCEPTION 'team not assigned — assigned_ads_manager is NULL'
          USING ERRCODE = 'P0002';
      END IF;

      UPDATE public.clients
         SET growth_gp_step = 'acompanhamento_gestores',
             growth_counter_started_at = now(),
             updated_at = now()
       WHERE id = p_client_id;

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
      RAISE EXCEPTION 'invalid v1 transition: % -> %',
        COALESCE(v_current, 'NULL'), p_new_step
        USING ERRCODE = 'P0002';
    END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- V2 STATE MACHINE
  -- novos_clientes → realizar_call_1 → escolher_equipe → alinhar_projeto → acompanhamento_gestores → feito
  -- ══════════════════════════════════════════════════════════════════════════
  ELSIF v_version = 2 THEN

    -- Reject v1-only steps
    IF p_new_step IN ('call_1_agendada', 'call_1_realizada') THEN
      RAISE EXCEPTION 'step "%" is not valid for flow version 2', p_new_step
        USING ERRCODE = 'P0002';
    END IF;

    IF v_current = 'novos_clientes' AND p_new_step = 'realizar_call_1' THEN
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
         SET growth_gp_step = 'realizar_call_1', updated_at = now()
       WHERE id = p_client_id;

      IF v_gp_ids IS NOT NULL THEN
        INSERT INTO public.department_tasks (
          user_id, title, description, task_type, status, priority,
          department, related_client_id, due_date
        )
        SELECT
          unnest(v_gp_ids),
          'Realizar Call 1 ' || v_client_name,
          'growth:realizar_call_1',
          'daily', 'todo', 'high',
          'gestor_projetos', p_client_id,
          now() + interval '1 day';
      END IF;

    ELSIF v_current = 'realizar_call_1' AND p_new_step = 'escolher_equipe' THEN
      UPDATE public.clients
         SET growth_gp_step = 'escolher_equipe', updated_at = now()
       WHERE id = p_client_id;

      IF v_gp_ids IS NOT NULL THEN
        INSERT INTO public.department_tasks (
          user_id, title, description, task_type, status, priority,
          department, related_client_id, due_date
        )
        SELECT
          unnest(v_gp_ids),
          'Escolher Equipe ' || v_client_name,
          'growth:escolher_equipe',
          'daily', 'todo', 'high',
          'gestor_projetos', p_client_id,
          now() + interval '1 day';
      END IF;

    ELSIF v_current = 'escolher_equipe' AND p_new_step = 'alinhar_projeto' THEN
      -- Team must be assigned before aligning project
      IF v_client.assigned_ads_manager IS NULL THEN
        RAISE EXCEPTION 'team not assigned — assigned_ads_manager is NULL'
          USING ERRCODE = 'P0002';
      END IF;

      UPDATE public.clients
         SET growth_gp_step = 'alinhar_projeto', updated_at = now()
       WHERE id = p_client_id;

      IF v_gp_ids IS NOT NULL THEN
        INSERT INTO public.department_tasks (
          user_id, title, description, task_type, status, priority,
          department, related_client_id, due_date
        )
        SELECT
          unnest(v_gp_ids),
          'Alinhar Projeto com Equipe ' || v_client_name,
          'growth:alinhar_projeto',
          'daily', 'todo', 'high',
          'gestor_projetos', p_client_id,
          now() + interval '1 day';
      END IF;

    ELSIF v_current = 'alinhar_projeto' AND p_new_step = 'acompanhamento_gestores' THEN
      UPDATE public.clients
         SET growth_gp_step = 'acompanhamento_gestores',
             growth_counter_started_at = now(),
             updated_at = now()
       WHERE id = p_client_id;

    ELSIF v_current = 'acompanhamento_gestores' AND p_new_step = 'feito' THEN
      UPDATE public.clients
         SET growth_gp_step = 'feito', updated_at = now()
       WHERE id = p_client_id;

    ELSE
      RAISE EXCEPTION 'invalid v2 transition: % -> %',
        COALESCE(v_current, 'NULL'), p_new_step
        USING ERRCODE = 'P0002';
    END IF;

  ELSE
    RAISE EXCEPTION 'unknown growth_flow_version: %', v_version
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_step', v_current,
    'new_step', p_new_step,
    'flow_version', v_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_advance_gp_step(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_advance_gp_step(uuid, text) TO authenticated;

COMMIT;
