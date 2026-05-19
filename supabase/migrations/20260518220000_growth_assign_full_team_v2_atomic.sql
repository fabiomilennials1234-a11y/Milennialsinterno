-- 20260518220000_growth_assign_full_team_v2_atomic.sql
--
-- Issue #14: Expand growth_assign_full_team for v2 atomicity.
--
-- WHAT CHANGED:
--   1. COALESCE on assigned_sucesso_cliente — v2 callers pass NULL (CX was
--      auto-derived at registration), v1 callers pass explicit UUID.
--   2. For v2 clients in 'escolher_equipe': advance step to 'alinhar_projeto',
--      create auto-task with dynamic professional names, send notifications
--      to every assigned professional.
--
-- WHY: Eliminates race condition between assign + advance calls. One RPC,
-- one transaction, guaranteed consistency.

BEGIN;

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
  -- Professional names for dynamic task title
  v_name_ads     text;
  v_name_com     text;
  v_name_crm     text;
  v_name_cx      text;
  v_name_mkt     text;
  v_team_list    text;
  v_task_title   text;
  -- Resolved CX (existing or passed)
  v_effective_cx uuid;
BEGIN
  -- ── Auth guard ──
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- ── Fetch client ──
  SELECT id, name, group_id, growth_gp_step, growth_flow_version,
         assigned_sucesso_cliente
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

  -- Resolve effective CX: explicit param wins, otherwise keep existing
  v_effective_cx := COALESCE(p_cx, v_client.assigned_sucesso_cliente);

  -- ── Assign full team ──
  UPDATE public.clients
     SET assigned_ads_manager     = p_ads,
         assigned_comercial       = p_comercial,
         assigned_crm             = p_crm,
         assigned_sucesso_cliente = v_effective_cx,
         assigned_mktplace        = p_mktplace,
         updated_at               = now()
   WHERE id = p_client_id;

  -- ── Tags (unchanged) ──
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (p_client_id, 'Esperar Briefing', 'growth_team_assignment')
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (p_client_id, 'TORQUE BLOQUEADO', 'growth_team_assignment')
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  -- ══════════════════════════════════════════════════════════════════════════
  -- V2-ONLY: atomic step advance + dynamic task + notifications
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

    -- CX (only if resolved)
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

    -- MKTPlace (only if assigned)
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
  -- ══════════════════════════════════════════════════════════════════════════

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

COMMIT;
