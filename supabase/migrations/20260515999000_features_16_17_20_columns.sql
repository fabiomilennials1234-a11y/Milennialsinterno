-- Feature 16: Campo "benefícios do produto" na call form
ALTER TABLE client_call_forms ADD COLUMN IF NOT EXISTS beneficios_produto text;

-- Feature 17: Área de links no card do cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Feature 20: 4 perguntas na documentação diária ADS
ALTER TABLE ads_daily_documentation ADD COLUMN IF NOT EXISTS leads_gerados text;
ALTER TABLE ads_daily_documentation ADD COLUMN IF NOT EXISTS leads_cadastrados_crm text;
ALTER TABLE ads_daily_documentation ADD COLUMN IF NOT EXISTS leads_incompletos text;
ALTER TABLE ads_daily_documentation ADD COLUMN IF NOT EXISTS etapa_crm_parados text;
