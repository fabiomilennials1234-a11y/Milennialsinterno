-- 20260415120100_create_tech_enums.sql
-- Enums for the Milennials Tech subsystem (DevTrack-flavored).

BEGIN;

CREATE TYPE public.tech_task_type AS ENUM ('BUG', 'FEATURE', 'HOTFIX', 'CHORE');
CREATE TYPE public.tech_task_status AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');
CREATE TYPE public.tech_task_priority AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE public.tech_sprint_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');
CREATE TYPE public.tech_time_entry_type AS ENUM ('START', 'PAUSE', 'RESUME', 'STOP');

COMMIT;
