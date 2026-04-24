-- 2026-04-24-maycon-notif-backup.sql
--
-- BACKUP: dump dos registros que o cleanup vai tocar, antes da execucao.
-- Formato: staging table publica em schema 'ops_backup_maycon_2026_04_24'.
-- Ignidempotente-safe: cria schema limpo, recria tabelas a cada run.
-- Preserva payload exato (SELECT *) para rollback manual via INSERT.
--
-- Rodar este script PRIMEIRO, depois o cleanup.

DO $$
DECLARE
  v_uid uuid := '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User % not found in profiles. Abort backup.', v_uid;
  END IF;
END $$;

DROP SCHEMA IF EXISTS ops_backup_maycon_2026_04_24 CASCADE;
CREATE SCHEMA ops_backup_maycon_2026_04_24;

-- 1. task_delay_notifications que referenciam Maycon (owner)
CREATE TABLE ops_backup_maycon_2026_04_24.task_delay_notifications AS
SELECT * FROM public.task_delay_notifications
WHERE task_owner_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 2. ads_task_delay_notifications onde Maycon e ads_manager (provavelmente 0)
CREATE TABLE ops_backup_maycon_2026_04_24.ads_task_delay_notifications AS
SELECT * FROM public.ads_task_delay_notifications
WHERE ads_manager_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 3. comercial_delay_notifications do Maycon
CREATE TABLE ops_backup_maycon_2026_04_24.comercial_delay_notifications AS
SELECT * FROM public.comercial_delay_notifications
WHERE user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 4. churn_notifications (todas) + dismissals existentes do Maycon
CREATE TABLE ops_backup_maycon_2026_04_24.churn_notifications AS
SELECT * FROM public.churn_notifications;

CREATE TABLE ops_backup_maycon_2026_04_24.churn_notification_dismissals AS
SELECT * FROM public.churn_notification_dismissals
WHERE user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 5. completion_notifications (todas as 5)
CREATE TABLE ops_backup_maycon_2026_04_24.design_completion_notifications AS
SELECT * FROM public.design_completion_notifications
WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

CREATE TABLE ops_backup_maycon_2026_04_24.video_completion_notifications AS
SELECT * FROM public.video_completion_notifications
WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

CREATE TABLE ops_backup_maycon_2026_04_24.dev_completion_notifications AS
SELECT * FROM public.dev_completion_notifications
WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

CREATE TABLE ops_backup_maycon_2026_04_24.atrizes_completion_notifications AS
SELECT * FROM public.atrizes_completion_notifications
WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

CREATE TABLE ops_backup_maycon_2026_04_24.produtora_completion_notifications AS
SELECT * FROM public.produtora_completion_notifications
WHERE requester_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 6. ads_note / ads_new_client (provavelmente 0 para consultor_comercial)
CREATE TABLE ops_backup_maycon_2026_04_24.ads_note_notifications AS
SELECT * FROM public.ads_note_notifications
WHERE ads_manager_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

CREATE TABLE ops_backup_maycon_2026_04_24.ads_new_client_notifications AS
SELECT * FROM public.ads_new_client_notifications
WHERE ads_manager_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 7. system_notifications
CREATE TABLE ops_backup_maycon_2026_04_24.system_notifications AS
SELECT * FROM public.system_notifications
WHERE recipient_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d';

-- 8. overdue tasks owned by Maycon (nao seram modificadas, mas ficam de backup)
CREATE TABLE ops_backup_maycon_2026_04_24.overdue_comercial_tasks AS
SELECT * FROM public.comercial_tasks
WHERE user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
  AND (archived IS NULL OR archived = false)
  AND status <> 'done'
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE;

CREATE TABLE ops_backup_maycon_2026_04_24.overdue_department_tasks AS
SELECT * FROM public.department_tasks
WHERE user_id = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
  AND archived = false
  AND status <> 'done'
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE;

CREATE TABLE ops_backup_maycon_2026_04_24.overdue_kanban_cards AS
SELECT * FROM public.kanban_cards
WHERE assigned_to = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
  AND archived = false
  AND status <> 'done'
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE;

CREATE TABLE ops_backup_maycon_2026_04_24.overdue_onboarding_tasks AS
SELECT * FROM public.onboarding_tasks
WHERE assigned_to = '3fe3996b-f90d-4594-9cc4-1fd87ea19d2d'
  AND (archived IS NULL OR archived = false)
  AND status <> 'done'
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE;

-- Relatorio de linhas salvas
DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE 'Backup schema: ops_backup_maycon_2026_04_24';
  FOR r IN
    SELECT table_name,
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM ops_backup_maycon_2026_04_24.%I', table_name),
                               true, true, '')))[1]::text AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'ops_backup_maycon_2026_04_24'
    ORDER BY table_name
  LOOP
    RAISE NOTICE '  %: % rows', r.table_name, r.cnt;
  END LOOP;
END $$;

-- Para exportar fora do cluster (opcional, via psql local com service_role DATABASE_URL):
--   pg_dump "$DATABASE_URL" --schema=ops_backup_maycon_2026_04_24 --data-only \
--     -f docs/superpowers/db-specialist/2026-04-24-maycon-notif-backup.dump.sql
