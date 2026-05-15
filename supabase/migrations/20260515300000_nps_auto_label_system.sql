-- 20260515300000_nps_auto_label_system.sql
--
-- WHY: The NPS public-link flow requires creating a row BEFORE the client
-- answers (nps_score NULL), then filling it via a public RPC. The original
-- schema had nps_score NOT NULL, blocking this flow. This migration:
--
--   1. Makes nps_score and collected_by nullable (public submissions have no auth user)
--   2. Extracts label-mapping logic into a private helper (_nps_map_label)
--   3. Replaces the existing trigger to also set cs_classification on detractors
--   4. Creates submit_public_nps() for anon-callable public link submissions
--   5. Creates nps_auto_update_label() for authenticated internal NPS registration
--

BEGIN;

-- =============================================================================
-- 1. SCHEMA CHANGES: allow NULL nps_score and collected_by
-- =============================================================================

-- Drop the existing CHECK so we can re-add one that allows NULL
ALTER TABLE public.client_nps_responses
  DROP CONSTRAINT IF EXISTS client_nps_responses_nps_score_check;

-- Allow NULL (row created before client answers)
ALTER TABLE public.client_nps_responses
  ALTER COLUMN nps_score DROP NOT NULL;

-- Re-add CHECK: when score IS provided, must be 0..10
ALTER TABLE public.client_nps_responses
  ADD CONSTRAINT client_nps_responses_nps_score_check
  CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10));

-- collected_by nullable (public submissions have no authenticated user)
ALTER TABLE public.client_nps_responses
  ALTER COLUMN collected_by DROP NOT NULL;


-- =============================================================================
-- 2. HELPER: _nps_map_label (private, not exposed as RPC)
-- =============================================================================

CREATE OR REPLACE FUNCTION public._nps_map_label(p_score integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score >= 9 THEN 'otimo'
    WHEN p_score >= 7 THEN 'bom'
    WHEN p_score >= 5 THEN 'medio'
    ELSE 'ruim'
  END
$$;

COMMENT ON FUNCTION public._nps_map_label(integer) IS
  'Private helper: maps NPS score (0-10) to client_label value. Not intended as RPC.';

-- Lock down: only callable by owner (postgres) and service_role. RPCs use
-- SECURITY DEFINER so they run as owner — no external grant needed.
REVOKE ALL ON FUNCTION public._nps_map_label(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._nps_map_label(integer) FROM anon;
REVOKE ALL ON FUNCTION public._nps_map_label(integer) FROM authenticated;


-- =============================================================================
-- 3. TRIGGER: replace existing with enhanced version (+ cs_classification)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_client_label_from_nps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  -- Only act when nps_score is set (skip rows created without score)
  IF NEW.nps_score IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only act if score actually changed
  IF TG_OP = 'UPDATE' AND NEW.nps_score IS NOT DISTINCT FROM OLD.nps_score THEN
    RETURN NEW;
  END IF;

  v_label := public._nps_map_label(NEW.nps_score);

  UPDATE public.clients
  SET client_label = v_label
  WHERE id = NEW.client_id;

  -- Detractors (0-6) get cs_classification = 'alerta'
  IF NEW.nps_score <= 6 THEN
    UPDATE public.clients
    SET cs_classification = 'alerta',
        cs_classification_reason = format('NPS Detrator: nota %s', NEW.nps_score)
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END
$$;

-- Trigger already exists from previous migration; DROP + re-CREATE to be safe
DROP TRIGGER IF EXISTS trg_update_client_label_nps ON public.client_nps_responses;

CREATE TRIGGER trg_update_client_label_nps
  AFTER INSERT OR UPDATE ON public.client_nps_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_label_from_nps();


-- =============================================================================
-- 4. RPC: submit_public_nps (anon-callable)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_public_nps(
  p_token text,
  p_score integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.client_nps_responses%ROWTYPE;
  v_label text;
  v_classification text;
BEGIN
  -- Validate score range
  IF p_score IS NULL OR p_score < 0 OR p_score > 10 THEN
    RAISE EXCEPTION 'score must be between 0 and 10'
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

  -- Find the NPS row by token
  SELECT * INTO v_row
  FROM public.client_nps_responses
  WHERE public_token = p_token;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'invalid or expired token'
      USING ERRCODE = 'P0002'; -- no_data_found
  END IF;

  -- Prevent double submission
  IF v_row.nps_score IS NOT NULL THEN
    RAISE EXCEPTION 'NPS already submitted for this token'
      USING ERRCODE = '23505'; -- unique_violation (semantically: already done)
  END IF;

  -- Update the NPS response (trigger handles client_label + cs_classification)
  UPDATE public.client_nps_responses
  SET nps_score = p_score,
      score_reason = p_reason,
      collected_at = now()
  WHERE id = v_row.id;

  -- Determine classification for response
  v_label := public._nps_map_label(p_score);

  IF p_score >= 9 THEN
    v_classification := 'promotor';
  ELSIF p_score >= 7 THEN
    v_classification := 'neutro';
  ELSE
    v_classification := 'detrator';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'classification', v_classification
  );
END
$$;

REVOKE ALL ON FUNCTION public.submit_public_nps(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_nps(text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_nps(text, integer, text) TO authenticated;

COMMENT ON FUNCTION public.submit_public_nps(text, integer, text) IS
  'Public NPS submission via token. Anon-callable. Sets client_label and cs_classification via trigger.';


-- =============================================================================
-- 5. RPC: nps_auto_update_label (authenticated, internal use)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.nps_auto_update_label(
  p_client_id uuid,
  p_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_label text;
BEGIN
  -- Auth check
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '28000';
  END IF;

  -- Role check: CEO or GP/Ads/CS
  IF NOT (
    public.is_ceo(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
    OR public.has_role(v_caller, 'gestor_ads'::user_role)
    OR public.has_role(v_caller, 'sucesso_cliente'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  -- Validate score
  IF p_score IS NULL OR p_score < 0 OR p_score > 10 THEN
    RAISE EXCEPTION 'score must be between 0 and 10'
      USING ERRCODE = '22023';
  END IF;

  -- Map and update label
  v_label := public._nps_map_label(p_score);

  UPDATE public.clients
  SET client_label = v_label
  WHERE id = p_client_id;

  -- Detractors get alerta
  IF p_score <= 6 THEN
    UPDATE public.clients
    SET cs_classification = 'alerta',
        cs_classification_reason = format('NPS Detrator: nota %s', p_score)
    WHERE id = p_client_id;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.nps_auto_update_label(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nps_auto_update_label(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.nps_auto_update_label(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.nps_auto_update_label(uuid, integer) IS
  'Internal NPS label update. Called when GP registers NPS directly (not via public link).';


COMMIT;
