-- pg_cron: Checagem automática de notificações de treinamento a cada 1 minuto
-- Necessário para disparar nos tempos corretos (60, 30, 10, 5, 1, 0 min antes + em andamento)

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job anterior se existir
SELECT cron.unschedule('check-training-notifications-every-min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-training-notifications-every-min'
);

-- Agendar a cada 1 minuto, todos os dias
SELECT cron.schedule(
  'check-training-notifications-every-min',
  '* * * * *',
  $$SELECT public.check_training_notifications();$$
);
