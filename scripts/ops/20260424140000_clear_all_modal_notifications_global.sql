-- 20260424140000_clear_all_modal_notifications_global.sql
--
-- OPS GLOBAL one-shot: zera TODOS os modais/justificativas/alertas pendentes
-- para TODOS os usuarios. Marca como concluidos/dispensados sem deletar.
--
-- NAO EH MIGRATION. Single-shot data patch. Rodar via Management API ou SQL Editor.
--
-- ESTRATEGIA:
--   - Nada DELETADO. Inserts de justification/dismissal + UPDATE read=true.
--   - task_delay_notifications: justificativa por (notification_id, task_owner_id).
--   - comercial_delay_notifications: justificativa por (notification_id, user_id).
--   - ads_task_delay_notifications: justificativa por (notification_id, ads_manager_id).
--   - churn_notifications: dismissal para cada user em CHURN_NOTIFICATION_ROLES.
--   - *_completion_notifications: UPDATE read=true.
--   - system_notifications: UPDATE read+dismissed=true.
--
-- MARCADORES (rollback):
--   text '[OPS 2026-04-24 GLOBAL]' em justifications + math_answer em churn dismissals.
--
-- ROLLBACK:
--   DELETE FROM task_delay_justifications       WHERE justification LIKE '[OPS 2026-04-24 GLOBAL]%';
--   DELETE FROM comercial_delay_justifications  WHERE justification LIKE '[OPS 2026-04-24 GLOBAL]%';
--   DELETE FROM ads_task_delay_justifications   WHERE justification LIKE '[OPS 2026-04-24 GLOBAL]%';
--   DELETE FROM churn_notification_dismissals   WHERE math_answer   = '[OPS 2026-04-24 GLOBAL]';

BEGIN;

DO $body$
DECLARE
  v_marker   constant text  := '[OPS 2026-04-24 GLOBAL] Bulk dismiss - fundador';
  v_marker_m constant text  := '[OPS 2026-04-24 GLOBAL]';
  v_now      timestamptz    := now();
  v_count    bigint;
BEGIN
  -- 1. task_delay_justifications (por task_owner)
  INSERT INTO public.task_delay_justifications
    (notification_id, user_id, user_role, justification, created_at)
  SELECT tdn.id, tdn.task_owner_id, COALESCE(tdn.task_owner_role, 'unknown'), v_marker, v_now
  FROM public.task_delay_notifications tdn
  WHERE tdn.task_owner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.task_delay_justifications j
      WHERE j.notification_id = tdn.id AND j.user_id = tdn.task_owner_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'task_delay_justifications inserted: %', v_count;

  -- 2. comercial_delay_justifications (por user_id na notif)
  INSERT INTO public.comercial_delay_justifications
    (notification_id, user_id, user_name, justification, notification_type, client_name, created_at)
  SELECT cdn.id, cdn.user_id, COALESCE(p.name, 'unknown'), v_marker, cdn.notification_type, cdn.client_name, v_now
  FROM public.comercial_delay_notifications cdn
  LEFT JOIN public.profiles p ON p.user_id = cdn.user_id
  WHERE cdn.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.comercial_delay_justifications j
      WHERE j.notification_id = cdn.id AND j.user_id = cdn.user_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'comercial_delay_justifications inserted: %', v_count;

  -- 3. ads_task_delay_justifications (por ads_manager)
  INSERT INTO public.ads_task_delay_justifications
    (notification_id, user_id, user_role, justification, created_at)
  SELECT atdn.id, atdn.ads_manager_id, COALESCE(ur.role, 'gestor_ads'), v_marker, v_now
  FROM public.ads_task_delay_notifications atdn
  LEFT JOIN public.user_roles ur ON ur.user_id = atdn.ads_manager_id
  WHERE atdn.ads_manager_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ads_task_delay_justifications j
      WHERE j.notification_id = atdn.id AND j.user_id = atdn.ads_manager_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ads_task_delay_justifications inserted: %', v_count;

  -- 4. churn_notification_dismissals (1 por usuario em CHURN_NOTIFICATION_ROLES)
  --    Roles que veem churn modal: ceo, gestor_ads, gestor_projetos, sucesso_cliente, financeiro, consultor_comercial
  INSERT INTO public.churn_notification_dismissals
    (notification_id, user_id, dismissed_at, math_answer)
  SELECT cn.id, u.user_id, v_now, v_marker_m
  FROM public.churn_notifications cn
  CROSS JOIN (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('ceo','gestor_ads','gestor_projetos','sucesso_cliente','financeiro','consultor_comercial')
  ) u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.churn_notification_dismissals d
    WHERE d.notification_id = cn.id AND d.user_id = u.user_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'churn_notification_dismissals inserted: %', v_count;

  -- 5. Completion notifications - mark all read
  UPDATE public.design_completion_notifications    SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'design_completion read: %', v_count;

  UPDATE public.video_completion_notifications     SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'video_completion read: %', v_count;

  UPDATE public.dev_completion_notifications       SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'dev_completion read: %', v_count;

  UPDATE public.atrizes_completion_notifications   SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'atrizes_completion read: %', v_count;

  UPDATE public.produtora_completion_notifications SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'produtora_completion read: %', v_count;

  -- 6. Ads notifications - mark all read
  UPDATE public.ads_note_notifications       SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'ads_note read: %', v_count;

  UPDATE public.ads_new_client_notifications SET read = true, read_at = v_now WHERE COALESCE(read,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'ads_new_client read: %', v_count;

  -- 7. system_notifications - mark read + dismissed
  UPDATE public.system_notifications
     SET read = true,
         read_at      = COALESCE(read_at, v_now),
         dismissed    = true,
         dismissed_at = COALESCE(dismissed_at, v_now)
   WHERE COALESCE(read,false)=false OR COALESCE(dismissed,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'system_notifications dismissed: %', v_count;

  RAISE NOTICE 'GLOBAL CLEANUP COMPLETE';
END $body$;

COMMIT;
