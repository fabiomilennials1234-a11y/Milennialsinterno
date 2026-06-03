-- 20260603190100_module_presenca_intervalo_rpc.sql
-- Slice 6 (#83) — Contrato (interface pública) do módulo `presenca`. ADR 0004 + 0005 + 0007.
-- A ÚNICA forma de escrever um intervalo de atuação / de ler o Tempo-na-demanda.
--
-- Hardening (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + identificadores
-- schema-qualified + grants mínimos. Sem literal de role (só helpers canônicos via
-- cliente.pode_ver_cliente) → guard no_literal_role_in_policy permanece verde.
--
-- Anti-órfão (ADR 0004): demanda_id é uuid solto; cada escrita resolve a demanda no
-- schema demanda (lookup local de schema, como demanda.vincular_card) e RAISE se não
-- existe. Integridade de runtime na RPC; rede de segurança é a reconciliação (Slice 7).
--
-- Audiência (ADR 0005): toda operação é escopada por cliente.pode_ver_cliente — o
-- predicado unificado e dono único de "quem vê o cliente" (A+B+C+D). Presença HERDA
-- essa audiência; NÃO usa e_envolvido (que é só C+C' e regrediria page-grant/exec/GP).
--
-- Invariante de domínio: user_id é SEMPRE o caller (auth.uid()). A RPC NUNCA aceita
-- user_id do client — ninguém forja tempo no nome de outro.

BEGIN;

-- =============================================================================
-- registrar_intervalo(demanda_id, inicio, fim) -> uuid (id do intervalo gravado)
--   Persiste UM intervalo FECHADO de atuação. Chamada na borda atuando:true->false
--   (pausa/encerra/troca/fechar-aba), NÃO por heartbeat. Anti-órfão: a demanda
--   precisa existir -> RAISE. Autoriza quem pode_ver_cliente do cliente DA demanda.
-- =============================================================================
CREATE OR REPLACE FUNCTION presenca.registrar_intervalo(
  p_demanda_id uuid, p_inicio timestamptz, p_fim timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := (SELECT auth.uid());
  v_client_id uuid;
  v_id        uuid;
BEGIN
  -- A demanda precisa existir (lookup local no schema demanda) -> resolve o cliente.
  SELECT d.client_id INTO v_client_id
  FROM demanda.demandas d
  WHERE d.id = p_demanda_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'demanda % não existe (referência órfã barrada)', p_demanda_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Autorização: só quem enxerga o cliente da demanda registra tempo nela (audiência herdada).
  IF NOT cliente.pode_ver_cliente(v_client_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode ver o cliente da demanda %', p_demanda_id
      USING ERRCODE = '42501';
  END IF;

  -- Intervalo válido: fechado e com duração positiva.
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim <= p_inicio THEN
    RAISE EXCEPTION 'intervalo inválido: fim (%) deve ser > inicio (%)', p_fim, p_inicio
      USING ERRCODE = 'P0001';
  END IF;

  -- Defensivo: rejeita intervalo absurdamente longo (provável clock-skew/bug),
  -- evitando que um único intervalo corrompido infle o Tempo-na-demanda.
  IF p_fim - p_inicio > interval '24 hours' THEN
    RAISE EXCEPTION 'intervalo > 24h rejeitado (provável erro de relógio): % a %', p_inicio, p_fim
      USING ERRCODE = 'P0001';
  END IF;

  -- user_id é SEMPRE o caller (invariante anti-forja). client_id desnormalizado da demanda.
  INSERT INTO presenca.atuacao_intervalos (client_id, demanda_id, user_id, inicio, fim)
  VALUES (v_client_id, p_demanda_id, v_caller, p_inicio, p_fim)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION presenca.registrar_intervalo(uuid, timestamptz, timestamptz) IS
  'Contrato do módulo presenca: grava UM intervalo FECHADO de atuação numa demanda '
  '(CONTEXT.md → Tempo-na-demanda). Chamada na borda atuando:true->false, não por '
  'heartbeat. Anti-órfão (demanda existe); autoriza pode_ver_cliente; user_id = caller '
  '(anti-forja). Único caminho de escrita em presenca.atuacao_intervalos.';

-- =============================================================================
-- tempo_na_demanda(demanda_id, periodo default null) -> interval
--   O número honesto de "há quanto tempo se atua nesta demanda" = SOMA dos
--   intervalos (de TODOS os usuários — é tempo-na-demanda, não por pessoa; o "quem"
--   é o badge ao vivo). `periodo` opcional limita a janela (inicio >= now()-periodo).
--   Audiência herdada: não-autorizado recebe interval ZERO (semântica 200+vazio, #80).
-- =============================================================================
CREATE OR REPLACE FUNCTION presenca.tempo_na_demanda(
  p_demanda_id uuid, p_periodo interval DEFAULT NULL
)
RETURNS interval
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(ai.fim - ai.inicio), interval '0')
  FROM presenca.atuacao_intervalos ai
  WHERE ai.demanda_id = p_demanda_id
    AND (p_periodo IS NULL OR ai.inicio >= now() - p_periodo)
    -- Gate de audiência: só quem pode ver o cliente da demanda vê o tempo (ADR 0005).
    AND cliente.pode_ver_cliente(ai.client_id, (SELECT auth.uid()));
$$;

COMMENT ON FUNCTION presenca.tempo_na_demanda(uuid, interval) IS
  'Contrato do módulo presenca: Tempo-na-demanda = SOMA dos intervalos de atuação de '
  'uma demanda (CONTEXT.md). Audiência = pode_ver_cliente (ADR 0005); não-autorizado '
  'recebe interval 0 (não erro). periodo opcional limita a janela.';

-- =============================================================================
-- tempo_por_demanda_do_cliente(client_id) -> SETOF (demanda_id, segundos)
--   Caminho de LEITURA da UI: o tempo de TODAS as demandas de um cliente numa só
--   query (evita N requests no modal). Audiência herdada: não-autorizado recebe
--   VAZIO (não erro). segundos = bigint (formatação é da UI).
-- =============================================================================
CREATE OR REPLACE FUNCTION presenca.tempo_por_demanda_do_cliente(p_client_id uuid)
RETURNS TABLE (demanda_id uuid, segundos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ai.demanda_id, FLOOR(EXTRACT(epoch FROM SUM(ai.fim - ai.inicio)))::bigint
  FROM presenca.atuacao_intervalos ai
  WHERE ai.client_id = p_client_id
    -- Gate de audiência: só quem pode ver o cliente vê o tempo das demandas (ADR 0005).
    AND cliente.pode_ver_cliente(p_client_id, (SELECT auth.uid()))
  GROUP BY ai.demanda_id;
$$;

COMMENT ON FUNCTION presenca.tempo_por_demanda_do_cliente(uuid) IS
  'Contrato do módulo presenca: Tempo-na-demanda de TODAS as demandas de um cliente '
  '(uma query p/ a UI). Audiência = pode_ver_cliente (ADR 0005); não-autorizado recebe '
  'VAZIO. segundos = bigint (formatação na UI).';

-- =============================================================================
-- Grants — só authenticated chama o contrato; revoga EXECUTE default de PUBLIC.
-- =============================================================================
REVOKE ALL ON FUNCTION presenca.registrar_intervalo(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION presenca.tempo_na_demanda(uuid, interval)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION presenca.tempo_por_demanda_do_cliente(uuid)                   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION presenca.registrar_intervalo(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION presenca.tempo_na_demanda(uuid, interval)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION presenca.tempo_por_demanda_do_cliente(uuid)                   TO authenticated, service_role;

COMMIT;
