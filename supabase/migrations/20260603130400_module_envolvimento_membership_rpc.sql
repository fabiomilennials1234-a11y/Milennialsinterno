-- 20260603130400_module_envolvimento_membership_rpc.sql
-- Slice 2 (#78) — Contrato de membership do módulo cliente (ADR 0005 §5, ADR 0004).
-- A ÚNICA forma de escrever em cliente.client_members (escrita direta revogada).
--
-- Autorização (dentro da função, helper canônico — sem literal de role):
--   is_admin(caller) OR e_envolvido(client, caller)
-- Quem já atende o cliente (ou admin) pode montar/ajustar a equipe; ninguém mais.
--
-- Anti-órfão (ADR 0004): valida cliente.existe(client) atomicamente -> RAISE.
--
-- Compat de transição: para papéis que têm coluna assigned_* 1:1, a RPC também
-- reflete de volta no legado (single-assignment) para o código antigo não
-- regredir. secondary_manager NÃO tem coluna (vive em client_secondary_managers);
-- a RPC nesta slice cobre client_members + reflexo nos assigned_* escalares.

-- =============================================================================
-- adicionar_membro
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.adicionar_membro(
  p_client_id uuid, p_user_id uuid, p_papel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Autorização: admin OU já-envolvido. Helper canônico (guard-safe).
  IF NOT (public.is_admin(v_caller) OR cliente.e_envolvido(p_client_id, v_caller)) THEN
    RAISE EXCEPTION 'permission denied: caller não é admin nem envolvido no cliente'
      USING ERRCODE = '42501';
  END IF;

  -- Anti-órfão: o cliente precisa existir (validação atômica, ADR 0004).
  IF NOT cliente.existe(p_client_id) THEN
    RAISE EXCEPTION 'cliente % não existe (referência órfã barrada)', p_client_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_papel IS NULL OR p_papel = '' THEN
    RAISE EXCEPTION 'papel_no_cliente obrigatório' USING ERRCODE = 'P0001';
  END IF;

  -- Fonte única (idempotente).
  INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
  VALUES (p_client_id, p_user_id, p_papel)
  ON CONFLICT (client_id, user_id, papel_no_cliente) DO NOTHING;

  -- Compat de transição: reflete nos assigned_* escalares (single-assignment).
  -- O trigger espelho normalmente cobriria, mas escrevemos aqui para que a RPC
  -- seja a fonte preferida e o legado fique consistente imediatamente.
  UPDATE public.clients SET assigned_ads_manager      = p_user_id WHERE id = p_client_id AND p_papel = 'ads_manager';
  UPDATE public.clients SET assigned_comercial        = p_user_id WHERE id = p_client_id AND p_papel = 'comercial';
  UPDATE public.clients SET assigned_crm              = p_user_id WHERE id = p_client_id AND p_papel = 'crm';
  UPDATE public.clients SET assigned_rh               = p_user_id WHERE id = p_client_id AND p_papel = 'rh';
  UPDATE public.clients SET assigned_outbound_manager = p_user_id WHERE id = p_client_id AND p_papel = 'outbound_manager';
  UPDATE public.clients SET assigned_sucesso_cliente  = p_user_id WHERE id = p_client_id AND p_papel = 'sucesso_cliente';
  UPDATE public.clients SET assigned_mktplace         = p_user_id::text WHERE id = p_client_id AND p_papel = 'mktplace';
END;
$$;

COMMENT ON FUNCTION cliente.adicionar_membro(uuid,uuid,text) IS
  'Contrato de membership: adiciona Envolvido (ADR 0005). Autoriza admin OU '
  'envolvido; valida existência do cliente (anti-órfão); idempotente; reflete '
  'no assigned_* legado (transição). Único caminho de escrita em client_members.';

-- =============================================================================
-- remover_membro
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.remover_membro(
  p_client_id uuid, p_user_id uuid, p_papel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF NOT (public.is_admin(v_caller) OR cliente.e_envolvido(p_client_id, v_caller)) THEN
    RAISE EXCEPTION 'permission denied: caller não é admin nem envolvido no cliente'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM cliente.client_members
   WHERE client_id = p_client_id AND user_id = p_user_id AND papel_no_cliente = p_papel;

  -- Compat: limpa o assigned_* escalar se apontava para esse user.
  UPDATE public.clients SET assigned_ads_manager      = NULL WHERE id=p_client_id AND p_papel='ads_manager'      AND assigned_ads_manager      = p_user_id;
  UPDATE public.clients SET assigned_comercial        = NULL WHERE id=p_client_id AND p_papel='comercial'        AND assigned_comercial        = p_user_id;
  UPDATE public.clients SET assigned_crm              = NULL WHERE id=p_client_id AND p_papel='crm'              AND assigned_crm              = p_user_id;
  UPDATE public.clients SET assigned_rh               = NULL WHERE id=p_client_id AND p_papel='rh'               AND assigned_rh               = p_user_id;
  UPDATE public.clients SET assigned_outbound_manager = NULL WHERE id=p_client_id AND p_papel='outbound_manager' AND assigned_outbound_manager = p_user_id;
  UPDATE public.clients SET assigned_sucesso_cliente  = NULL WHERE id=p_client_id AND p_papel='sucesso_cliente'  AND assigned_sucesso_cliente  = p_user_id;
  UPDATE public.clients SET assigned_mktplace         = NULL WHERE id=p_client_id AND p_papel='mktplace'         AND assigned_mktplace         = p_user_id::text;
END;
$$;

COMMENT ON FUNCTION cliente.remover_membro(uuid,uuid,text) IS
  'Contrato de membership: remove Envolvido (ADR 0005). Autoriza admin OU '
  'envolvido. Limpa o assigned_* legado correspondente (transição).';

-- =============================================================================
-- membros(client) — leitura: lista os Envolvidos de um cliente.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.membros(p_client_id uuid)
RETURNS TABLE (user_id uuid, papel_no_cliente text, entrou_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.user_id, m.papel_no_cliente, m.entrou_em
  FROM cliente.client_members m
  WHERE m.client_id = p_client_id
    -- Visibilidade: só admin ou envolvido lê a equipe.
    AND (public.is_admin(auth.uid()) OR cliente.e_envolvido(p_client_id, auth.uid()))
  ORDER BY m.entrou_em;
$$;

COMMENT ON FUNCTION cliente.membros(uuid) IS
  'Contrato: lista Envolvidos do cliente (admin/envolvido apenas).';

-- =============================================================================
-- clientes_de(user) — leitura: clientes em que um usuário é Envolvido.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.clientes_de(p_user_id uuid)
RETURNS TABLE (client_id uuid, papel_no_cliente text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.client_id, m.papel_no_cliente
  FROM cliente.client_members m
  WHERE m.user_id = p_user_id
    -- Self ou admin (não exponha a carteira alheia a qualquer um).
    AND (auth.uid() = p_user_id OR public.is_admin(auth.uid()))
  ORDER BY m.client_id;
$$;

COMMENT ON FUNCTION cliente.clientes_de(uuid) IS
  'Contrato: clientes onde o usuário é Envolvido (self/admin apenas).';

-- Grants — só authenticated chama o contrato.
REVOKE ALL ON FUNCTION cliente.adicionar_membro(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cliente.remover_membro(uuid,uuid,text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION cliente.membros(uuid)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION cliente.clientes_de(uuid)               FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.adicionar_membro(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cliente.remover_membro(uuid,uuid,text)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cliente.membros(uuid)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cliente.clientes_de(uuid)               TO authenticated, service_role;
