-- 20260603150200_module_demanda_rpc.sql
-- Slice 4 (#80) — Contrato (interface pública) do módulo `demanda`. ADR 0004 + 0005.
-- A ÚNICA forma de escrever em demanda.demandas / de setar kanban_cards.demanda_id.
--
-- Hardening (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + identificadores
-- schema-qualified + grants mínimos. Sem literal de role (só helpers canônicos via
-- cliente.pode_ver_cliente) → guard no_literal_role_in_policy permanece verde.
--
-- Anti-órfão (ADR 0004): client_id/demanda_id são uuid soltos; cada escrita valida
-- a existência da referência atomicamente -> RAISE. Integridade de runtime na RPC;
-- rede de segurança é a reconciliação (Slice 7).
--
-- Audiência (ADR 0005): toda operação é escopada por cliente.pode_ver_cliente — o
-- predicado unificado e dono único de "quem vê o cliente" (A+B+C+D). Demanda HERDA
-- essa audiência; NÃO usa e_envolvido (que é só C+C' e regrediria page-grant/exec/GP).

-- =============================================================================
-- criar(client_id, titulo, dominio) -> uuid (id da demanda criada)
--   Autoriza: quem pode_ver_cliente do cliente. Anti-órfão: cliente.existe -> RAISE.
-- =============================================================================
CREATE OR REPLACE FUNCTION demanda.criar(
  p_client_id uuid, p_titulo text, p_dominio text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id     uuid;
BEGIN
  -- Autorização: só quem enxerga o cliente cria demanda nele (audiência herdada).
  IF NOT cliente.pode_ver_cliente(p_client_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode ver o cliente %', p_client_id
      USING ERRCODE = '42501';
  END IF;

  -- Anti-órfão: o cliente precisa existir (validação atômica via contrato, ADR 0004).
  IF NOT cliente.existe(p_client_id) THEN
    RAISE EXCEPTION 'cliente % não existe (referência órfã barrada)', p_client_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_titulo IS NULL OR btrim(p_titulo) = '' THEN
    RAISE EXCEPTION 'titulo obrigatório' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO demanda.demandas (client_id, titulo, dominio)
  VALUES (p_client_id, btrim(p_titulo), p_dominio)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION demanda.criar(uuid, text, text) IS
  'Contrato do módulo demanda: cria uma demanda para um cliente. Autoriza quem '
  'pode_ver_cliente; valida existência do cliente (anti-órfão, ADR 0004). Único '
  'caminho de escrita em demanda.demandas. Retorna o id da demanda criada.';

-- =============================================================================
-- vincular_card(demanda_id, card_ref) -> void
--   Liga um card de domínio (public.kanban_cards) a uma demanda. Nesta slice o
--   card_ref é o id de um kanban_card (a god-table; único alvo do strangler agora).
--   Anti-órfão duplo: a demanda precisa existir (schema próprio) E o card precisa
--   existir. Autoriza quem pode_ver_cliente do cliente DONO da demanda.
-- =============================================================================
CREATE OR REPLACE FUNCTION demanda.vincular_card(
  p_demanda_id uuid, p_card_ref uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_client_id uuid;
BEGIN
  -- A demanda precisa existir (no schema próprio — validação local).
  SELECT d.client_id INTO v_client_id
  FROM demanda.demandas d
  WHERE d.id = p_demanda_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'demanda % não existe (referência órfã barrada)', p_demanda_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Autorização: quem pode ver o cliente dono da demanda pode vincular cards a ela.
  IF NOT cliente.pode_ver_cliente(v_client_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode ver o cliente da demanda %', p_demanda_id
      USING ERRCODE = '42501';
  END IF;

  -- Anti-órfão: o card precisa existir.
  IF NOT EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.id = p_card_ref) THEN
    RAISE EXCEPTION 'card % não existe (referência órfã barrada)', p_card_ref
      USING ERRCODE = 'P0001';
  END IF;

  -- Seta o link strangler. demanda_id é uuid solto em public.kanban_cards (ADR 0004);
  -- a RPC do módulo dono da demanda é quem o escreve (SECURITY DEFINER).
  UPDATE public.kanban_cards
     SET demanda_id = p_demanda_id
   WHERE id = p_card_ref;
END;
$$;

COMMENT ON FUNCTION demanda.vincular_card(uuid, uuid) IS
  'Contrato do módulo demanda: vincula um card de domínio (kanban_cards) a uma '
  'demanda (CONTEXT.md → padrão strangler). Anti-órfão duplo (demanda + card); '
  'autoriza quem pode_ver_cliente do cliente da demanda. Único caminho de set de '
  'kanban_cards.demanda_id. Outros *_cards entram quando seu módulo migrar.';

-- =============================================================================
-- do_cliente(client_id) -> SETOF demandas
--   Lista as demandas de um cliente, atravessando áreas. Escopado pela AUDIÊNCIA
--   HERDADA do cliente: só quem pode_ver_cliente recebe linhas (não-autorizado
--   recebe VAZIO — semântica "200+vazio" do #78, não erro).
-- =============================================================================
CREATE OR REPLACE FUNCTION demanda.do_cliente(p_client_id uuid)
RETURNS TABLE (
  id         uuid,
  client_id  uuid,
  titulo     text,
  status     text,
  dominio    text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.id, d.client_id, d.titulo, d.status, d.dominio, d.created_at
  FROM demanda.demandas d
  WHERE d.client_id = p_client_id
    -- Gate de audiência: só quem pode ver o cliente vê suas demandas (ADR 0005).
    AND cliente.pode_ver_cliente(p_client_id, auth.uid())
  ORDER BY d.created_at DESC;
$$;

COMMENT ON FUNCTION demanda.do_cliente(uuid) IS
  'Contrato do módulo demanda: lista as demandas de um cliente (atravessando áreas). '
  'Audiência = quem pode_ver_cliente (ADR 0005); não-autorizado recebe VAZIO, não erro.';

-- =============================================================================
-- Grants — só authenticated chama o contrato; revoga EXECUTE default de PUBLIC.
-- =============================================================================
REVOKE ALL ON FUNCTION demanda.criar(uuid, text, text)   FROM PUBLIC;
REVOKE ALL ON FUNCTION demanda.vincular_card(uuid, uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION demanda.do_cliente(uuid)           FROM PUBLIC;
GRANT EXECUTE ON FUNCTION demanda.criar(uuid, text, text)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION demanda.vincular_card(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION demanda.do_cliente(uuid)          TO authenticated, service_role;
