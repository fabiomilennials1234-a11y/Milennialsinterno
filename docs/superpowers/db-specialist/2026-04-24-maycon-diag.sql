-- 2026-04-24-maycon-diag.sql
--
-- PRE-FLIGHT: diagnostico read-only. NAO modifica nada.
-- Rodar no SQL editor do Supabase conectado a prod.
--
-- Objetivo: confirmar user_id do Maycon (consultor_comercial / grupo-2)
-- e contar residuos de notificacoes pendentes por tabela.

DO $$
DECLARE
  v_expected_uid uuid := '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';
  v_uid uuid;
  v_role text;
  v_group text;
  v_count bigint;
BEGIN
  -- 1. Resolver user_id (tenta expected primeiro, cai em lookup por nome+role)
  SELECT p.user_id, ur.role, ug.slug
    INTO v_uid, v_role, v_group
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  LEFT JOIN public.user_groups ug ON ug.id = p.group_id
  WHERE p.user_id = v_expected_uid;

  IF v_uid IS NULL THEN
    -- Fallback: buscar por nome + role
    SELECT p.user_id, ur.role, ug.slug
      INTO v_uid, v_role, v_group
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'consultor_comercial'
    LEFT JOIN public.user_groups ug ON ug.id = p.group_id
    WHERE p.name ILIKE 'Maycon%'
    LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Maycon not found. Adjust filter.';
  END IF;

  RAISE NOTICE 'Resolved user_id=%, role=%, group=%', v_uid, v_role, v_group;
  RAISE NOTICE '-----------------------------------------------------------';

  -- 2. Contagem residuos por tabela

  SELECT count(*) INTO v_count
  FROM public.task_delay_notifications tdn
  WHERE tdn.task_owner_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.task_delay_justifications j
      WHERE j.notification_id = tdn.id AND j.user_id = v_uid
    );
  RAISE NOTICE 'task_delay_notifications (as task_owner, no user justification): %', v_count;

  SELECT count(*) INTO v_count
  FROM public.ads_task_delay_notifications atdn
  WHERE atdn.ads_manager_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.ads_task_delay_justifications j
      WHERE j.notification_id = atdn.id AND j.user_id = v_uid
    );
  RAISE NOTICE 'ads_task_delay_notifications (as ads_manager, no user justification): %', v_count;

  SELECT count(*) INTO v_count
  FROM public.comercial_delay_notifications cdn
  WHERE cdn.user_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.comercial_delay_justifications j
      WHERE j.notification_id = cdn.id AND j.user_id = v_uid
    );
  RAISE NOTICE 'comercial_delay_notifications (user_id=maycon, no justification): %', v_count;

  SELECT count(*) INTO v_count
  FROM public.churn_notifications cn
  WHERE NOT EXISTS (
    SELECT 1 FROM public.churn_notification_dismissals d
    WHERE d.notification_id = cn.id AND d.user_id = v_uid
  );
  RAISE NOTICE 'churn_notifications (no maycon dismissal): %', v_count;

  SELECT count(*) INTO v_count
  FROM public.design_completion_notifications
  WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'design_completion_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.video_completion_notifications
  WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'video_completion_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.dev_completion_notifications
  WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'dev_completion_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.atrizes_completion_notifications
  WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'atrizes_completion_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.produtora_completion_notifications
  WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'produtora_completion_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.ads_note_notifications
  WHERE ads_manager_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'ads_note_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.ads_new_client_notifications
  WHERE ads_manager_id = v_uid AND COALESCE(read, false) = false;
  RAISE NOTICE 'ads_new_client_notifications unread: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.system_notifications
  WHERE recipient_id = v_uid
    AND (COALESCE(read, false) = false OR COALESCE(dismissed, false) = false);
  RAISE NOTICE 'system_notifications pending (unread or not dismissed): %', v_count;

  -- 3. Overdue tasks owned by Maycon (sources that feed TaskDelayModal)

  SELECT count(*) INTO v_count
  FROM public.comercial_tasks
  WHERE user_id = v_uid
    AND (archived IS NULL OR archived = false)
    AND status <> 'done'
    AND due_date IS NOT NULL
    AND due_date < CURRENT_DATE;
  RAISE NOTICE 'comercial_tasks overdue owned by maycon: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.department_tasks
  WHERE user_id = v_uid
    AND archived = false
    AND status <> 'done'
    AND due_date IS NOT NULL
    AND due_date < CURRENT_DATE;
  RAISE NOTICE 'department_tasks overdue owned by maycon: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.kanban_cards
  WHERE assigned_to = v_uid
    AND archived = false
    AND status <> 'done'
    AND due_date IS NOT NULL
    AND due_date < CURRENT_DATE;
  RAISE NOTICE 'kanban_cards overdue owned by maycon: %', v_count;

  SELECT count(*) INTO v_count
  FROM public.onboarding_tasks
  WHERE assigned_to = v_uid
    AND (archived IS NULL OR archived = false)
    AND status <> 'done'
    AND due_date IS NOT NULL
    AND due_date < CURRENT_DATE;
  RAISE NOTICE 'onboarding_tasks overdue owned by maycon: %', v_count;

  RAISE NOTICE '-----------------------------------------------------------';
  RAISE NOTICE 'Diagnostico concluido. Revisar counts antes de rodar cleanup.';
END $$;
