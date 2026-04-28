-- Schedule check_crm_configs_delayed() to run every hour.
-- Without this, pendings only created on manual trigger; modal never appears.
-- Pattern matches existing pg_cron jobs (check-ads-documentation-15h-brt, etc).

SELECT cron.schedule(
  'check-crm-configs-delayed-hourly',
  '0 * * * *',  -- top of every hour
  $$SELECT public.check_crm_configs_delayed();$$
);
