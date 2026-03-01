-- ============================================================
-- Cron Job: Gerar cobranças mensais de Contas a Receber
-- Roda diariamente às 6h BRT (9h UTC)
-- ============================================================

-- Remover job anterior se existir
SELECT cron.unschedule('generate-monthly-receivables-6h-brt')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-receivables-6h-brt'
);

-- Agendar: 9h UTC = 6h BRT, todos os dias
SELECT cron.schedule(
  'generate-monthly-receivables-6h-brt',
  '0 9 * * *',
  $$
    SELECT public.generate_monthly_receivables();
  $$
);
