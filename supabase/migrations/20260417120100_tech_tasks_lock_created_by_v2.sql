-- 20260417120100_tech_tasks_lock_created_by_v2.sql
-- Harden tech_tasks.created_by immutability trigger (post-review).
--
-- Two fixes on top of 20260417120000:
--   1. Pin search_path = public on the function body (convention + pg_advisor).
--   2. Switch SQLSTATE from 42501 (insufficient_privilege) to 23514
--      (check_violation) so the error is distinguishable from RLS denials.
-- BEFORE UPDATE fires on every path into tech_tasks, including SECURITY
-- DEFINER RPCs, which is exactly the invariant we want.

CREATE OR REPLACE FUNCTION public.tech_tasks_lock_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
