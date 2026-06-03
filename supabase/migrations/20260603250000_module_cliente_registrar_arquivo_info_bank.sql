-- 20260603250000_module_cliente_registrar_arquivo_info_bank.sql
-- #43 — Fechar a ESCRITA (e a LEITURA) de arquivos do Banco de Info do cliente.
-- ADR 0004 (contrato-only) + ADR 0005 (pode_ver_cliente como dono único da audiência).
--
-- Contexto / furo (estado pré-fix, verificado no remoto):
--   * public.client_info_bank_files: grants INSERT/UPDATE/DELETE diretos em
--     `authenticated`; policy insert_cib_files_authenticated WITH CHECK só
--     (uploaded_by = auth.uid()) — SEM gate de cliente. Qualquer authenticated
--     grava metadado de arquivo para QUALQUER cliente.
--   * RPC public.upload_info_bank_file: valida só auth + existência do info_bank;
--     NÃO valida pode_ver_cliente.
--   * SELECT da tabela = USING(true) — qualquer authenticated LÊ metadado de
--     qualquer cliente (furo de confidencialidade/LGPD — leitura, não só escrita).
--   * Storage bucket client-info-bank-files: policy cib_files_insert
--     WITH CHECK(bucket_id=...) — qualquer authenticated faz PUT em qualquer
--     path/cliente. SELECT idem (USING bucket_id) — leitura aberta.
--
-- Fix (espelha #79 editar_card_universal — um único dono com o MESMO gate):
--   1. cliente.registrar_arquivo_info_bank(...) — contrato SECURITY DEFINER,
--      search_path='', valida cliente.pode_ver_cliente (42501) + cliente.existe
--      (P0002) ANTES de inserir metadado. Mantém a cadeia de versão (replaced_by /
--      version) com SELECT ... FOR UPDATE (idêntico ao legado).
--   2. public.upload_info_bank_file (6 args, assinatura INALTERADA — a UI legada
--      useClientInfoBankFiles.ts não muda) passa a DELEGAR ao contrato do kernel.
--      Idem delete_info_bank_file: ganha o gate pode_ver_cliente (defesa em
--      profundidade — owner/admin já restringia, mas owner de OUTRO cliente que
--      perdeu visibilidade não deve mexer).
--   3. REVOKE INSERT/UPDATE/DELETE diretos de authenticated em
--      client_info_bank_files + DROP da policy WITH CHECK frouxa. Toda escrita
--      passa obrigatoriamente pela RPC (owner-bypass SECURITY DEFINER).
--   4. SELECT da tabela reorientado para USING(cliente.pode_ver_cliente(...)) —
--      fecha a leitura de metadado. UI legada (que filtra por client_id) continua
--      funcionando: RLS é transparente, só esconde linhas de clientes invisíveis.
--   5. Storage: aperta cib_files_insert / cib_files_select / cib_files_delete para
--      exigir vínculo ao cliente do path (foldername[1] = client_id) E
--      cliente.pode_ver_cliente. UPDATE de objeto idem (defensivo, mesmo que o
--      fluxo não faça PUT-overwrite — TUS/standard usam path novo por uuid).
--
-- Idempotente: CREATE OR REPLACE, DROP POLICY IF EXISTS, REVOKE (no-op se já
-- revogado), CREATE POLICY após DROP. Reexecutável sem efeito colateral.
-- Sem literal de role (só helpers canônicos) → guard no_literal_role_in_policy verde.

-- =============================================================================
-- 1) cliente.registrar_arquivo_info_bank — contrato de ESCRITA de metadado.
--    Gate: pode_ver_cliente (42501) + existe (P0002). Cadeia de versão preservada.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.registrar_arquivo_info_bank(
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
SET search_path = ''
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_info_bank_id uuid;
  v_old_id       uuid;
  v_old_version  int;
  v_new_version  int;
  v_id           uuid;
BEGIN
  -- Auth guard (28000 = invalid_authorization_specification).
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- Gate de autorização: só quem PODE VER o cliente registra arquivo do cliente
  -- (mesmo predicado da leitura/escrita do card — ADR 0005). 42501 = insufficient_privilege.
  IF NOT cliente.pode_ver_cliente(p_client_id, v_caller) THEN
    RAISE EXCEPTION 'sem permissão para registrar arquivo deste cliente'
      USING ERRCODE = '42501';
  END IF;

  -- Gate de existência (anti-órfão, ADR 0004): o cliente precisa existir.
  IF NOT cliente.existe(p_client_id) THEN
    RAISE EXCEPTION 'cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Resolve o info_bank do cliente. Mantém o contrato legado: P0001 se não houver
  -- registro de info_bank (o banco precisa existir para anexar arquivos).
  SELECT id INTO v_info_bank_id
    FROM public.client_info_bank
   WHERE client_id = p_client_id;

  IF v_info_bank_id IS NULL THEN
    RAISE EXCEPTION 'client_info_bank not found for client' USING ERRCODE = 'P0001';
  END IF;

  -- Cadeia de versão: trava a versão corrente (mesmo nome/seção/cliente) para
  -- evitar corrida; nova versão = antiga + 1. Idêntico ao legado.
  SELECT id, version
    INTO v_old_id, v_old_version
    FROM public.client_info_bank_files
   WHERE client_id = p_client_id
     AND section   = p_section
     AND file_name = p_file_name
     AND replaced_by IS NULL
   FOR UPDATE;

  IF v_old_id IS NOT NULL THEN
    v_new_version := v_old_version + 1;
  ELSE
    v_new_version := 1;
  END IF;

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

  IF v_old_id IS NOT NULL THEN
    UPDATE public.client_info_bank_files
       SET replaced_by = v_id
     WHERE id = v_old_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION cliente.registrar_arquivo_info_bank(uuid, public.info_bank_file_section, text, text, bigint, text) IS
  'Contrato (#43): ÚNICO dono da escrita de metadado de arquivo do Banco de Info. '
  'Gate de audiência = cliente.pode_ver_cliente (42501) + cliente.existe (P0002), '
  'igual ao card (ADR 0005). Mantém cadeia de versão (replaced_by/version). '
  'public.upload_info_bank_file delega a esta função.';

REVOKE ALL ON FUNCTION cliente.registrar_arquivo_info_bank(uuid, public.info_bank_file_section, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.registrar_arquivo_info_bank(uuid, public.info_bank_file_section, text, text, bigint, text) TO authenticated, service_role;

-- =============================================================================
-- 2) public.upload_info_bank_file (6 args, assinatura INALTERADA) → DELEGA.
--    A UI legada (useClientInfoBankFiles.ts) chama exatamente esta RPC; o gate
--    agora vive num só lugar (cliente.registrar_arquivo_info_bank).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upload_info_bank_file(
  p_client_id    uuid,
  p_section      public.info_bank_file_section,
  p_file_name    text,
  p_file_path    text,
  p_file_size    bigint,
  p_content_type text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cliente.registrar_arquivo_info_bank(
    p_client_id, p_section, p_file_name, p_file_path, p_file_size, p_content_type
  );
$$;

COMMENT ON FUNCTION public.upload_info_bank_file(uuid, public.info_bank_file_section, text, text, bigint, text) IS
  'LEGADO (assinatura preservada): delega a cliente.registrar_arquivo_info_bank. '
  'O gate de autorização (pode_ver_cliente) + existência vive no kernel. Novos '
  'chamadores usam o módulo cliente diretamente.';

REVOKE ALL ON FUNCTION public.upload_info_bank_file(uuid, public.info_bank_file_section, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upload_info_bank_file(uuid, public.info_bank_file_section, text, text, bigint, text) TO authenticated, service_role;

-- =============================================================================
-- 2b) public.delete_info_bank_file — defesa em profundidade: além de owner/admin,
--     exige pode_ver_cliente do cliente DONO do arquivo. Assinatura INALTERADA.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_info_bank_file(
  p_file_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_file_path text;
  v_owner     uuid;
  v_client_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT file_path, uploaded_by, client_id
    INTO v_file_path, v_owner, v_client_id
    FROM public.client_info_bank_files
   WHERE id = p_file_id;

  IF v_file_path IS NULL THEN
    RAISE EXCEPTION 'file not found' USING ERRCODE = 'P0001';
  END IF;

  -- Autorização: precisa PODER VER o cliente (audiência ADR 0005) E ser owner ou admin.
  IF NOT cliente.pode_ver_cliente(v_client_id, v_caller) THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;

  IF v_owner <> v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.client_info_bank_files WHERE id = p_file_id;

  RETURN v_file_path;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_info_bank_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_info_bank_file(uuid) TO authenticated, service_role;

-- =============================================================================
-- 3) Fecha a ESCRITA DIRETA da tabela de metadados.
--    REVOKE grants de escrita + DROP da policy INSERT frouxa. Toda escrita passa
--    pela RPC (owner-bypass SECURITY DEFINER).
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.client_info_bank_files FROM authenticated;

DROP POLICY IF EXISTS "insert_cib_files_authenticated" ON public.client_info_bank_files;
-- A policy de DELETE (owner_or_admin) torna-se inerte sem o grant DELETE; o
-- caminho de delete passa pela RPC. Removemos para não deixar policy órfã/enganosa.
DROP POLICY IF EXISTS "delete_cib_files_owner_or_admin" ON public.client_info_bank_files;
DROP POLICY IF EXISTS "delete_cib_files_admin" ON public.client_info_bank_files;

-- =============================================================================
-- 4) Fecha a LEITURA de metadado: SELECT gateado por pode_ver_cliente.
--    (O brief supôs leitura já gateada; o remoto mostrava USING(true). Fechamos.)
-- =============================================================================
DROP POLICY IF EXISTS "select_cib_files_authenticated" ON public.client_info_bank_files;
DROP POLICY IF EXISTS "select_cib_files_visible" ON public.client_info_bank_files;
CREATE POLICY "select_cib_files_visible"
  ON public.client_info_bank_files
  FOR SELECT
  TO authenticated
  USING (cliente.pode_ver_cliente(client_id, auth.uid()));

-- =============================================================================
-- 5) Storage — aperta as policies do bucket client-info-bank-files.
--    Path convention (useClientInfoBankFiles.ts): {client_id}/{section}/{uuid}.{ext}
--    => storage.foldername(name))[1] = client_id. Exige vínculo + pode_ver_cliente.
--    INSERT/UPDATE/SELECT/DELETE: o caller precisa poder ver o cliente do path.
--    A posse FINA do arquivo (owner OU admin) é validada na RPC
--    public.delete_info_bank_file ANTES do supabase.storage.remove() do front;
--    no nível storage o gate honesto é a AUDIÊNCIA (pode_ver_cliente) — o path é
--    {client_id}/..., não {user_id}/..., então não há identidade de owner no path.
-- =============================================================================
DROP POLICY IF EXISTS "cib_files_insert" ON storage.objects;
CREATE POLICY "cib_files_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-info-bank-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND cliente.pode_ver_cliente(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "cib_files_update" ON storage.objects;
CREATE POLICY "cib_files_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-info-bank-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND cliente.pode_ver_cliente(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'client-info-bank-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND cliente.pode_ver_cliente(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "cib_files_select" ON storage.objects;
CREATE POLICY "cib_files_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-info-bank-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND cliente.pode_ver_cliente(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "cib_files_delete" ON storage.objects;
CREATE POLICY "cib_files_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-info-bank-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND cliente.pode_ver_cliente(((storage.foldername(name))[1])::uuid, auth.uid())
  );
