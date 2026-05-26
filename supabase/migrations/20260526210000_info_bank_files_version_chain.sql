-- 20260526210000_info_bank_files_version_chain.sql
--
-- Evolve upload_info_bank_file RPC to support version chains.
-- When uploading a file with the same (client_id, section, file_name),
-- the old row gets replaced_by = new.id and new.version = old.version + 1.
-- Uses SELECT ... FOR UPDATE to prevent race conditions.

BEGIN;

CREATE OR REPLACE FUNCTION public.upload_info_bank_file(
  p_client_id    uuid,
  p_section      public.info_bank_file_section,
  p_file_name    text,
  p_file_path    text,
  p_file_size    bigint,
  p_content_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_info_bank_id uuid;
  v_old_id       uuid;
  v_old_version  int;
  v_new_version  int;
  v_id           uuid;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- Resolve info_bank_id from client
  SELECT id INTO v_info_bank_id
    FROM public.client_info_bank
   WHERE client_id = p_client_id;

  IF v_info_bank_id IS NULL THEN
    RAISE EXCEPTION 'client_info_bank not found for client' USING ERRCODE = 'P0001';
  END IF;

  -- Lock current version row (if any) to prevent race conditions
  SELECT id, version
    INTO v_old_id, v_old_version
    FROM public.client_info_bank_files
   WHERE client_id = p_client_id
     AND section   = p_section
     AND file_name = p_file_name
     AND replaced_by IS NULL
   FOR UPDATE;

  -- Determine version number
  IF v_old_id IS NOT NULL THEN
    v_new_version := v_old_version + 1;
  ELSE
    v_new_version := 1;
  END IF;

  -- Insert new metadata row
  INSERT INTO public.client_info_bank_files (
    info_bank_id, client_id, section,
    file_name, file_path, file_size, content_type,
    uploaded_by, version
  ) VALUES (
    v_info_bank_id, p_client_id, p_section,
    p_file_name, p_file_path, p_file_size, p_content_type,
    v_caller, v_new_version
  )
  RETURNING id INTO v_id;

  -- Link old version to new
  IF v_old_id IS NOT NULL THEN
    UPDATE public.client_info_bank_files
       SET replaced_by = v_id
     WHERE id = v_old_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMIT;
