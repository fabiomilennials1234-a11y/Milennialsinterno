-- 20260526300000_delete_info_bank_file.sql
--
-- Adds RPC delete_info_bank_file with ownership check.
-- Updates DELETE RLS policy to allow owner OR admin.
-- Part of Issue #45 — Download + delete for Banco de Info Arquivos.

BEGIN;

-- ============================================================================
-- RPC: delete_info_bank_file
-- ============================================================================
-- Returns file_path so the frontend can remove the blob from Storage.
-- SECURITY DEFINER: bypasses RLS to do the ownership check internally.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_info_bank_file(
  p_file_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_file_path text;
  v_owner     uuid;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- Fetch file metadata
  SELECT file_path, uploaded_by
    INTO v_file_path, v_owner
    FROM public.client_info_bank_files
   WHERE id = p_file_id;

  IF v_file_path IS NULL THEN
    RAISE EXCEPTION 'file not found' USING ERRCODE = 'P0001';
  END IF;

  -- Authorization: owner or admin
  IF v_owner <> v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;

  -- Delete metadata row
  DELETE FROM public.client_info_bank_files WHERE id = p_file_id;

  RETURN v_file_path;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_info_bank_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_info_bank_file(uuid) TO authenticated;

-- ============================================================================
-- Update DELETE RLS policy: owner OR admin (was admin-only)
-- ============================================================================
DROP POLICY IF EXISTS "delete_cib_files_admin" ON public.client_info_bank_files;

CREATE POLICY "delete_cib_files_owner_or_admin"
  ON public.client_info_bank_files
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));

COMMIT;
