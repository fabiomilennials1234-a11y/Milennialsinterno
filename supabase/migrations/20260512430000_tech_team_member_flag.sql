-- Add is_tech_team_member flag to profiles
-- Decouples "tech team membership" (who shows in Doc Dev, 1:1, etc.)
-- from system role (which controls permissions across the whole app).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_tech_team_member boolean DEFAULT false;

-- Set Marcelo (CTO) and Diego (Gestor CRM) as tech team members
UPDATE profiles SET is_tech_team_member = true WHERE user_id IN (
  'db4fb931-6776-4f60-b448-d5000f34a20b',  -- Marcelo Montemezzo
  'daa0cadf-f694-434d-9e2d-e404e49cece5'   -- Diego
);

-- Explicitly ensure Andrew and Gabriel are NOT tech team members
UPDATE profiles SET is_tech_team_member = false WHERE user_id IN (
  '58705738-b7fe-4964-afc8-c64f98a25e55',  -- Andrew
  '7069f38e-116d-4dbb-b355-62ab1bcf7d43'   -- Gabriel
);
