-- 20260603190000_module_presenca_atuacao_intervalos.sql
-- Slice 6 (#83) — Módulo `presenca`: persistência do Tempo-na-demanda.
-- Monolito Modular contrato-only (ADR 0004) + audiência (ADR 0005) + ADR 0007.
--
-- Cria o schema dedicado `presenca` (até aqui o módulo só tinha o "lado-banco" da
-- policy de Realtime Authorization — ADR 0007; nenhuma tabela). PURAMENTE ADITIVO:
-- não toca nenhuma tabela de `public`, `cliente` ou `demanda`. Zero regressão.
--
-- Tempo-na-demanda (CONTEXT.md → "Tempo-na-demanda"): duração acumulada de Atuação
-- numa demanda = SOMA de intervalos ATIVOS. Persiste-se SÓ o intervalo FECHADO
-- (inicio E fim), uma escrita ao pausar/encerrar a atuação — NÃO por batida de
-- heartbeat. O "agora" (presença viva) continua no canal Realtime efêmero (ADR 0007).
--
-- ADR 0004: client_id/demanda_id são uuid SOLTOS (sem FK cross-schema, nem para o
-- shared kernel cliente nem para demanda). Integridade por validação atômica na RPC
-- (registrar_intervalo) + reconciliação (Slice 7). client_id é desnormalizado na
-- linha para que a RLS local resolva a audiência SEM JOIN cross-schema na policy.

BEGIN;

CREATE SCHEMA IF NOT EXISTS presenca;

COMMENT ON SCHEMA presenca IS
  'Módulo Presença/Atuação — presença viva (canal Realtime efêmero, ADR 0007) e '
  'persistência do Tempo-na-demanda (intervalos fechados de atuação, #83). Monolito '
  'Modular contrato-only (ADR 0004): escrita só via RPC SECURITY DEFINER; demanda_id/'
  'client_id são uuid soltos (sem FK cross-schema). Ver CONTEXT.md → Tempo-na-demanda.';

-- O role `authenticator` (PostgREST) precisa de USAGE para o schema ser exponível na API.
-- Escrita direta é revogada por tabela (abaixo).
GRANT USAGE ON SCHEMA presenca TO authenticated, anon, service_role;

-- =============================================================================
-- Tabela `atuacao_intervalos` — SÓ intervalo FECHADO (inicio E fim NOT NULL).
-- Não há linha "aberta" no banco: o intervalo aberto vive em memória no client e
-- só é persistido quando a Atuação encerra (idle/blur/unmount/troca de demanda).
-- demanda_id/client_id/user_id são uuid soltos (ADR 0004). client_id é
-- desnormalizado (= cliente da demanda, garantido pela RPC) p/ a RLS local.
-- =============================================================================
CREATE TABLE IF NOT EXISTS presenca.atuacao_intervalos (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  uuid        NOT NULL,                 -- ref por contrato; desnormalizado p/ RLS
  demanda_id uuid        NOT NULL,                 -- ref por contrato; SEM FK cross-schema
  user_id    uuid        NOT NULL,                 -- quem atuou (= caller na RPC)
  inicio     timestamptz NOT NULL,
  fim        timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atuacao_intervalos_fim_gt_inicio CHECK (fim > inicio)
);

COMMENT ON TABLE presenca.atuacao_intervalos IS
  'Intervalo FECHADO de Atuação numa demanda (CONTEXT.md → Tempo-na-demanda). Uma '
  'linha por intervalo encerrado; Tempo-na-demanda = SUM(fim-inicio). client_id/'
  'demanda_id soltos (sem FK cross-schema, ADR 0004); escrita só via RPC do módulo.';

-- Caminho quente: somar/listar os intervalos de uma demanda (tempo_na_demanda).
CREATE INDEX IF NOT EXISTS idx_atuacao_intervalos_demanda
  ON presenca.atuacao_intervalos (demanda_id);
-- Caminho de leitura agregada por cliente (tempo de todas as demandas do cliente).
CREATE INDEX IF NOT EXISTS idx_atuacao_intervalos_client
  ON presenca.atuacao_intervalos (client_id);

-- =============================================================================
-- CONTRATO — escrita direta REVOGADA. Só RPC SECURITY DEFINER do módulo escreve.
-- Leitura: SELECT a authenticated sob RLS, escopada pela audiência herdada do
-- cliente (cliente.pode_ver_cliente). A RLS delega ao predicado SECURITY DEFINER
-- do kernel — não reentra na policy (owner-run), espelhando demanda.demandas.
-- =============================================================================
ALTER TABLE presenca.atuacao_intervalos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON presenca.atuacao_intervalos FROM authenticated;
GRANT SELECT ON presenca.atuacao_intervalos TO authenticated;

DROP POLICY IF EXISTS atuacao_intervalos_select ON presenca.atuacao_intervalos;
CREATE POLICY atuacao_intervalos_select ON presenca.atuacao_intervalos
  FOR SELECT TO authenticated
  USING (
    -- Audiência herdada: quem pode ver o cliente vê o tempo das demandas dele (ADR 0005).
    -- pode_ver_cliente = is_admin(A) OR GP-grupo(B) OR e_envolvido(C/C') OR page-grants(D).
    -- Usa o client_id desnormalizado (sem JOIN cross-schema na policy). Sem literal de role.
    cliente.pode_ver_cliente(client_id, (SELECT auth.uid()))
  );

COMMENT ON POLICY atuacao_intervalos_select ON presenca.atuacao_intervalos IS
  'ADR 0005/0007 (#83): audiência herdada do cliente — quem pode_ver_cliente vê os '
  'intervalos de atuação das demandas dele. Isolamento cross-cliente (LGPD). Sem '
  'literal de role (delega ao predicado dono único pode_ver_cliente).';

COMMIT;
