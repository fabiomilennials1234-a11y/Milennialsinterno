-- 20260603240010_module_reconciliacao_varrer_orfaos.sql
-- Slice 7 (#82) — Reconciliação: a função de varredura (ADR 0004, parcela b).
--
-- varrer_orfaos() detecta TODAS as refs uuid soltas órfãs do contrato-only, num
-- único passe, por ANTI-JOIN (ref NOT NULL AND NOT EXISTS no alvo). Idempotente
-- (ON CONFLICT contra o índice único parcial de aberto) e auto-resolutiva (marca
-- resolvido_em nos abertos que sumiram da varredura — origem deletada ou ref
-- reapareceu). Alerta = RAISE WARNING quando há órfão NOVO (aparece no log do cron
-- / Postgres; sinal operacional sem acoplar a sistema de notificação de produto).
--
-- SECURITY DEFINER + search_path='' (hardening ADR 0004). Roda como owner: lê as
-- tabelas de vários schemas direto — a ÚNICA exceção consciente à regra "não leia
-- tabela de outro módulo", pois é o reconciler, não negócio de módulo (ver schema
-- comment). NÃO concede EXECUTE a authenticated: só o cron (postgres) e service_role
-- disparam; usuário comum não roda varredura.
--
-- Refs varridas (issue #82):
--   (1) demanda.demandas.client_id            -> public.clients          (NOT NULL)
--   (2) public.kanban_cards.demanda_id        -> demanda.demandas        (NULLABLE -> NULL nunca é órfão)
--   (3) presenca.atuacao_intervalos.demanda_id-> demanda.demandas        (NOT NULL)
--   (4) presenca.atuacao_intervalos.client_id -> public.clients          (NOT NULL)
--   (5) cliente.client_members.client_id      -> public.clients          (NOT NULL)
--   (6) cliente.client_members.user_id        -> auth.users              (NOT NULL)
-- PURAMENTE ADITIVO.

BEGIN;

CREATE OR REPLACE FUNCTION reconciliacao.varrer_orfaos()
RETURNS integer  -- nº de órfãos NOVOS quarentenados nesta passada
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- hardening: nunca depender do search_path do chamador
AS $$
DECLARE
  v_novos integer;
BEGIN
  -- 1) Materializa a varredura corrente (todas as categorias) numa temp table.
  --    Anti-join por NOT EXISTS; nullable (kanban.demanda_id) já filtra NULL no NOT NULL.
  --    DROP IF EXISTS: a função pode ser chamada >1x na MESMA transação (ex.: pgTAP
  --    roda tudo em BEGIN..ROLLBACK; ON COMMIT DROP não dispara entre chamadas).
  DROP TABLE IF EXISTS _varredura;
  CREATE TEMP TABLE _varredura ON COMMIT DROP AS
  -- (1) demanda.demandas.client_id -> public.clients
  SELECT 'demanda'::text  AS origem_schema, 'demandas'::text AS origem_tabela,
         d.id::text       AS origem_id,     'client'::text   AS ref_tipo,
         d.client_id      AS ref_id_orfao
    FROM demanda.demandas d
   WHERE d.client_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id)
  UNION ALL
  -- (2) public.kanban_cards.demanda_id (nullable) -> demanda.demandas
  SELECT 'public', 'kanban_cards', k.id::text, 'demanda', k.demanda_id
    FROM public.kanban_cards k
   WHERE k.demanda_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM demanda.demandas d WHERE d.id = k.demanda_id)
  UNION ALL
  -- (3) presenca.atuacao_intervalos.demanda_id -> demanda.demandas
  SELECT 'presenca', 'atuacao_intervalos', ai.id::text, 'demanda', ai.demanda_id
    FROM presenca.atuacao_intervalos ai
   WHERE ai.demanda_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM demanda.demandas d WHERE d.id = ai.demanda_id)
  UNION ALL
  -- (4) presenca.atuacao_intervalos.client_id -> public.clients
  SELECT 'presenca', 'atuacao_intervalos', ai.id::text, 'client', ai.client_id
    FROM presenca.atuacao_intervalos ai
   WHERE ai.client_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = ai.client_id)
  UNION ALL
  -- (5) cliente.client_members.client_id -> public.clients  (PK composta: serializa origem_id)
  SELECT 'cliente', 'client_members',
         m.client_id::text || '|' || m.user_id::text || '|' || m.papel_no_cliente,
         'client', m.client_id
    FROM cliente.client_members m
   WHERE m.client_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = m.client_id)
  UNION ALL
  -- (6) cliente.client_members.user_id -> auth.users
  SELECT 'cliente', 'client_members',
         m.client_id::text || '|' || m.user_id::text || '|' || m.papel_no_cliente,
         'user', m.user_id
    FROM cliente.client_members m
   WHERE m.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id);

  -- 2) Quarentena os órfãos NOVOS (idempotente: ON CONFLICT contra o índice único
  --    parcial de aberto — re-rodar não duplica). Conta quantos foram realmente inseridos.
  WITH ins AS (
    INSERT INTO reconciliacao.quarentena
      (origem_schema, origem_tabela, origem_id, ref_tipo, ref_id_orfao)
    SELECT origem_schema, origem_tabela, origem_id, ref_tipo, ref_id_orfao
      FROM _varredura
    ON CONFLICT (origem_schema, origem_tabela, origem_id, ref_tipo, ref_id_orfao)
      WHERE resolvido_em IS NULL
      DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_novos FROM ins;

  -- 3) AUTO-RESOLUÇÃO: abertos que NÃO constam mais na varredura corrente (origem
  --    deletada ou ref reapareceu) recebem resolvido_em. Histórico preservado.
  UPDATE reconciliacao.quarentena q
     SET resolvido_em = now()
   WHERE q.resolvido_em IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM _varredura v
        WHERE v.origem_schema = q.origem_schema
          AND v.origem_tabela = q.origem_tabela
          AND v.origem_id     = q.origem_id
          AND v.ref_tipo      = q.ref_tipo
          AND v.ref_id_orfao  = q.ref_id_orfao
     );

  -- 4) ALERTA operacional: órfão novo é anomalia (caminho feliz não gera órfão).
  IF v_novos > 0 THEN
    RAISE WARNING '[reconciliacao] % órfão(s) NOVO(s) em quarentena (ADR 0004). Ver reconciliacao.quarentena_aberta.', v_novos;
  END IF;

  RETURN v_novos;
END;
$$;

COMMENT ON FUNCTION reconciliacao.varrer_orfaos() IS
  'Varredura periódica de refs uuid órfãs do contrato-only (ADR 0004, parcela b). '
  'Idempotente + auto-resolutiva. Retorna nº de órfãos novos; RAISE WARNING se >0. '
  'SECURITY DEFINER: lê multi-schema (exceção consciente do reconciler). Disparada '
  'pelo cron diário; EXECUTE NÃO concedido a authenticated.';

-- Só o cron (postgres, dono) e service_role disparam. Usuário comum não roda.
REVOKE ALL ON FUNCTION reconciliacao.varrer_orfaos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reconciliacao.varrer_orfaos() TO service_role;

COMMIT;
