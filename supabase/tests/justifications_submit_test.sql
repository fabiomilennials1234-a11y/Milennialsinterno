BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_notif uuid;
  v_first_id uuid;
  v_second_id uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'Tarefa X', now() - interval '2 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  v_first_id := public.submit_justification(v_notif, 'porque sim');
  PERFORM ok(v_first_id IS NOT NULL, 'submit cria justificativa');

  v_second_id := public.submit_justification(v_notif, 'porque sim 2');
  PERFORM is(v_second_id, v_first_id, 're-submit sem revision retorna mesmo id (idempotente)');

  UPDATE public.task_delay_justifications
    SET requires_revision = true, revision_requested_at = now()
    WHERE id = v_first_id;

  v_second_id := public.submit_justification(v_notif, 'agora vai');
  PERFORM isnt(v_second_id, v_first_id, 'apos requires_revision, nova submissão cria novo id');

  PERFORM ok(
    (SELECT archived FROM public.task_delay_justifications WHERE id = v_first_id) = true,
    'versão antiga marcada archived após nova submissão'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
