BEGIN;
SELECT plan(2);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_notif uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'X', now() - interval '1 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM public.submit_justification(v_notif, 'ok');

  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_done_mine()),
    1::bigint,
    'justificada aparece em done_mine'
  );

  UPDATE public.task_delay_justifications SET requires_revision = true;
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_done_mine()),
    0::bigint,
    'requires_revision oculta de done_mine'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
