-- 20260504170100_schedule_delay_notification_checks.sql
--
-- Antes desta migration, criação de task_delay_notifications dependia
-- inteiramente de useCheckOverdueTasks no frontend (refetch a cada 60s) — o
-- que falha sempre que ninguém da role ADS_DELAY_NOTIFICATION_ROLES está com
-- a página aberta. Resultado: tasks atrasadas sem notification, métricas
-- divergentes entre Squad/MyDelays/CEO.
--
-- Esta migration move a checagem para pg_cron (server-side, idempotente).
-- Cada função:
--   - Filtra task overdue + status != 'done' + archived = false
--   - Resolve task_owner_role via user_roles (single source of truth)
--   - INSERT em task_delay_notifications com ON CONFLICT (task_id, task_table)
--     DO NOTHING (idempotente — UNIQUE existente da migration 20260118204630)
--
-- Frontend hook useCheckOverdueTasks pode ser desligado depois (Task 9/10).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── ads_tasks ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_comercial_tasks_overdue()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  )
  SELECT
    ct.id,
    'comercial_tasks',
    ct.user_id,
    COALESCE(p.name, 'Usuário'),
    COALESCE(ur.role, 'consultor_comercial'),
    ct.title,
    ct.due_date
  FROM public.comercial_tasks ct
  LEFT JOIN public.profiles p ON p.user_id = ct.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = ct.user_id
  WHERE ct.due_date IS NOT NULL
    AND ct.due_date < (current_date)::timestamptz
    AND ct.status IS DISTINCT FROM 'done'
    AND COALESCE(ct.archived, false) = false
  ON CONFLICT (task_id, task_table) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.check_ads_tasks_overdue()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  )
  SELECT
    at.id,
    'ads_tasks',
    at.ads_manager_id,
    COALESCE(p.name, 'Usuário'),
    COALESCE(ur.role, 'gestor_ads'),
    at.title,
    at.due_date::timestamptz
  FROM public.ads_tasks at
  LEFT JOIN public.profiles p ON p.user_id = at.ads_manager_id
  LEFT JOIN public.user_roles ur ON ur.user_id = at.ads_manager_id
  WHERE at.due_date IS NOT NULL
    AND at.due_date < current_date
    AND at.status IS DISTINCT FROM 'done'
  ON CONFLICT (task_id, task_table) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.check_department_tasks_overdue()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  )
  SELECT
    dt.id,
    'department_tasks',
    dt.user_id,
    COALESCE(p.name, 'Usuário'),
    COALESCE(ur.role, dt.department),
    dt.title,
    dt.due_date
  FROM public.department_tasks dt
  LEFT JOIN public.profiles p ON p.user_id = dt.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = dt.user_id
  WHERE dt.due_date IS NOT NULL
    AND dt.due_date < (current_date)::timestamptz
    AND dt.status IS DISTINCT FROM 'done'
    AND dt.archived = false
  ON CONFLICT (task_id, task_table) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.check_kanban_cards_overdue()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  )
  SELECT
    kc.id,
    'kanban_cards',
    kc.assigned_to,
    COALESCE(p.name, 'Usuário'),
    COALESCE(ur.role, 'unknown'),
    kc.title,
    kc.due_date::timestamptz
  FROM public.kanban_cards kc
  LEFT JOIN public.profiles p ON p.user_id = kc.assigned_to
  LEFT JOIN public.user_roles ur ON ur.user_id = kc.assigned_to
  WHERE kc.due_date IS NOT NULL
    AND kc.due_date < current_date
    AND kc.status IS DISTINCT FROM 'done'
    AND kc.archived = false
    AND kc.assigned_to IS NOT NULL
  ON CONFLICT (task_id, task_table) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.check_comercial_tasks_overdue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_ads_tasks_overdue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_department_tasks_overdue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_kanban_cards_overdue() FROM PUBLIC;

-- Não dou GRANT para authenticated. Estas funções são chamadas só pelo cron
-- (postgres role). Frontend usa a RPC de leitura (get_justifications_team_grouped),
-- não as de escrita. Segurança: zero exposure pra usuário.

-- ── Schedule a cada 30 min ───────────────────────────────────────────────────
-- Usa um job único combinando as 4 funções para minimizar overhead de cron.
SELECT cron.unschedule('check-task-delays-30min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-task-delays-30min'
);

SELECT cron.schedule(
  'check-task-delays-30min',
  '*/30 * * * *',
  $$
    SELECT public.check_comercial_tasks_overdue();
    SELECT public.check_ads_tasks_overdue();
    SELECT public.check_department_tasks_overdue();
    SELECT public.check_kanban_cards_overdue();
  $$
);
