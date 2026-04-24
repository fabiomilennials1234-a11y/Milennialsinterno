-- 20260424120000_clear_maycon_notifications_residuals.sql
--
-- OPS one-shot: zera residuos de notificacoes pendentes do usuario Maycon
-- (consultor_comercial, grupo-2) para login limpo.
--
-- NAO EH MIGRATION. Nao replicar em novos ambientes. Single-user data patch.
-- Alvo: producao. Rodar manualmente via SQL editor ou psql com service_role.
--
-- PRE-REQUISITOS:
--   1. Rodar 2026-04-24-maycon-diag.sql para confirmar counts esperados.
--   2. Rodar 2026-04-24-maycon-notif-backup.sql para snapshot de rollback.
--
-- ESTRATEGIA:
--   - Nada eh DELETADO. So criados registros de "dismiss/justification/read".
--   - TaskDelayModal usa presenca de task_delay_justifications (user_id=maycon)
--     como gate -> inserir justificativa "de limpeza" zera o modal.
--   - ComercialDelayModal idem via comercial_delay_justifications.
--   - ChurnNotificationModal usa churn_notification_dismissals.
--   - Completion notifications (5 modulos): UPDATE read=true WHERE requester.
--   - ads_note/ads_new_client: UPDATE read=true (noop se Maycon nao for ads_manager).
--   - system_notifications: UPDATE read=true + dismissed=true.
--   - Overdue tasks: para garantir que nao ha janela de recriacao, pre-seeda
--     task_delay_notifications + task_delay_justifications (Maycon como
--     justificador) para cada task atrasada owned por Maycon. Menos destrutivo
--     que mover due_date (preserva source of truth do comercial).
--
-- SEGURANCA:
--   - Transacao unica. Rollback total se qualquer assert falhar.
--   - Hardcoded user_id + assert existencia.
--   - Nunca escreve com filtro vazio. Nunca UPDATE sem WHERE scopado.
--   - Side-effect conhecido: trigger notify_ceo_on_justification vai criar
--     system_notifications para o CEO ("Nova Justificativa de limpeza").
--     Aceito como visivel/auditavel. CEO pode marcar como read depois.
--
-- ROLLBACK:
--   - As linhas deste script sao INSERT (justifications, dismissals) +
--     UPDATE (read flags). Para reverter:
--       - DELETE FROM task_delay_justifications WHERE justification LIKE '[OPS 2026-04-24]%'
--       - DELETE FROM comercial_delay_justifications WHERE justification LIKE '[OPS 2026-04-24]%'
--       - DELETE FROM churn_notification_dismissals WHERE math_answer = '[OPS 2026-04-24]'
--       - UPDATE <completion_tables> SET read=false, read_at=NULL WHERE requester_id=<uid> AND read_at=<timestamp_do_run>
--     Ou restaurar via backup schema ops_backup_maycon_2026_04_24.

BEGIN;

DO $body$
DECLARE
  v_uid constant uuid := '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';
  v_marker constant text := '[OPS 2026-04-24] Limpeza administrativa - fundador (consultor_comercial)';
  v_marker_churn constant text := '[OPS 2026-04-24]';
  v_role text;
  v_name text;
  v_now timestamptz := now();
  v_count bigint;
BEGIN
  -- ===== 1. Assert user existence + role =====
  SELECT ur.role, COALESCE(p.name, 'Maycon')
    INTO v_role, v_name
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Maycon not found or has no role. uid=%', v_uid USING ERRCODE = 'P0001';
  END IF;

  IF v_role <> 'consultor_comercial' THEN
    RAISE EXCEPTION 'User % role mismatch: expected consultor_comercial, got %', v_uid, v_role USING ERRCODE = 'P0001';
  END IF;

  RAISE NOTICE 'Target user resolved: uid=% role=% name=%', v_uid, v_role, v_name;

  -- ===== 2. Pre-seed task_delay_notifications para overdue tasks owned by Maycon =====
  --    Tabelas source: comercial_tasks, department_tasks, kanban_cards, onboarding_tasks.
  --    ON CONFLICT DO NOTHING pois UNIQUE(task_id, task_table) evita duplicata.

  INSERT INTO public.task_delay_notifications
    (task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
     task_title, task_due_date, created_at)
  SELECT
    ct.id, 'comercial_tasks', v_uid, v_name, v_role,
    ct.title, ct.due_date, v_now
  FROM public.comercial_tasks ct
  WHERE ct.user_id = v_uid
    AND (ct.archived IS NULL OR ct.archived = false)
    AND ct.status <> 'done'
    AND ct.due_date IS NOT NULL
    AND ct.due_date < CURRENT_DATE
  ON CONFLICT (task_id, task_table) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Seeded task_delay_notifications for overdue comercial_tasks: %', v_count;

  INSERT INTO public.task_delay_notifications
    (task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
     task_title, task_due_date, created_at)
  SELECT
    dt.id, 'department_tasks', v_uid, v_name, v_role,
    dt.title, dt.due_date, v_now
  FROM public.department_tasks dt
  WHERE dt.user_id = v_uid
    AND dt.archived = false
    AND dt.status <> 'done'
    AND dt.due_date IS NOT NULL
    AND dt.due_date < CURRENT_DATE
  ON CONFLICT (task_id, task_table) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Seeded task_delay_notifications for overdue department_tasks: %', v_count;

  INSERT INTO public.task_delay_notifications
    (task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
     task_title, task_due_date, created_at)
  SELECT
    kc.id, 'kanban_cards', v_uid, v_name, v_role,
    kc.title, kc.due_date, v_now
  FROM public.kanban_cards kc
  WHERE kc.assigned_to = v_uid
    AND kc.archived = false
    AND kc.status <> 'done'
    AND kc.due_date IS NOT NULL
    AND kc.due_date < CURRENT_DATE
  ON CONFLICT (task_id, task_table) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Seeded task_delay_notifications for overdue kanban_cards: %', v_count;

  INSERT INTO public.task_delay_notifications
    (task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
     task_title, task_due_date, created_at)
  SELECT
    ot.id, 'onboarding_tasks', v_uid, v_name, v_role,
    ot.title, ot.due_date, v_now
  FROM public.onboarding_tasks ot
  WHERE ot.assigned_to = v_uid
    AND (ot.archived IS NULL OR ot.archived = false)
    AND ot.status <> 'done'
    AND ot.due_date IS NOT NULL
    AND ot.due_date < CURRENT_DATE
  ON CONFLICT (task_id, task_table) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Seeded task_delay_notifications for overdue onboarding_tasks: %', v_count;

  -- ===== 3. Inserir task_delay_justifications para TODA notificacao pendente do Maycon =====
  --    Gate do hook: presence of (notification_id, user_id=maycon) na task_delay_justifications.
  --    Cobre inclusive notifications onde Maycon nao eh task_owner mas receberia via
  --    regras de role (consultor_comercial so recebe proprias, mas defensivo).

  INSERT INTO public.task_delay_justifications
    (notification_id, user_id, user_role, justification, created_at)
  SELECT tdn.id, v_uid, v_role, v_marker, v_now
  FROM public.task_delay_notifications tdn
  WHERE tdn.task_owner_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.task_delay_justifications j
      WHERE j.notification_id = tdn.id AND j.user_id = v_uid
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Inserted task_delay_justifications: %', v_count;

  -- ===== 4. ads_task_delay_justifications (se por alguma razao Maycon for ads_manager) =====

  INSERT INTO public.ads_task_delay_justifications
    (notification_id, user_id, user_role, justification, created_at)
  SELECT atdn.id, v_uid, v_role, v_marker, v_now
  FROM public.ads_task_delay_notifications atdn
  WHERE atdn.ads_manager_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.ads_task_delay_justifications j
      WHERE j.notification_id = atdn.id AND j.user_id = v_uid
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Inserted ads_task_delay_justifications: %', v_count;

  -- ===== 5. comercial_delay_justifications =====

  INSERT INTO public.comercial_delay_justifications
    (notification_id, user_id, user_name, justification, notification_type, client_name, created_at)
  SELECT cdn.id, v_uid, v_name, v_marker, cdn.notification_type, cdn.client_name, v_now
  FROM public.comercial_delay_notifications cdn
  WHERE cdn.user_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.comercial_delay_justifications j
      WHERE j.notification_id = cdn.id AND j.user_id = v_uid
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Inserted comercial_delay_justifications: %', v_count;

  -- ===== 6. churn_notification_dismissals =====
  --    consultor_comercial esta em CHURN_NOTIFICATION_ROLES -> precisa dismiss.
  --    math_answer marcado para rollback.

  INSERT INTO public.churn_notification_dismissals
    (notification_id, user_id, dismissed_at, math_answer)
  SELECT cn.id, v_uid, v_now, v_marker_churn
  FROM public.churn_notifications cn
  WHERE NOT EXISTS (
    SELECT 1 FROM public.churn_notification_dismissals d
    WHERE d.notification_id = cn.id AND d.user_id = v_uid
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Inserted churn_notification_dismissals: %', v_count;

  -- ===== 7. Completion notifications (5 modulos) - mark read =====

  UPDATE public.design_completion_notifications
     SET read = true, read_at = v_now
   WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked design_completion_notifications read: %', v_count;

  UPDATE public.video_completion_notifications
     SET read = true, read_at = v_now
   WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked video_completion_notifications read: %', v_count;

  UPDATE public.dev_completion_notifications
     SET read = true, read_at = v_now
   WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked dev_completion_notifications read: %', v_count;

  UPDATE public.atrizes_completion_notifications
     SET read = true, read_at = v_now
   WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked atrizes_completion_notifications read: %', v_count;

  UPDATE public.produtora_completion_notifications
     SET read = true, read_at = v_now
   WHERE requester_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked produtora_completion_notifications read: %', v_count;

  -- ===== 8. Ads notifications (provavelmente noop - Maycon nao eh ads_manager) =====

  UPDATE public.ads_note_notifications
     SET read = true, read_at = v_now
   WHERE ads_manager_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked ads_note_notifications read: %', v_count;

  UPDATE public.ads_new_client_notifications
     SET read = true, read_at = v_now
   WHERE ads_manager_id = v_uid AND COALESCE(read, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked ads_new_client_notifications read: %', v_count;

  -- ===== 9. system_notifications =====
  --    useSystemNotifications filtra (read=false OR dismissed=false) -> seta ambos.

  UPDATE public.system_notifications
     SET read = true,
         read_at = COALESCE(read_at, v_now),
         dismissed = true,
         dismissed_at = COALESCE(dismissed_at, v_now)
   WHERE recipient_id = v_uid
     AND (COALESCE(read, false) = false OR COALESCE(dismissed, false) = false);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked system_notifications read+dismissed: %', v_count;

  -- ===== 10. Post-checks =====

  SELECT count(*) INTO v_count
  FROM public.task_delay_notifications tdn
  WHERE tdn.task_owner_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.task_delay_justifications j
      WHERE j.notification_id = tdn.id AND j.user_id = v_uid
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: task_delay_notifications without justification still exist: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.comercial_delay_notifications cdn
  WHERE cdn.user_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.comercial_delay_justifications j
      WHERE j.notification_id = cdn.id AND j.user_id = v_uid
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: comercial_delay_notifications without justification still exist: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.churn_notifications cn
  WHERE NOT EXISTS (
    SELECT 1 FROM public.churn_notification_dismissals d
    WHERE d.notification_id = cn.id AND d.user_id = v_uid
  );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: churn_notifications without dismissal still exist: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.system_notifications
  WHERE recipient_id = v_uid
    AND (COALESCE(read, false) = false OR COALESCE(dismissed, false) = false);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: system_notifications unread/undismissed still exist: %', v_count;
  END IF;

  RAISE NOTICE 'ALL POST-CHECKS PASSED. Commit proceeds.';
END $body$;

COMMIT;

-- ===== Verify block (read-only, roda fora da transacao) =====
-- Copiar e rodar manualmente apos COMMIT para confirmar 0 pendencias:

-- SELECT 'task_delay_pending' AS bucket, count(*) FROM public.task_delay_notifications tdn
-- WHERE tdn.task_owner_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
--   AND NOT EXISTS (SELECT 1 FROM public.task_delay_justifications j
--                   WHERE j.notification_id = tdn.id AND j.user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d')
-- UNION ALL SELECT 'comercial_delay_pending', count(*) FROM public.comercial_delay_notifications cdn
-- WHERE cdn.user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
--   AND NOT EXISTS (SELECT 1 FROM public.comercial_delay_justifications j
--                   WHERE j.notification_id = cdn.id AND j.user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d')
-- UNION ALL SELECT 'churn_pending', count(*) FROM public.churn_notifications cn
-- WHERE NOT EXISTS (SELECT 1 FROM public.churn_notification_dismissals d
--                   WHERE d.notification_id = cn.id AND d.user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d')
-- UNION ALL SELECT 'design_unread', count(*) FROM public.design_completion_notifications
--   WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'video_unread', count(*) FROM public.video_completion_notifications
--   WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'dev_unread', count(*) FROM public.dev_completion_notifications
--   WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'atrizes_unread', count(*) FROM public.atrizes_completion_notifications
--   WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'produtora_unread', count(*) FROM public.produtora_completion_notifications
--   WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'ads_note_unread', count(*) FROM public.ads_note_notifications
--   WHERE ads_manager_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'ads_new_client_unread', count(*) FROM public.ads_new_client_notifications
--   WHERE ads_manager_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d' AND COALESCE(read,false)=false
-- UNION ALL SELECT 'system_notif_pending', count(*) FROM public.system_notifications
--   WHERE recipient_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
--     AND (COALESCE(read,false)=false OR COALESCE(dismissed,false)=false)
-- ;
-- Todas linhas devem retornar count=0.
