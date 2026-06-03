-- 20260603220000_module_demanda_painel_do_usuario.sql
-- Slice 8 (#84) — Contrato de AGREGAÇÃO do módulo `demanda`: a vista de pássaro
-- "Monday". ADR 0004 (contrato-only) + ADR 0005 (pode_ver_cliente).
--
-- O capstone do PRD #75. As slices anteriores entregaram o PER-CLIENTE
-- (demanda.do_cliente + presenca.tempo_por_demanda_do_cliente, ambos por client_id).
-- Esta RPC é o CROSS-CLIENTE: devolve, numa SÓ query, TODAS as demandas de TODOS
-- os clientes que o caller pode ver, com nome do cliente e Tempo-na-demanda
-- acumulado. É o caminho de leitura do board agregado — evita o N+1 (1 query no
-- lugar de uma do_cliente + uma tempo por cliente visível).
--
-- ADITIVO: não cria tabela, não toca public/cliente/presenca além de LER. Zero
-- regressão. Reusa por CONTRATO o predicado dono único de audiência
-- (cliente.pode_ver_cliente) e as tabelas dos módulos vizinhos via SECURITY DEFINER
-- — sem FK cross-schema, coerente com ADR 0004.
--
-- Hardening (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + identificadores
-- schema-qualified + grants mínimos. Sem literal de role (só helper canônico
-- pode_ver_cliente) → guard no_literal_role_in_policy permanece verde.
--
-- ESCALA (decisão registrada, #84): a presença VIVA (quem atua AGORA) NÃO entra
-- nesta RPC — ela continua no canal Realtime efêmero por cliente (ADR 0007), e o
-- board a assina LAZY por viewport (não 1 canal por cliente no mount). Esta RPC
-- entrega o estado FRIO (demandas + tempo somado) em uma query; o "agora" é
-- sobreposto no client. Custo de audiência: pode_ver_cliente é avaliado UMA vez
-- por cliente DISTINTO (CTE clientes_visiveis), não por linha de demanda — o
-- predicado é caro (is_admin + EXISTS + e_envolvido + page-grants) e rodá-lo por
-- demanda seria O(demandas) chamadas; aqui é O(clientes distintos).

BEGIN;

-- =============================================================================
-- painel_do_usuario() -> SETOF (demanda + cliente + tempo)
--   Sem parâmetro: o escopo é o PRÓPRIO caller (auth.uid()) via pode_ver_cliente.
--   Audiência herdada (ADR 0005): só demandas de clientes que o caller pode ver;
--   não-autorizado recebe VAZIO (semântica 200+vazio do #80, não erro). Isolamento
--   cross-cliente = a garantia LGPD do board (a maior superfície de leitura agregada).
-- =============================================================================
CREATE OR REPLACE FUNCTION demanda.painel_do_usuario()
RETURNS TABLE (
  demanda_id    uuid,
  client_id     uuid,
  client_nome   text,
  titulo        text,
  status        text,
  dominio       text,
  created_at    timestamptz,
  tempo_segundos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH clientes_visiveis AS (
    -- pode_ver_cliente avaliado UMA vez por cliente DISTINTO que tem demanda
    -- (não por linha de demanda) — o predicado é caro; O(clientes), não O(demandas).
    SELECT c.id, c.name
    FROM public.clients c
    WHERE EXISTS (SELECT 1 FROM demanda.demandas d WHERE d.client_id = c.id)
      AND cliente.pode_ver_cliente(c.id, (SELECT auth.uid()))
  ),
  tempo AS (
    -- Tempo-na-demanda = SOMA dos intervalos de atuação, agregado por demanda.
    -- Limitado às demandas dos clientes visíveis (o filtro de audiência cascateia).
    SELECT ai.demanda_id, FLOOR(EXTRACT(epoch FROM SUM(ai.fim - ai.inicio)))::bigint AS segundos
    FROM presenca.atuacao_intervalos ai
    WHERE ai.client_id IN (SELECT id FROM clientes_visiveis)
    GROUP BY ai.demanda_id
  )
  SELECT
    d.id            AS demanda_id,
    d.client_id     AS client_id,
    cv.name         AS client_nome,
    d.titulo        AS titulo,
    d.status        AS status,
    d.dominio       AS dominio,
    d.created_at    AS created_at,
    COALESCE(t.segundos, 0)::bigint AS tempo_segundos  -- LEFT JOIN: 0 quando sem intervalo
  FROM demanda.demandas d
  JOIN clientes_visiveis cv ON cv.id = d.client_id
  LEFT JOIN tempo t ON t.demanda_id = d.id
  ORDER BY cv.name ASC, d.created_at DESC;
$$;

COMMENT ON FUNCTION demanda.painel_do_usuario() IS
  'Contrato de agregação do módulo demanda (Slice 8/#84): a vista de pássaro Monday '
  '— TODAS as demandas de TODOS os clientes que o caller pode ver, com client_nome e '
  'Tempo-na-demanda somado, em UMA query (evita N+1). Audiência = pode_ver_cliente '
  '(ADR 0005), avaliado 1x por cliente distinto; não-autorizado recebe VAZIO. A '
  'presença VIVA não entra aqui — fica no canal Realtime efêmero (ADR 0007), '
  'sobreposta lazy no client. STABLE/read-only.';

-- =============================================================================
-- Grants — só authenticated chama o contrato; revoga EXECUTE default de PUBLIC.
-- =============================================================================
REVOKE ALL ON FUNCTION demanda.painel_do_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION demanda.painel_do_usuario() TO authenticated, service_role;

COMMIT;
