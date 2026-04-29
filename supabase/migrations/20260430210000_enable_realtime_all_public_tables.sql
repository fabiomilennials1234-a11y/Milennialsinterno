-- 20260430210000_enable_realtime_all_public_tables.sql
--
-- Habilita realtime (publication supabase_realtime) em TODAS as tabelas do
-- schema public. Idempotente — ignora tabelas já adicionadas.
--
-- Realtime envia eventos INSERT/UPDATE/DELETE via Postgres Changes para
-- channels assinados pelo cliente. Frontend usa um listener global que
-- invalida queries do React Query a cada evento → toda página vira realtime.

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      -- Exclui tabelas internas / migrations.
      AND t.tablename NOT LIKE 'pg_%'
      AND t.tablename NOT LIKE 'realtime_%'
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        r.tablename
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;
