-- 20260416100000_fix_tech_time_entries_ordering.sql
-- Fix: tech_time_entries.created_at uses now() which returns the same value
-- within a transaction. When tech_start_timer auto-pauses other timers,
-- the PAUSE and START entries get identical timestamps, making ORDER BY
-- created_at DESC non-deterministic in tech_timer_is_active.
--
-- Solution: add a SERIAL column `seq` as a deterministic tiebreaker.
-- Also update tech_timer_is_active to ORDER BY seq DESC.

BEGIN;

-- Add deterministic ordering column
ALTER TABLE public.tech_time_entries
  ADD COLUMN seq BIGINT GENERATED ALWAYS AS IDENTITY;

-- Rebuild the function to use seq for ordering
CREATE OR REPLACE FUNCTION public.tech_timer_is_active(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT type IN ('START','RESUME')
     FROM public.tech_time_entries
     WHERE task_id = _task_id AND user_id = _user_id
     ORDER BY seq DESC
     LIMIT 1),
    false
  );
$$;

COMMIT;
