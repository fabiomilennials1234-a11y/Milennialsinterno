-- =============================================
-- API REST: Tables for API key auth, request logging, and CNPJ uniqueness
-- =============================================

-- 1. API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only accessible via service_role_key

-- 2. API Logs table
CREATE TABLE IF NOT EXISTS public.api_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id     UUID REFERENCES public.api_keys(id),
  action         TEXT NOT NULL,
  method         TEXT NOT NULL,
  status_code    INTEGER NOT NULL,
  request_body   JSONB,
  response_body  JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only accessible via service_role_key

-- Index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_api_logs_rate_limit
  ON public.api_logs(api_key_id, created_at DESC);

-- 3. CNPJ unique index on clients table (partial: ignores NULL and empty)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_unique
  ON public.clients(cnpj)
  WHERE cnpj IS NOT NULL AND cnpj != '';

-- 4. Seed a test API key (key text: "***REDACTED***" → hash it)
-- In production, generate a secure random key and store only the hash.
-- The integrator receives the plaintext key; we store only the SHA-256 hash.
INSERT INTO public.api_keys (key_hash, name, expires_at)
VALUES (
  encode(sha256('***REDACTED***'::bytea), 'hex'),
  'Test Key (desenvolvimento)',
  NULL
)
ON CONFLICT (key_hash) DO NOTHING;
