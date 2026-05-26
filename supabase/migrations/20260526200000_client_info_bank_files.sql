-- 20260526200000_client_info_bank_files.sql
--
-- File attachments for the unified client info bank.
-- Private bucket + metadata table with enum-based sections.
-- Versioning columns present (replaced_by, version) but not enforced
-- in this slice — version chains come in a future slice.

BEGIN;

-- ============================================================================
-- Enum: file sections
-- ============================================================================
CREATE TYPE public.info_bank_file_section AS ENUM ('anuncios', 'criativos', 'marca', 'videos');

-- ============================================================================
-- Table
-- ============================================================================
CREATE TABLE public.client_info_bank_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  info_bank_id  uuid NOT NULL REFERENCES public.client_info_bank(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  section       public.info_bank_file_section NOT NULL,
  file_name     text NOT NULL,
  file_path     text NOT NULL,
  file_size     bigint NOT NULL,
  content_type  text NOT NULL,
  uploaded_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  version       int NOT NULL DEFAULT 1,
  replaced_by   uuid REFERENCES public.client_info_bank_files(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cib_files_info_bank
  ON public.client_info_bank_files(info_bank_id);

CREATE INDEX idx_cib_files_client_section
  ON public.client_info_bank_files(client_id, section);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.client_info_bank_files ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user
CREATE POLICY "select_cib_files_authenticated"
  ON public.client_info_bank_files
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: authenticated, uploaded_by must match caller
CREATE POLICY "insert_cib_files_authenticated"
  ON public.client_info_bank_files
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- DELETE: admin only
CREATE POLICY "delete_cib_files_admin"
  ON public.client_info_bank_files
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- RPC: upload_info_bank_file
-- ============================================================================
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

  -- Insert metadata
  INSERT INTO public.client_info_bank_files (
    info_bank_id, client_id, section,
    file_name, file_path, file_size, content_type,
    uploaded_by
  ) VALUES (
    v_info_bank_id, p_client_id, p_section,
    p_file_name, p_file_path, p_file_size, p_content_type,
    v_caller
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upload_info_bank_file(uuid, public.info_bank_file_section, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upload_info_bank_file(uuid, public.info_bank_file_section, text, text, bigint, text) TO authenticated;

-- ============================================================================
-- Storage bucket (PRIVATE — requires signed URLs for reads)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-info-bank-files', 'client-info-bank-files', false, 524288000)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "cib_files_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-info-bank-files');

CREATE POLICY "cib_files_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-info-bank-files');

CREATE POLICY "cib_files_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-info-bank-files'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

COMMIT;
