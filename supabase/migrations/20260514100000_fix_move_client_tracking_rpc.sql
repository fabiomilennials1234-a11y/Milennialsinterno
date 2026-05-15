-- Fix: RPC for atomic client tracking move
-- Solves race condition + RLS mismatch when secondary manager or
-- recently-reassigned manager tries to move a client they can see
-- but whose tracking record is owned by someone else.

CREATE OR REPLACE FUNCTION public.move_client_tracking_day(
    _client_id uuid,
    _ads_manager_id uuid,
    _new_day text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Authorization: caller must be the ads_manager_id OR admin OR secondary manager for this client
    IF NOT (
        _ads_manager_id = auth.uid()
        OR is_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM client_secondary_managers
            WHERE client_id = _client_id
              AND secondary_manager_id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: you cannot move this client';
    END IF;

    -- Atomic upsert — no race between SELECT and INSERT
    INSERT INTO client_daily_tracking (client_id, ads_manager_id, current_day, last_moved_at, is_delayed)
    VALUES (_client_id, _ads_manager_id, _new_day, now(), false)
    ON CONFLICT (client_id)
    DO UPDATE SET
        current_day = EXCLUDED.current_day,
        ads_manager_id = EXCLUDED.ads_manager_id,
        last_moved_at = EXCLUDED.last_moved_at,
        is_delayed = EXCLUDED.is_delayed,
        updated_at = now();
END;
$$;

-- Grant execute to authenticated users (RLS is handled inside the function)
GRANT EXECUTE ON FUNCTION public.move_client_tracking_day(uuid, uuid, text) TO authenticated;
