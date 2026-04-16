-- 20260415120700_tech_realtime.sql
BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.tech_tasks,
  public.tech_sprints,
  public.tech_time_entries,
  public.tech_task_activities;

COMMIT;
