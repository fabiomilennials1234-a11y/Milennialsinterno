BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_ceo uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
  v_n1 uuid; v_n2 uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_ceo, 'ceo@x.com'), (v_design, 'd@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_ceo, 'CEO'), (v_design, 'D');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_ceo, 'ceo'), (v_design, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_design, 'D', 'design',
    'A', now() - interval '2 day'
  ), (
    gen_random_uuid(), 'department_tasks', v_design, 'D', 'design',
    'B', now() - interval '1 day'
  )
  RETURNING id INTO v_n1;

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false)) >= 2,
    'CEO vê itens da equipe'
  );

  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false)),
    0::bigint,
    'role sem escopo vê conjunto vazio'
  );

  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  SELECT id INTO v_n2 FROM public.task_delay_notifications WHERE task_owner_id = v_design LIMIT 1;
  PERFORM public.submit_justification(v_n2, 'ok');

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_justifications_team_grouped(true))
      < (SELECT count(*) FROM public.get_justifications_team_grouped(false)),
    'only_pending=true filtra menos itens que false'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
