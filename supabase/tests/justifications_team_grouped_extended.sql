BEGIN;
SELECT plan(7);

DO $$
DECLARE
  v_ceo uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
  v_ads uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_dept_task uuid := gen_random_uuid();
  v_ads_task uuid := gen_random_uuid();
  v_dept_task_done uuid := gen_random_uuid();
  v_n_dept uuid; v_n_ads uuid; v_n_done uuid;
BEGIN
  -- Setup users
  INSERT INTO auth.users (id, email) VALUES
    (v_ceo, 'ceo@x.com'),
    (v_design, 'd@x.com'),
    (v_ads, 'a@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES
    (v_ceo, 'CEO'), (v_design, 'D'), (v_ads, 'A');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_ceo, 'ceo'), (v_design, 'design'), (v_ads, 'gestor_ads');

  -- Setup client
  INSERT INTO public.clients (id, name, archived)
    VALUES (v_client, 'ACME', false);

  -- Setup tasks
  -- department_task overdue + linked to client
  INSERT INTO public.department_tasks (
    id, user_id, title, status, department, related_client_id, due_date, archived
  ) VALUES (
    v_dept_task, v_design, 'dept overdue', 'todo', 'design', v_client,
    now() - interval '2 day', false
  );

  -- department_task already done — must NOT appear via status filter
  INSERT INTO public.department_tasks (
    id, user_id, title, status, department, due_date, archived
  ) VALUES (
    v_dept_task_done, v_design, 'dept done', 'done', 'design',
    now() - interval '3 day', false
  );

  -- ads_task overdue (no client_id field on ads_tasks)
  INSERT INTO public.ads_tasks (
    id, ads_manager_id, title, status, due_date
  ) VALUES (
    v_ads_task, v_ads, 'ads overdue', 'todo', current_date - 2
  );

  -- Notifications mirroring the tasks
  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    v_dept_task, 'department_tasks', v_design, 'D', 'design',
    'dept overdue', now() - interval '2 day'
  ) RETURNING id INTO v_n_dept;

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    v_ads_task, 'ads_tasks', v_ads, 'A', 'gestor_ads',
    'ads overdue', now() - interval '2 day'
  ) RETURNING id INTO v_n_ads;

  -- Notification para task com status='done' (deve ser filtrada)
  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    v_dept_task_done, 'department_tasks', v_design, 'D', 'design',
    'dept done', now() - interval '3 day'
  ) RETURNING id INTO v_n_done;

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);

  -- 1. client_name resolvido via department_tasks.related_client_id
  PERFORM is(
    (SELECT client_name FROM public.get_justifications_team_grouped(false, NULL)
       WHERE notification_id = v_n_dept),
    'ACME'::text,
    'client_name resolvido para department_tasks via related_client_id'
  );

  -- 2. department='ads' para row de ads_tasks
  PERFORM is(
    (SELECT department FROM public.get_justifications_team_grouped(false, NULL)
       WHERE notification_id = v_n_ads),
    'ads'::text,
    'department=ads para ads_tasks'
  );

  -- 3. department literal para department_tasks usa coluna direta
  PERFORM is(
    (SELECT department FROM public.get_justifications_team_grouped(false, NULL)
       WHERE notification_id = v_n_dept),
    'design'::text,
    'department=design para department_tasks (coluna direta)'
  );

  -- 4. p_task_tables=['ads_tasks'] filtra somente ads
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false, ARRAY['ads_tasks']::text[])
       WHERE notification_id = v_n_dept),
    0::bigint,
    'p_task_tables=ads_tasks oculta department_tasks'
  );
  PERFORM ok(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false, ARRAY['ads_tasks']::text[])
       WHERE notification_id = v_n_ads) = 1,
    'p_task_tables=ads_tasks inclui ads_task'
  );

  -- 5. status='done' filtra notification cuja task source virou 'done'
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false, NULL)
       WHERE notification_id = v_n_done),
    0::bigint,
    'task com status=done some da RPC'
  );

  -- 6. task_archived reflete estado da source — true após arquivar
  UPDATE public.department_tasks SET archived = true WHERE id = v_dept_task;
  PERFORM is(
    (SELECT task_archived FROM public.get_justifications_team_grouped(false, NULL)
       WHERE notification_id = v_n_dept),
    true,
    'task_archived=true após arquivar source'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
