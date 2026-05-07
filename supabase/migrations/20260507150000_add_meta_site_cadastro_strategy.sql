-- Add "Site -> Cadastro" funnel type to client_strategies
-- Same shape as meta_millennials_cadastro (jsonb) with additional lp_copy field
ALTER TABLE client_strategies ADD COLUMN IF NOT EXISTS meta_site_cadastro jsonb;
