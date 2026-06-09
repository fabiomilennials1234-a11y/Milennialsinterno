-- 20260608140000_concessao_conceder_produto_rpc.sql
--
-- Slice #147 (Concessão) — ADR 0009. Tracer bullet central: a PRIMEIRA concessão
-- ponta-a-ponta. RPC tipada do módulo financeiro = ÚNICA porta de escrita da
-- entidade concessoes (ADR 0004, contract-only; o grant direto de INSERT já foi
-- revogado em 20260608130000_concessao_schema.sql).
--
-- O QUE FAZ public.conceder_produto(p_client_id, p_product_slug, p_motivo,
--   p_contract_expires_at?) -> uuid : concede um produto a um cliente SEM
--   contrapartida financeira (retenção de cliente em risco). INSERE uma concessão
--   `ativa` e ENTREGA o produto de verdade reusando public._entregar_produto
--   (#145): card de board, contracted_products, linha financeiro com
--   monthly_value = 0. NÃO gera upsell_commissions, NÃO gera mrr_changes — a
--   supressão de dinheiro é ESTRUTURAL: esta função simplesmente NUNCA insere em
--   upsells (cujo trigger process_upsell é o único produtor de comissão/MRR).
--   Concessão entrega; venda (upsell) cobra. ADR 0009 §1.
--
-- AUTORIZAÇÃO (ADR 0009 §3) — quem concede: admin (global) OU sucesso_cliente
--   (só na PRÓPRIA carteira). Predicado dedicado public._concessao_pode_conceder.
--   NÃO reusa cliente.pode_ver_cliente: aquele é audiência de LEITURA (quem VÊ o
--   cliente), conceder é AUTORIA (quem PODE escrever a concessão) — escopos
--   distintos. CS escopado por clients.assigned_sucesso_cliente (uuid; NÃO usar
--   assigned_mktplace, que é text e é outra coisa).
--
-- ATOMICIDADE / ANTI-ÓRFÃO (padrão torque_board_gerar / _entregar_produto): todos
--   os guards (autorização, existência do cliente, conflito) RAISE ANTES de
--   qualquer escrita. Como tudo roda na transação implícita da função, um RAISE em
--   qualquer ponto = ZERO efeito parcial (nem concessão, nem entrega).
--
-- CONFLITO BLOQUEIA, não é idempotente (ADR 0009; conceder de novo o que já está
--   contratado/concedido é erro de operação, não no-op): produto já em
--   contracted_products -> P0001; concessão (client_id, slug) já `ativa` -> P0001.
--
-- HARDENING (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + identificadores
--   schema-qualified. Grants mínimos (espelha torque_board_gerar): só authenticated
--   executa a RPC pública; o predicado interno é REVOKE total (nem authenticated).
--
-- QUIRK: clients.assigned_sucesso_cliente é uuid (comparável direto a auth.uid()).

BEGIN;

-- =============================================================================
-- Predicado de autorização dedicado da CONCESSÃO (ADR 0009 §3, emenda 3).
--   admin global (sem escopo de carteira) OU sucesso_cliente DONO da carteira
--   do cliente (clients.assigned_sucesso_cliente = caller).
-- Helper INTERNO: chamado só pela RPC (SECURITY DEFINER, owner). REVOKE total —
-- nenhum cliente REST/RPC o invoca diretamente.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._concessao_pode_conceder(p_client_id uuid, p_caller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.is_admin(p_caller)
      OR (
        public.has_role(p_caller, 'sucesso_cliente'::public.user_role)
        AND EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = p_client_id
            AND c.assigned_sucesso_cliente = p_caller
        )
      );
$$;

COMMENT ON FUNCTION public._concessao_pode_conceder(uuid, uuid) IS
  'Predicado de AUTORIA da Concessão (ADR 0009 §3): admin global OU sucesso_cliente '
  'DONO da carteira do cliente (clients.assigned_sucesso_cliente = caller). NÃO é '
  'audiência de leitura (cliente.pode_ver_cliente) — conceder é escrever, não ver. '
  'Helper INTERNO: REVOKE total, só a RPC conceder_produto o chama.';

-- =============================================================================
-- conceder_produto — contrato de escrita da Concessão (única porta, ADR 0004).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.conceder_produto(
  p_client_id          uuid,
  p_product_slug       text,
  p_motivo             public.concessao_motivo,
  p_contract_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_caller_name  text;
  v_product_name text;
  v_id           uuid;
BEGIN
  -- 1. Autorização (ADR 0009 §3). SECURITY DEFINER bypassa RLS -> re-checar aqui.
  IF NOT public._concessao_pode_conceder(p_client_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode conceder produto a este cliente'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Anti-órfão: o cliente precisa existir (contract-only, sem FK — ADR 0004).
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id) THEN
    RAISE EXCEPTION 'cliente % não existe (referência órfã barrada)', p_client_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Nome do ator (mesma fonte dos outros contratos do módulo: profiles.name).
  SELECT pr.name INTO v_caller_name
  FROM public.profiles pr
  WHERE pr.user_id = v_caller;

  -- 4. Nome do produto resolvido SERVER-SIDE (emenda 1): board.name por slug, com
  --    fallback no próprio slug. Nunca grava NULL; não duplica o mapa de produtos
  --    do TS no DB.
  v_product_name := COALESCE(
    (SELECT b.name FROM public.kanban_boards b WHERE b.slug = p_product_slug LIMIT 1),
    p_product_slug
  );

  -- 5. Conflito: produto já contratado -> BLOQUEIA (concessão não duplica entrega).
  IF EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = p_client_id
      AND p_product_slug = ANY(COALESCE(c.contracted_products, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'produto % já está contratado pelo cliente % (concessão não duplica)',
      p_product_slug, p_client_id USING ERRCODE = 'P0001';
  END IF;

  -- 6. Conflito: já existe concessão ATIVA do mesmo slug -> BLOQUEIA.
  IF EXISTS (
    SELECT 1 FROM public.concessoes co
    WHERE co.client_id = p_client_id
      AND co.product_slug = p_product_slug
      AND co.status = 'ativa'::public.concessao_status
  ) THEN
    RAISE EXCEPTION 'já existe concessão ativa de % para o cliente %',
      p_product_slug, p_client_id USING ERRCODE = 'P0001';
  END IF;

  -- 7. INSERE a concessão `ativa` (monthly_value = 0: não infla MRR; ADR 0009 §1).
  INSERT INTO public.concessoes (
    client_id, product_slug, product_name, monthly_value, motivo, status,
    granted_by, granted_by_name, contract_expires_at
  ) VALUES (
    p_client_id, p_product_slug, v_product_name, 0, p_motivo, 'ativa'::public.concessao_status,
    v_caller, v_caller_name, p_contract_expires_at
  )
  RETURNING id INTO v_id;

  -- 8. ENTREGA real (reusa o pipeline fatorado do upsell, #145), monthly_value = 0.
  --    Card de board, contracted_products, linha financeiro 0. SEM dinheiro:
  --    _entregar_produto NÃO toca upsell_commissions nem mrr_changes (entrega ≠
  --    venda). A supressão é estrutural — nunca passamos por upsells/process_upsell.
  PERFORM public._entregar_produto(
    p_client_id, p_product_slug, v_product_name, 0::numeric, v_caller
  );

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.conceder_produto(uuid, text, public.concessao_motivo, timestamptz) IS
  'Contrato de escrita da Concessão (ADR 0009, Slice #147): concede um produto a um '
  'cliente SEM contrapartida financeira. Insere concessão `ativa` (monthly_value=0) e '
  'ENTREGA via _entregar_produto (#145: card de board, contracted_products, linha '
  'financeiro 0). NÃO gera upsell_commissions nem mrr_changes — supressão ESTRUTURAL '
  '(nunca insere em upsells). Autoriza por _concessao_pode_conceder (admin OU CS dono '
  'da carteira, ADR 0009 §3). Atômico: guards (autorização/anti-órfão/conflito) RAISE '
  'antes de qualquer escrita. Conflito BLOQUEIA (P0001): produto já contratado ou '
  'concessão ativa duplicada. product_name resolvido server-side (board.name|slug). '
  'Única porta de escrita de concessoes (ADR 0004). Retorna o id da concessão criada.';

-- =============================================================================
-- Grants (espelha torque_board_gerar).
--   RPC pública: só authenticated executa (autorização re-checada DENTRO).
--   Predicado interno: REVOKE total — nem authenticated o invoca direto.
-- =============================================================================
REVOKE ALL ON FUNCTION public._concessao_pode_conceder(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conceder_produto(uuid, text, public.concessao_motivo, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conceder_produto(uuid, text, public.concessao_motivo, timestamptz) TO authenticated;

COMMIT;
