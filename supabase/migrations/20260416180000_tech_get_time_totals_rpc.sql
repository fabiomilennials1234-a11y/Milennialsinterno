-- 20260416180000_tech_get_time_totals_rpc.sql
-- RPC to get time totals for all tasks. Bypasses view/RLS complexity.

BEGIN;

CREATE OR REPLACE FUNCTION public.tech_get_time_totals()
RETURNS TABLE(task_id uuid, total_seconds bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT task_id, total_seconds
  FROM public.tech_task_time_totals;
$$;

GRANT EXECUTE ON FUNCTION public.tech_get_time_totals() TO authenticated;

COMMIT;
