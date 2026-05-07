-- 20260507230000_manual_step_advance.sql
--
-- Replace auto-advance trigger with manual step advancement.
-- Add is_blocking flag to department_tasks.
--
-- Changes:
--   1. DROP auto-advance trigger + function
--   2. ADD is_blocking column (DEFAULT true — all existing tasks become blocking)

BEGIN;

-- ===========================================================================
-- 1. Remove auto-advance trigger and function
-- ===========================================================================

DROP TRIGGER IF EXISTS trg_department_task_auto_advance_project ON public.department_tasks;
DROP FUNCTION IF EXISTS public._trg_department_task_auto_advance_project();

-- ===========================================================================
-- 2. Add is_blocking column
-- ===========================================================================

ALTER TABLE public.department_tasks
  ADD COLUMN IF NOT EXISTS is_blocking BOOLEAN NOT NULL DEFAULT true;

COMMIT;
