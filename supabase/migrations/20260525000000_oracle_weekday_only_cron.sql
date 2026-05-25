-- ============================================================
-- Fix: Oracle cron should only run on weekdays (Mon-Fri)
-- Previously: '0 9 * * *' (every day)
-- Now:        '0 9 * * 1-5' (Mon-Fri only)
-- ============================================================

SELECT cron.unschedule('oracle-daily-summaries');

SELECT cron.schedule(
  'oracle-daily-summaries',
  '0 9 * * 1-5',
  $$SELECT public.trigger_oracle_summaries()$$
);
