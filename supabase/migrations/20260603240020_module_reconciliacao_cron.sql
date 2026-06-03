-- 20260603240020_module_reconciliacao_cron.sql
-- Slice 7 (#82) — Reconciliação: agendamento (ADR 0004, parcela b).
--
-- A varredura é 100% SQL (anti-joins) — sem I/O externo. Diferente do
-- reconcile-recordings (que precisa da Storage API e por isso vai por pg_net ->
-- edge), aqui o cron chama a função SQL DIRETO: mais simples, mais robusto, sem
-- rede/JWT/edge/deploy. Decisão registrada no ADR-lite da Slice 7.
--
-- Diário às 03:00 BRT. pg_cron roda em UTC no Supabase (BRT = UTC-3), logo 06:00 UTC.
-- Fora de pico; volumes pequenos; anti-join usa os índices client_id/demanda_id
-- já existentes nos módulos. Idempotente — re-rodar é seguro.
-- PURAMENTE ADITIVO.

BEGIN;

-- pg_cron já instalado no projeto (confirmado). Idempotente.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Re-agendamento idempotente: remove o job anterior (se existir) antes de criar.
SELECT cron.unschedule('reconciliacao-varrer-orfaos')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconciliacao-varrer-orfaos');

-- 06:00 UTC = 03:00 BRT, todo dia.
SELECT cron.schedule(
  'reconciliacao-varrer-orfaos',
  '0 6 * * *',
  $$SELECT reconciliacao.varrer_orfaos()$$
);

COMMIT;
