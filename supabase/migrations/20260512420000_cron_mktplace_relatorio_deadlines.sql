-- pg_cron: check_mktplace_relatorio_deadlines() diário às 08:00 UTC (05:00 BRT)
-- Verifica cronômetros de relatório MKT Place e dispara notificações
-- quando entram em faixa amarela/laranja/vermelha/vencido.

SELECT cron.unschedule('check-mktplace-relatorio-deadlines')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-mktplace-relatorio-deadlines'
);

SELECT cron.schedule(
  'check-mktplace-relatorio-deadlines',
  '0 8 * * *',
  $$SELECT public.check_mktplace_relatorio_deadlines()$$
);
