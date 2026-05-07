-- 20260507120000_cron_crm_stalled_client_tasks.sql
--
-- Auto-generate department_tasks for clients stalled >1 day in CRM tracking.
--
-- When a client in crm_daily_tracking has last_moved_at older than 24h and
-- crm_status is active (boas_vindas or acompanhamento), create a high-priority
-- task for the assigned gestor_crm to contact the client.
--
-- Idempotent: skips if an active (todo/doing, not archived) task with matching
-- related_client_id + department + title prefix already exists — so a stalled
-- client only gets ONE task until the gestor completes or archives it.
--
-- Runs Mon-Fri 06:00 BRT (09:00 UTC) via pg_cron.

-- ==================== FUNCTION ====================

CREATE OR REPLACE FUNCTION public._cron_generate_crm_stalled_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    RECORD;
  v_count  integer := 0;
  v_title  text;
BEGIN
  -- No auth check: called by pg_cron (superuser context)

  FOR v_row IN
    SELECT
      t.client_id,
      t.gestor_id,
      t.current_day,
      t.last_moved_at,
      c.name        AS client_name,
      c.crm_status
    FROM public.crm_daily_tracking t
    JOIN public.clients c
      ON c.id = t.client_id
     AND c.archived = false
     AND c.crm_status IN ('boas_vindas', 'acompanhamento')
    WHERE t.last_moved_at < now() - interval '1 day'
  LOOP
    v_title := 'Entrar em contato com '
            || COALESCE(v_row.client_name, 'cliente')
            || ' — parado na etapa '
            || v_row.crm_status;

    -- Idempotency: skip if active task already exists for this client
    IF NOT EXISTS (
      SELECT 1
      FROM public.department_tasks
      WHERE related_client_id = v_row.client_id
        AND department = 'gestor_crm'
        AND title LIKE 'Entrar em contato com%'
        AND status IN ('todo', 'doing')
        AND archived = false
    ) THEN
      INSERT INTO public.department_tasks (
        user_id,
        department,
        title,
        description,
        task_type,
        status,
        priority,
        related_client_id
      ) VALUES (
        v_row.gestor_id::uuid,
        'gestor_crm',
        v_title,
        'Cliente parado há mais de 1 dia na etapa "'
          || v_row.crm_status
          || '" (dia: ' || v_row.current_day
          || '). Entre em contato para dar continuidade ao acompanhamento.',
        'daily',
        'todo',
        'high',
        v_row.client_id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Only callable by superuser/pg_cron — not exposed to authenticated users
REVOKE ALL ON FUNCTION public._cron_generate_crm_stalled_tasks() FROM PUBLIC;

-- ==================== pg_cron (Mon-Fri 06:00 BRT = 09:00 UTC) ====================

SELECT cron.unschedule('crm-stalled-client-tasks')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'crm-stalled-client-tasks'
);

SELECT cron.schedule(
  'crm-stalled-client-tasks',
  '0 9 * * 1-5',
  $$SELECT public._cron_generate_crm_stalled_tasks()$$
);
