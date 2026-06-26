-- 20260627150000_tech_billing_hours.sql
-- SLICE #164 — Milennials Tech as an internal Jira: BILLING reporting.
-- tech_billing_hours(p_start, p_end) is the period-clipped time-on-the-clock
-- record, grouped at project + client grain — the data source for "how many
-- hours did we burn for each client in this window".
--
-- WHY a dedicated RPC (and not tech_get_time_totals reused): time totals are
-- ALL-TIME per task; billing needs the same event-sourced replay CLIPPED to a
-- billing window [p_start, p_end] and rolled to the project/client a task
-- belongs to. The replay is byte-for-byte the tech_task_time_totals contract:
-- a START/RESUME paired (via LEAD) with the next PAUSE/STOP closes an interval;
-- a START/RESUME with no successor is still open and counts to now(). The ONLY
-- addition is clipping: each interval is intersected with the window before its
-- seconds are measured.
--
-- INVARIANT — why we clip the interval, not the rows. Filtering raw entries by
-- created_at would break pairing: a START inside the window whose STOP lands
-- outside would lose its close and read as "open to now()", massively
-- over-billing. So every row is paired first (full history), THEN each interval
-- is intersected with the window:
--   open_at  = the START/RESUME's created_at
--   close_at = next PAUSE/STOP's created_at, or now() when still open
--   seconds  = max(0, LEAST(close_at, p_end) - GREATEST(open_at, p_start))
-- NULL p_start/p_end degrade to -infinity/+infinity, so the no-arg call equals
-- the unclipped view exactly (the pgTAP "totals match raw" assertion).
--
-- Grain: sum per task, then INNER JOIN tech_tasks -> tech_projects (a task with
-- no surviving project is dropped — orphan time has no project to bill), LEFT
-- JOIN clients (a project with NULL client_id is KEPT with client_id/name NULL —
-- internal work is still billable hours, just unattributed). issue_count is the
-- number of the project's tasks with >0 clipped seconds in the window. ORDER BY
-- total_seconds DESC: heaviest project first.
--
-- The join is clients.id (uuid) = tech_projects.client_id (uuid) — both uuid, so
-- NO text/uuid coercion here (the assigned_mktplace text quirk is unrelated).
--
-- SECURITY DEFINER + search_path='' (everything schema-qualified, including the
-- enum cast public.tech_time_entry_type) + tech_assert_staff gate, mirroring
-- tech_team_throughput. REVOKE from PUBLIC/anon so the function is never reachable
-- over the anon REST surface; only authenticated callers reach it, and
-- assert_staff narrows that to tech staff. The RPC exposes only project/client
-- name + hours — no extra PII.

CREATE OR REPLACE FUNCTION public.tech_billing_hours(
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  project_id    uuid,
  project_name  text,
  client_id     uuid,
  client_name   text,
  total_seconds bigint,
  issue_count   int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.tech_assert_staff();

  RETURN QUERY
    WITH ordered AS (
      SELECT
        e.task_id,
        e.type,
        e.created_at,
        lead(e.created_at) OVER (PARTITION BY e.task_id ORDER BY e.created_at, e.seq) AS next_at,
        lead(e.type)       OVER (PARTITION BY e.task_id ORDER BY e.created_at, e.seq) AS next_type
      FROM public.tech_time_entries e
    ),
    intervals AS (
      SELECT
        o.task_id,
        CASE
          WHEN o.type = ANY (ARRAY['START', 'RESUME']::public.tech_time_entry_type[])
               AND o.next_type = ANY (ARRAY['PAUSE', 'STOP']::public.tech_time_entry_type[]) THEN
            GREATEST(0, EXTRACT(epoch FROM
              LEAST(o.next_at, COALESCE(p_end, 'infinity'::timestamptz))
              - GREATEST(o.created_at, COALESCE(p_start, '-infinity'::timestamptz))))
          WHEN o.type = ANY (ARRAY['START', 'RESUME']::public.tech_time_entry_type[])
               AND o.next_at IS NULL THEN
            GREATEST(0, EXTRACT(epoch FROM
              LEAST(now(), COALESCE(p_end, 'infinity'::timestamptz))
              - GREATEST(o.created_at, COALESCE(p_start, '-infinity'::timestamptz))))
          ELSE 0::numeric
        END AS seconds
      FROM ordered o
    ),
    per_task AS (
      SELECT
        i.task_id,
        COALESCE(sum(i.seconds), 0)::bigint AS task_seconds
      FROM intervals i
      GROUP BY i.task_id
    )
    SELECT
      pr.id                                            AS project_id,
      pr.name                                          AS project_name,
      pr.client_id                                     AS client_id,
      c.name                                           AS client_name,
      COALESCE(sum(pt.task_seconds), 0)::bigint        AS total_seconds,
      count(*) FILTER (WHERE pt.task_seconds > 0)::int AS issue_count
    FROM per_task pt
    JOIN public.tech_tasks t      ON t.id = pt.task_id
    JOIN public.tech_projects pr  ON pr.id = t.project_id
    LEFT JOIN public.clients c    ON c.id = pr.client_id
    GROUP BY pr.id, pr.name, pr.client_id, c.name
    ORDER BY total_seconds DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_billing_hours(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_billing_hours(timestamptz, timestamptz) TO authenticated;
