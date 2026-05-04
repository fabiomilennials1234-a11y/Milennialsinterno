BEGIN;
SELECT plan(8);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_dept_overdue uuid := gen_random_uuid();
  v_dept_done uuid := gen_random_uuid();
  v_dept_future uuid := gen_random_uuid();
  v_ads_overdue uuid := gen_random_uuid();
  v_kanban_overdue uuid := gen_random_uuid();
  v_kanban_unassigned uuid := gen_random_uuid();
  v_comercial_overdue uuid := gen_random_uuid();
  v_board uuid := gen_random_uuid();
  v_column uuid := gen_random_uuid();
  v_count_before bigint;
  v_count_after bigint;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  -- department_tasks: 1 overdue (deve inserir), 1 done (não), 1 future (não)
  INSERT INTO public.department_tasks (
    id, user_id, title, status, department, due_date, archived
  ) VALUES
    (v_dept_overdue, v_user, 'overdue', 'todo', 'design',
     now() - interval '2 day', false),
    (v_dept_done, v_user, 'done', 'done', 'design',
     now() - interval '2 day', false),
    (v_dept_future, v_user, 'future', 'todo', 'design',
     now() + interval '2 day', false);

  -- ads_task overdue
  INSERT INTO public.ads_tasks (id, ads_manager_id, title, status, due_date)
    VALUES (v_ads_overdue, v_user, 'ads', 'todo', current_date - 2);

  -- comercial_task overdue
  INSERT INTO public.comercial_tasks (
    id, user_id, title, status, due_date, archived
  ) VALUES (
    v_comercial_overdue, v_user, 'com', 'todo',
    now() - interval '2 day', false
  );

  -- kanban_cards: 1 overdue assigned, 1 overdue UNASSIGNED (não deve inserir)
  INSERT INTO public.kanban_boards (id, slug, name)
    VALUES (v_board, 'test-board', 'Test');
  INSERT INTO public.kanban_columns (id, board_id, title, position)
    VALUES (v_column, v_board, 'Col', 0);
  INSERT INTO public.kanban_cards (
    id, column_id, board_id, title, status, due_date, assigned_to, archived
  ) VALUES
    (v_kanban_overdue, v_column, v_board, 'kc1', 'todo',
     current_date - 2, v_user, false),
    (v_kanban_unassigned, v_column, v_board, 'kc2', 'todo',
     current_date - 2, NULL, false);

  -- 1ª execução: insere todas
  PERFORM public.check_department_tasks_overdue();
  PERFORM public.check_ads_tasks_overdue();
  PERFORM public.check_comercial_tasks_overdue();
  PERFORM public.check_kanban_cards_overdue();

  PERFORM ok(
    EXISTS (SELECT 1 FROM public.task_delay_notifications
            WHERE task_id = v_dept_overdue AND task_table = 'department_tasks'),
    'department: overdue task notification inserida'
  );
  PERFORM ok(
    NOT EXISTS (SELECT 1 FROM public.task_delay_notifications
                WHERE task_id = v_dept_done AND task_table = 'department_tasks'),
    'department: status=done não gera notification'
  );
  PERFORM ok(
    NOT EXISTS (SELECT 1 FROM public.task_delay_notifications
                WHERE task_id = v_dept_future AND task_table = 'department_tasks'),
    'department: due_date futuro não gera notification'
  );
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.task_delay_notifications
            WHERE task_id = v_ads_overdue AND task_table = 'ads_tasks'),
    'ads: overdue task notification inserida'
  );
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.task_delay_notifications
            WHERE task_id = v_comercial_overdue AND task_table = 'comercial_tasks'),
    'comercial: overdue task notification inserida'
  );
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.task_delay_notifications
            WHERE task_id = v_kanban_overdue AND task_table = 'kanban_cards'),
    'kanban: overdue assigned card notification inserida'
  );
  PERFORM ok(
    NOT EXISTS (SELECT 1 FROM public.task_delay_notifications
                WHERE task_id = v_kanban_unassigned AND task_table = 'kanban_cards'),
    'kanban: card sem assigned_to não gera notification'
  );

  -- Idempotência: 2ª execução não duplica
  SELECT count(*) INTO v_count_before FROM public.task_delay_notifications
    WHERE task_owner_id = v_user;

  PERFORM public.check_department_tasks_overdue();
  PERFORM public.check_ads_tasks_overdue();
  PERFORM public.check_comercial_tasks_overdue();
  PERFORM public.check_kanban_cards_overdue();

  SELECT count(*) INTO v_count_after FROM public.task_delay_notifications
    WHERE task_owner_id = v_user;

  PERFORM is(
    v_count_after, v_count_before,
    'idempotência: re-execução não cria duplicatas (ON CONFLICT)'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
