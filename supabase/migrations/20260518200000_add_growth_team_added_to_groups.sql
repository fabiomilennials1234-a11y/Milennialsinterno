ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS growth_team_added_to_groups boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.growth_team_added_to_groups
  IS 'Manual GP confirmation that the assigned team was added to client communication groups';
