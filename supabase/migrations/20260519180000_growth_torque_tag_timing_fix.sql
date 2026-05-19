-- 20260519180000_growth_torque_tag_timing_fix.sql
--
-- Issue #17: Fix TORQUE BLOQUEADO tag timing + backfill counter for 80+ clients
--
-- WHAT:
--   A. growth_advance_gp_step: INSERT TORQUE BLOQUEADO tag when transitioning
--      to acompanhamento_gestores (both v1 and v2 paths)
--   B. growth_assign_full_team: REMOVE the TORQUE BLOQUEADO tag INSERT
--      (tag belongs at step transition, not at team assignment)
--   C. Backfill: set growth_counter_started_at + insert TORQUE BLOQUEADO tag
--      for 81 existing clients in acompanhamento_gestores
--
-- WHY: Tag was being created at team assignment (too early). Counter was
-- never set for legacy-migrated clients. Both must happen at the transition
-- to acompanhamento_gestores.

BEGIN;

-- =============================================================================
-- A. FIX growth_advance_gp_step — add TORQUE BLOQUEADO tag on transition
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

      -- Tag: TORQUE BLOQUEADO (issue #17)
      INSERT INTO public.client_tags (client_id, name, source)
      VALUES (p_client_id, 'TORQUE BLOQUEADO', 'growth:acompanhamento_gestores')
      ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

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

      -- Tag: TORQUE BLOQUEADO (issue #17)
      INSERT INTO public.client_tags (client_id, name, source)
      VALUES (p_client_id, 'TORQUE BLOQUEADO', 'growth:acompanhamento_gestores')
      ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

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

-- =============================================================================
-- B. FIX growth_assign_full_team — REMOVE TORQUE BLOQUEADO tag INSERT
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
  v_caller       uuid := auth.uid();
  v_client       RECORD;
  v_client_name  text;
  v_group_id     uuid;
  v_version      int;
  v_step         text;
  v_gp_ids       uuid[];
  v_name_ads     text;
  v_name_com     text;
  v_name_crm     text;
  v_name_cx      text;
  v_name_mkt     text;
  v_team_list    text;
  v_task_title   text;
  v_effective_cx uuid;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Fetch client
  SELECT id, name, group_id, growth_gp_step, growth_flow_version,
         assigned_sucesso_cliente, crm_status, comercial_status
    INTO v_client
    FROM public.clients
   WHERE id = p_client_id;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  v_client_name := v_client.name;
  v_group_id    := v_client.group_id;
  v_version     := v_client.growth_flow_version;
  v_step        := v_client.growth_gp_step;

  v_effective_cx := COALESCE(p_cx, v_client.assigned_sucesso_cliente);

  -- Assign full team + initialize department statuses
  UPDATE public.clients
     SET assigned_ads_manager     = p_ads,
         assigned_comercial       = p_comercial,
         assigned_crm             = p_crm,
         assigned_sucesso_cliente = v_effective_cx,
         assigned_mktplace        = p_mktplace,
         crm_status               = CASE WHEN crm_status IS NULL THEN 'novo' ELSE crm_status END,
         crm_entered_at           = CASE WHEN crm_status IS NULL THEN now() ELSE crm_entered_at END,
         comercial_status         = CASE WHEN comercial_status IS NULL THEN 'novo' ELSE comercial_status END,
         comercial_entered_at     = CASE WHEN comercial_status IS NULL THEN now() ELSE comercial_entered_at END,
         mktplace_status          = CASE WHEN p_mktplace IS NOT NULL AND mktplace_status IS NULL THEN 'novo' ELSE mktplace_status END,
         mktplace_entered_at      = CASE WHEN p_mktplace IS NOT NULL AND mktplace_status IS NULL THEN now() ELSE mktplace_entered_at END,
         updated_at               = now()
   WHERE id = p_client_id;

  -- Tag: Esperar Briefing (kept — belongs at team assignment)
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (p_client_id, 'Esperar Briefing', 'growth_team_assignment')
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  -- NOTE: TORQUE BLOQUEADO tag REMOVED from here (issue #17).
  -- Tag now created in growth_advance_gp_step at transition to acompanhamento_gestores.

  -- ══════════════════════════════════════════════════════════════════════════
  -- V2-ONLY: atomic step advance + tasks + notifications
  -- ══════════════════════════════════════════════════════════════════════════
  IF v_version = 2 AND v_step = 'escolher_equipe' THEN

    -- 1. Advance step
    UPDATE public.clients
       SET growth_gp_step = 'alinhar_projeto',
           updated_at     = now()
     WHERE id = p_client_id;

    -- 2. Resolve professional names
    SELECT name INTO v_name_ads FROM public.profiles WHERE user_id = p_ads;
    SELECT name INTO v_name_com FROM public.profiles WHERE user_id = p_comercial;
    SELECT name INTO v_name_crm FROM public.profiles WHERE user_id = p_crm;

    IF v_effective_cx IS NOT NULL THEN
      SELECT name INTO v_name_cx FROM public.profiles WHERE user_id = v_effective_cx;
    END IF;

    IF p_mktplace IS NOT NULL THEN
      SELECT name INTO v_name_mkt FROM public.profiles WHERE user_id = p_mktplace::uuid;
    END IF;

    -- 3. Build team list string
    v_team_list := COALESCE(v_name_ads, 'N/A') || E' — Gestor ADS, '
                || COALESCE(v_name_com, 'N/A') || E' — Comercial, '
                || COALESCE(v_name_crm, 'N/A') || E' — CRM';

    IF v_effective_cx IS NOT NULL AND v_name_cx IS NOT NULL THEN
      v_team_list := v_team_list || ', ' || v_name_cx || E' — CX';
    END IF;

    IF p_mktplace IS NOT NULL AND v_name_mkt IS NOT NULL THEN
      v_team_list := v_team_list || ', ' || v_name_mkt || E' — MKTPlace';
    END IF;

    v_task_title := 'Alinhar Projeto com Equipe + Adicionar no grupo '
                 || v_client_name
                 || ' os profissionais responsáveis: '
                 || v_team_list;

    -- 4. Resolve GP user_ids in same group
    SELECT array_agg(p.user_id)
      INTO v_gp_ids
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
     WHERE ur.role = 'gestor_projetos'
       AND (v_group_id IS NULL OR p.group_id = v_group_id);

    -- 5. Create auto-task for GP(s)
    IF v_gp_ids IS NOT NULL THEN
      INSERT INTO public.department_tasks (
        user_id, title, description, task_type, status, priority,
        department, related_client_id, due_date
      )
      SELECT
        unnest(v_gp_ids),
        v_task_title,
        'growth:alinhar_projeto',
        'daily', 'todo', 'high',
        'gestor_projetos', p_client_id,
        now() + interval '1 day';
    END IF;

    -- 6. Notifications to each assigned professional
    -- ADS
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority
    ) VALUES (
      p_ads, 'gestor_ads', 'new_client_assigned_await_briefing',
      'Novo Cliente Growth Atribuído',
      format('Você foi designado(a) para o cliente "%s". Aguarde o briefing do Gestor de Projetos.', v_client_name),
      p_client_id, 'medium'
    );

    -- Comercial
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority
    ) VALUES (
      p_comercial, 'consultor_comercial', 'new_client_assigned_await_briefing',
      'Novo Cliente Growth Atribuído',
      format('Você foi designado(a) para o cliente "%s". Aguarde o briefing do Gestor de Projetos.', v_client_name),
      p_client_id, 'medium'
    );

    -- CRM
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority
    ) VALUES (
      p_crm, 'gestor_crm', 'new_client_assigned_await_briefing',
      'Novo Cliente Growth Atribuído',
      format('Você foi designado(a) para o cliente "%s". Aguarde o briefing do Gestor de Projetos.', v_client_name),
      p_client_id, 'medium'
    );

    -- CX
    IF v_effective_cx IS NOT NULL THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type,
        title, message, client_id, priority
      ) VALUES (
        v_effective_cx, 'sucesso_cliente', 'new_client_assigned_await_briefing',
        'Novo Cliente Growth Atribuído',
        format('Você foi designado(a) para o cliente "%s". Aguarde o briefing do Gestor de Projetos.', v_client_name),
        p_client_id, 'medium'
      );
    END IF;

    -- MKTPlace
    IF p_mktplace IS NOT NULL THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type,
        title, message, client_id, priority
      ) VALUES (
        p_mktplace::uuid, 'consultor_mktplace', 'new_client_assigned_await_briefing',
        'Novo Cliente Growth Atribuído',
        format('Você foi designado(a) para o cliente "%s". Aguarde o briefing do Gestor de Projetos.', v_client_name),
        p_client_id, 'medium'
      );
    END IF;

  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assigned', jsonb_build_object(
      'ads', p_ads,
      'comercial', p_comercial,
      'crm', p_crm,
      'cx', v_effective_cx,
      'mktplace', p_mktplace
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_assign_full_team(uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_assign_full_team(uuid, uuid, uuid, uuid, uuid, text) TO authenticated;

-- =============================================================================
-- C. BACKFILL: counter + tag for existing clients in acompanhamento_gestores
-- =============================================================================

-- Backfill counter
UPDATE public.clients
   SET growth_counter_started_at = now(), updated_at = now()
 WHERE growth_gp_step = 'acompanhamento_gestores'
   AND growth_counter_started_at IS NULL
   AND archived = false;

-- Backfill tag
INSERT INTO public.client_tags (client_id, name, source)
SELECT id, 'TORQUE BLOQUEADO', 'growth:backfill_v1'
  FROM public.clients
 WHERE growth_gp_step = 'acompanhamento_gestores'
   AND archived = false
   AND id NOT IN (
     SELECT client_id FROM public.client_tags
      WHERE name = 'TORQUE BLOQUEADO' AND dismissed_at IS NULL
   )
ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

COMMIT;
