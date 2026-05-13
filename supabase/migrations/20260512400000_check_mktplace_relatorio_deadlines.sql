-- RPC: check_mktplace_relatorio_deadlines
-- Scans latest mktplace_relatorios per client+type, calculates days remaining,
-- inserts system_notification if entering yellow/orange/red band and no recent
-- notification of type 'mktplace_relatorio_alert' exists for that client.
-- Called periodically (e.g. via cron or edge function).

CREATE OR REPLACE FUNCTION public.check_mktplace_relatorio_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count  integer := 0;
  rec      record;
BEGIN
  -- Auth check: only authenticated users (or service role via edge function)
  -- When called from edge function with service role, auth.uid() is null,
  -- so we allow both authenticated callers and null (service role).

  FOR rec IN
    WITH latest_reports AS (
      SELECT DISTINCT ON (client_id, report_type)
        client_id,
        report_type,
        created_at,
        CASE WHEN report_type = 'gestao' THEN 15 ELSE 30 END AS cycle_days
      FROM mktplace_relatorios
      ORDER BY client_id, report_type, created_at DESC
    ),
    report_status AS (
      SELECT
        lr.client_id,
        lr.report_type,
        lr.cycle_days,
        EXTRACT(DAY FROM (now() - lr.created_at))::integer AS days_since,
        GREATEST(0, lr.cycle_days - EXTRACT(DAY FROM (now() - lr.created_at))::integer) AS days_left,
        CASE
          WHEN lr.cycle_days > 0
          THEN GREATEST(0, lr.cycle_days - EXTRACT(DAY FROM (now() - lr.created_at))::integer)::numeric / lr.cycle_days
          ELSE 0
        END AS pct_left
      FROM latest_reports lr
    ),
    alerts_needed AS (
      SELECT
        rs.client_id,
        rs.report_type,
        rs.days_left,
        rs.cycle_days,
        CASE
          WHEN rs.days_left = 0 THEN 'overdue'
          WHEN rs.pct_left <= 0.10 THEN 'red'
          WHEN rs.pct_left <= 0.25 THEN 'orange'
          WHEN rs.pct_left <= 0.50 THEN 'yellow'
          ELSE 'green'
        END AS band
      FROM report_status rs
    )
    SELECT
      an.client_id,
      an.report_type,
      an.days_left,
      an.cycle_days,
      an.band,
      c.assigned_mktplace
    FROM alerts_needed an
    JOIN clients c ON c.id = an.client_id
    WHERE an.band IN ('yellow', 'orange', 'red', 'overdue')
      AND c.assigned_mktplace IS NOT NULL
      -- No recent notification (last 24h) for this client+type
      AND NOT EXISTS (
        SELECT 1 FROM system_notifications sn
        WHERE sn.client_id = an.client_id
          AND sn.notification_type = 'mktplace_relatorio_alert'
          AND sn.metadata->>'report_type' = an.report_type
          AND sn.metadata->>'band' = an.band
          AND sn.created_at > now() - interval '24 hours'
      )
  LOOP
    INSERT INTO system_notifications (
      id,
      recipient_id,
      notification_type,
      title,
      message,
      client_id,
      priority,
      metadata,
      created_at
    ) VALUES (
      gen_random_uuid(),
      rec.assigned_mktplace::uuid,
      'mktplace_relatorio_alert',
      CASE rec.band
        WHEN 'overdue' THEN 'Relatorio MKT Place vencido!'
        WHEN 'red'     THEN 'Relatorio MKT Place urgente'
        WHEN 'orange'  THEN 'Relatorio MKT Place em breve'
        ELSE                'Lembrete: Relatorio MKT Place'
      END,
      CASE rec.band
        WHEN 'overdue' THEN 'O relatorio de ' || rec.report_type || ' esta vencido. Crie o relatorio imediatamente.'
        ELSE 'Faltam ' || rec.days_left || ' dias para o relatorio de ' || rec.report_type || '.'
      END,
      rec.client_id,
      CASE rec.band
        WHEN 'overdue' THEN 'urgent'
        WHEN 'red'     THEN 'high'
        WHEN 'orange'  THEN 'medium'
        ELSE                'low'
      END,
      jsonb_build_object(
        'report_type', rec.report_type,
        'band', rec.band,
        'days_left', rec.days_left,
        'cycle_days', rec.cycle_days
      ),
      now()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END
$$;

-- Security: revoke from public, grant to authenticated
REVOKE ALL ON FUNCTION public.check_mktplace_relatorio_deadlines() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_mktplace_relatorio_deadlines() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mktplace_relatorio_deadlines() TO service_role;
