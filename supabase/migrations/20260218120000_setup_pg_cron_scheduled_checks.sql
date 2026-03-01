-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron: Agendamento das checagens automáticas de 15h e 17h BRT
--
-- BRT = UTC-3 (Brasil não usa horário de verão desde 2019)
-- 15h BRT = 18h UTC
-- 17h BRT = 20h UTC
--
-- As funções SQL já existem (migration 20260204223609):
--   - check_pending_ads_documentation()      → notifica gestores de ads sem doc diária
--   - check_pending_comercial_documentation() → notifica comercial sem doc diária
--   - check_no_clients_moved_today()          → notifica se nenhum cliente foi movido no acompanhamento
--
-- Para habilitar pg_cron no Supabase:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilita a extensão (idempotente — não faz nada se já estiver ativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 15h BRT: Checagem de documentação pendente ────────────────────────────────
-- Remove job anterior se existir (permite reaplicar a migration sem erro)
SELECT cron.unschedule('check-ads-documentation-15h-brt')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-ads-documentation-15h-brt'
);

SELECT cron.schedule(
  'check-ads-documentation-15h-brt',
  '0 18 * * 1-5',   -- 18h UTC = 15h BRT, segunda a sexta
  $$
    SELECT public.check_pending_ads_documentation();
    SELECT public.check_pending_comercial_documentation();
  $$
);

-- ── 17h BRT: Checagem de movimentação no Acompanhamento ──────────────────────
SELECT cron.unschedule('check-tracking-movement-17h-brt')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-tracking-movement-17h-brt'
);

SELECT cron.schedule(
  'check-tracking-movement-17h-brt',
  '0 20 * * 1-5',   -- 20h UTC = 17h BRT, segunda a sexta
  $$
    SELECT public.check_no_clients_moved_today();
  $$
);
