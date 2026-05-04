BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_notif uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com'), (v_other, 'o@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U'), (v_other, 'O');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design'), (v_other, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_other, 'O', 'design',
    'X', now() - interval '1 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM public.submit_justification(v_notif, 'mine');

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM is(
    (SELECT count(*) FROM public.task_delay_justifications WHERE user_id = v_other),
    0::bigint,
    'RLS oculta justificativas de outros'
  );

  PERFORM throws_ok(
    'INSERT INTO public.task_delay_justifications (notification_id, user_id, user_role, justification) VALUES ('
      || quote_literal(v_notif::text) || '::uuid, '
      || quote_literal(v_user::text) || '::uuid, ''design'', ''hack'')',
    NULL,
    'INSERT direto bloqueado'
  );

  PERFORM throws_ok(
    'UPDATE public.task_delay_justifications SET justification = ''hack'' WHERE user_id = '
      || quote_literal(v_other::text) || '::uuid',
    NULL,
    'UPDATE direto bloqueado'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
