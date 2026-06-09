-- 20260608130000_concessao_schema.sql
--
-- Slice #146 (Concessão) — ADR 0009.
--
-- Cria a entidade de domínio Concessão: produto concedido a um cliente SEM
-- contrapartida financeira (retenção de cliente em risco). Distinta e paralela
-- ao Upsell (que é venda, gera comissão + MRR).
--
-- ONDE VIVE: public.concessoes. Pelo ADR 0009 §6 a Concessão pertence ao módulo
-- `financeiro` (dono de upsells/MRR/comissões). MAS o strangler ainda NÃO extraiu
-- o módulo financeiro para um schema dedicado — todas as tabelas financeiro_*
-- vivem em public. Criar um schema `financeiro` só para esta tabela seria
-- over-engineering e inconsistente com as vizinhas. Fica em public; migra junto
-- quando o módulo financeiro for extraído (reversível). Mesma decisão registrada
-- nas RPCs do CRM (20260603170000) que ficaram em public pelo mesmo motivo.
--
-- SEM FK para clients (ADR 0004 — monolito modular contract-only): client_id é
-- uuid SOLTO. Integridade referencial NÃO é garantida pelo banco; será mantida
-- por (1) validação atômica na RPC de concessão (slice futuro, que checará a
-- existência do cliente antes de inserir) e (2) job de reconciliação que põe
-- órfãos em quarentena. Comentado na coluna.
--
-- ESCRITA contract-only (ADR 0004 §3): a tabela nasce com as policies de escrita
-- versionadas (admin OR sucesso_cliente — quem concede, ADR 0009 §3), MAS o GRANT
-- direto de INSERT/UPDATE/DELETE a authenticated é REVOGADO. Escrita real só via
-- RPC tipada do módulo (slice futuro). Manter as policies + revogar o grant deixa
-- a regra de autorização versionada e testável JÁ, sem abrir escrita direta.

BEGIN;

-- =============================================================================
-- Enums fechados (CREATE TYPE, não CHECK) — auditável, evolui via ALTER TYPE.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='concessao_motivo') THEN
    CREATE TYPE public.concessao_motivo AS ENUM (
      'risco_churn',          -- cliente em risco de cancelar
      'compensacao_falha',    -- compensação por falha da empresa
      'negociacao_renovacao', -- alavanca em renovação de contrato
      'cortesia_estrategica'  -- cortesia para conta estratégica
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='concessao_status') THEN
    CREATE TYPE public.concessao_status AS ENUM (
      'ativa',       -- concedida e vigente
      'convertida',  -- cliente passou a pagar (transição financeira; slice futuro)
      'revogada'     -- teardown: cliente perdeu o produto (slice futuro)
    );
  END IF;
END$$;

-- =============================================================================
-- Tabela concessoes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.concessoes (
  id                 uuid                  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id          uuid                  NOT NULL,  -- ref por contrato; SEM FK cross-schema (ADR 0004). Integridade via RPC + reconciliação.
  product_slug       text                  NOT NULL,
  product_name       text                  NOT NULL,
  monthly_value      numeric               NOT NULL DEFAULT 0,  -- valor ACORDADO p/ conversão futura; 0 enquanto concedido (não infla MRR).
  motivo             public.concessao_motivo NOT NULL,
  status             public.concessao_status NOT NULL DEFAULT 'ativa',
  contract_expires_at timestamptz          NULL,      -- opcional: força CS a revisitar "ainda vale dar de graça?".
  granted_by         uuid                  NOT NULL,  -- quem concedeu (audit). Sem FK (uuid solto, contract-only).
  granted_by_name    text                  NOT NULL,
  created_at         timestamptz           NOT NULL DEFAULT now(),
  updated_at         timestamptz           NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.concessoes IS
  'Concessão (ADR 0009): produto concedido a um cliente SEM contrapartida financeira '
  '(retenção). Distinta do Upsell (venda). client_id/granted_by são uuid soltos por '
  'contrato (sem FK cross-schema, ADR 0004); integridade via RPC + reconciliação. '
  'Vive em public porque o módulo financeiro ainda não foi extraído pelo strangler. '
  'Escrita contract-only: só via RPC do módulo (slice futuro), grant direto revogado.';

COMMENT ON COLUMN public.concessoes.client_id IS
  'Referência ao cliente por CONTRATO (ADR 0004): uuid solto, SEM FK. Existência '
  'validada na RPC de concessão (slice futuro) + job de reconciliação de órfãos.';
COMMENT ON COLUMN public.concessoes.monthly_value IS
  'Valor mensal ACORDADO para conversão futura. Fica 0 enquanto a concessão está '
  'ativa (não infla MRR/ticket — ADR 0009 §1). A conversão sobe esse valor.';

-- =============================================================================
-- Índices: client_id (escopo da RLS / lookup por cliente) e status (portfólio
-- de governança "quantas ativas por motivo").
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_concessoes_client_id ON public.concessoes(client_id);
CREATE INDEX IF NOT EXISTS idx_concessoes_status    ON public.concessoes(status);

-- =============================================================================
-- updated_at automático (moddatetime, padrão do projeto).
-- =============================================================================
DROP TRIGGER IF EXISTS set_concessoes_updated_at ON public.concessoes;
CREATE TRIGGER set_concessoes_updated_at
  BEFORE UPDATE ON public.concessoes
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime();

-- =============================================================================
-- RLS. NUNCA USING(true).
--   SELECT: escopado a quem VÊ o cliente — delega ao predicado canônico ÚNICO
--           cliente.pode_ver_cliente (ADR 0005; mesmo padrão de demanda.demandas).
--   ESCRITA: policies de autorização (admin OR sucesso_cliente — quem concede,
--           ADR 0009 §3) versionadas E testáveis; mas o GRANT direto é revogado
--           (contract-only) — INSERT/UPDATE/DELETE direto por authenticated falha
--           por falta de privilégio (a policy nem chega a ser avaliada).
-- =============================================================================
ALTER TABLE public.concessoes ENABLE ROW LEVEL SECURITY;

-- Contrato: revoga TODO acesso direto (inclui o grant default a anon/public que o
-- CREATE TABLE herda) e devolve só SELECT a authenticated. anon NÃO toca a tabela.
REVOKE ALL ON public.concessoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.concessoes TO authenticated;

DROP POLICY IF EXISTS concessoes_select ON public.concessoes;
CREATE POLICY concessoes_select ON public.concessoes
  FOR SELECT TO authenticated
  USING (
    -- Audiência herdada do cliente (ADR 0005). pode_ver_cliente é SECURITY DEFINER
    -- (owner-run) — não reentra na policy.
    cliente.pode_ver_cliente(client_id, auth.uid())
  );

-- Policies de escrita (versionadas/testáveis). Quem CONCEDE: admin OR sucesso_cliente
-- (ADR 0009 §3). Literal sucesso_cliente acompanhado de is_admin (guard
-- no_literal_role_in_policy). NB: o grant direto está revogado acima, então estas
-- policies só passam a importar quando a RPC do módulo (SECURITY DEFINER) for o
-- caminho de escrita — ou se um futuro grant for concedido. Versionadas desde já.
DROP POLICY IF EXISTS concessoes_insert ON public.concessoes;
CREATE POLICY concessoes_insert ON public.concessoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sucesso_cliente'::public.user_role)
  );

DROP POLICY IF EXISTS concessoes_update ON public.concessoes;
CREATE POLICY concessoes_update ON public.concessoes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sucesso_cliente'::public.user_role)
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sucesso_cliente'::public.user_role)
  );

DROP POLICY IF EXISTS concessoes_delete ON public.concessoes;
CREATE POLICY concessoes_delete ON public.concessoes
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sucesso_cliente'::public.user_role)
  );

COMMIT;
