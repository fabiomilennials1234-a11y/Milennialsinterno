-- Cleanup orphaned recording sessions that exceeded the 2h limit.
-- Runs every 15 minutes via pg_cron.
-- Uses 2h15m threshold to give frontend auto-stop a 15min buffer.

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_recording_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE recording_sessions
  SET status = 'abandoned',
      error_message = 'Sessao abandonada automaticamente: limite de 2 horas excedido',
      updated_at = now()
  WHERE status IN ('recording', 'stopped')
    AND started_at < now() - interval '2 hours 15 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  IF affected_count > 0 THEN
    RAISE LOG 'cleanup_orphaned_recording_sessions: marked % sessions as abandoned', affected_count;
  END IF;
END;
$$;

SELECT cron.schedule(
  'cleanup-orphaned-recordings',
  '*/15 * * * *',
  $$SELECT public.cleanup_orphaned_recording_sessions()$$
);
