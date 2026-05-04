BEGIN;
SELECT plan(7);

DO $$
DECLARE
  v_ceo uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_notif uuid;
  v_just uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_ceo, 'ceo@x.com'), (v_design, 'd@x.com'), (v_outsider, 'o@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES
    (v_ceo, 'CEO'), (v_design, 'D'), (v_outsider, 'O');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_ceo, 'ceo'), (v_design, 'design'), (v_outsider, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_design, 'D', 'design',
    'X', now() - interval '1 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  v_just := public.submit_justification(v_notif, 'minha justif');

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM public.request_justification_revision(v_just, 'refaça');
  PERFORM ok(
    (SELECT requires_revision FROM public.task_delay_justifications WHERE id = v_just) = true,
    'request_revision seta requires_revision=true'
  );
  PERFORM is(
    (SELECT master_comment FROM public.task_delay_justifications WHERE id = v_just),
    'refaça',
    'request_revision grava master_comment'
  );

  PERFORM public.request_justification_revision(v_just, 'refaça melhor');
  PERFORM is(
    (SELECT master_comment FROM public.task_delay_justifications WHERE id = v_just),
    'refaça melhor',
    'comentário é sobrescrito (não acumula)'
  );

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM throws_ok(
    'SELECT public.request_justification_revision(' || quote_literal(v_just::text) || '::uuid, ''oi'')',
    'target user out of caller scope',
    'role sem escopo é bloqueado'
  );

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM public.nudge_user_for_justification(v_notif);
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.system_notifications
            WHERE recipient_id = v_design
              AND notification_type = 'justification_nudge'),
    'nudge insere system_notification para o devedor'
  );

  PERFORM public.nudge_user_for_justification(v_notif);
  PERFORM is(
    (SELECT count(*) FROM public.system_notifications
     WHERE recipient_id = v_design
       AND notification_type = 'justification_nudge'),
    1::bigint,
    'nudge dedupe em 1h'
  );

  PERFORM public.archive_justification(v_just);
  PERFORM ok(
    (SELECT archived FROM public.task_delay_justifications WHERE id = v_just) = true,
    'archive_justification arquiva'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
