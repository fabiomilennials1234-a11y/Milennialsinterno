-- 20260504180000_fix_ads_overdue_archived_filter.sql
--
-- check_ads_tasks_overdue() was missing the archived filter that the other 3
-- cron functions (comercial, department, kanban) already had. Without it,
-- archived ads_tasks still generated spurious delay notifications.

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
    AND COALESCE(at.archived, false) = false
  ON CONFLICT (task_id, task_table) DO NOTHING;
END $$;
