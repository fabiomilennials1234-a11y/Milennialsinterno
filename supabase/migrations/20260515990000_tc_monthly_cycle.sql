-- Cat 8 Item 1: TC 30-day monthly cycle tracking
-- Adds tc_cycle_started_at to comercial_tracking for countdown + task chain automation

ALTER TABLE public.comercial_tracking
  ADD COLUMN IF NOT EXISTS tc_cycle_started_at timestamptz DEFAULT NOW();

-- Backfill existing rows: cycle starts from when tracking was created
UPDATE public.comercial_tracking
  SET tc_cycle_started_at = created_at
  WHERE tc_cycle_started_at IS NULL;
