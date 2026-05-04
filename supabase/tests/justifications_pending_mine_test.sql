BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_notif_a uuid; v_notif_b uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'A', now() - interval '2 day'
  ) RETURNING id INTO v_notif_a;

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'B', now() - interval '1 day'
  ) RETURNING id INTO v_notif_b;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_pending_mine()),
    2::bigint,
    '2 pendentes quando nenhuma foi justificada'
  );

  PERFORM public.submit_justification(v_notif_a, 'ok');
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_pending_mine()),
    1::bigint,
    '1 pendente após justificar uma'
  );

  UPDATE public.task_delay_justifications
    SET requires_revision = true
    WHERE notification_id = v_notif_a;
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_pending_mine()),
    2::bigint,
    'requires_revision faz item voltar pra pendentes'
  );

  UPDATE public.task_delay_justifications
    SET master_comment = 'refaça'
    WHERE notification_id = v_notif_a;
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.get_justifications_pending_mine() WHERE master_comment = 'refaça'),
    'pending inclui master_comment quando requires_revision'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
