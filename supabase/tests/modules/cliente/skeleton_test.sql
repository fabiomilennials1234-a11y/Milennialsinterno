-- supabase/tests/modules/cliente/skeleton_test.sql
-- pgTAP — Slice 0 (#76) walking skeleton do módulo `cliente`.
-- Prova o padrão Monolito Modular contrato-only ponta-a-ponta (ADR 0004):
--   1. schema `cliente` existe e coexiste com `public`
--   2. tabela-marca `cliente.modulo_health` existe
--   3. escrita direta em `cliente.modulo_health` é REVOGADA de `authenticated`
--   4. RPC-contrato `cliente.existe(uuid)` existe, é SECURITY DEFINER, e funciona
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/cliente/skeleton_test.sql
-- Cada teste roda em transação e dá ROLLBACK ao final (não persiste nada).

BEGIN;

SELECT plan(7);

-- =============================================================================
-- TEST 1 — schema `cliente` existe
-- =============================================================================
SELECT has_schema('cliente', 'schema cliente existe e coexiste com public');

-- =============================================================================
-- TEST 2 — tabela-marca `cliente.modulo_health` existe (RED até a migration)
-- =============================================================================
SELECT has_table('cliente', 'modulo_health', 'cliente.modulo_health existe (tabela-marca do skeleton)');

-- =============================================================================
-- TEST 3 — CONTRATO: escrita direta por `authenticated` é negada PELO REVOKE.
-- Impersona `authenticated` e tenta INSERT direto. A invariante do ADR 0004 é
-- que o *privilégio* foi revogado — então o erro deve ser
-- `42501 permission denied for table`, NÃO o erro de RLS
-- (`new row violates row-level security policy`). Casar a MENSAGEM, não só o
-- SQLSTATE, garante que o teste prova o REVOKE (a fronteira do contrato) e não
-- apenas a RLS (segunda linha de defesa, testada à parte no TEST 4).
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO cliente.modulo_health (note) VALUES ('hack') $$,
  '42501',
  'permission denied for table modulo_health',
  'INSERT direto por authenticated é negado pelo REVOKE de privilégio (contrato)'
);
RESET ROLE;

-- =============================================================================
-- TEST 4 — RPC-contrato `cliente.existe(uuid)` existe e é SECURITY DEFINER.
-- É o predicado de existência que os contratos dos outros módulos chamam
-- antes de inserir (validação atômica anti-órfão). Interface pública do módulo.
-- =============================================================================
SELECT has_function(
  'cliente', 'existe', ARRAY['uuid'],
  'cliente.existe(uuid) existe (RPC-contrato — predicado de existência)'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cliente' AND p.proname = 'existe'),
  true,
  'cliente.existe é SECURITY DEFINER'
);

-- =============================================================================
-- TEST 5 — comportamento: cliente inexistente -> false (via interface pública).
-- Chamada como `authenticated`, provando que o GRANT EXECUTE funciona.
-- Usa um UUID aleatório que não existe em public.clients.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT is(
  cliente.existe('00000000-0000-0000-0000-000000000000'::uuid),
  false,
  'cliente.existe(uuid inexistente) retorna false'
);
RESET ROLE;

-- =============================================================================
-- TEST 6 — comportamento: cliente existente -> true.
-- Insere um client real (como role privilegiado, rollback ao fim), depois
-- chama o predicado como authenticated. Prova a leitura cross-schema do kernel
-- (cliente.existe lê public.clients) por contrato.
-- =============================================================================
INSERT INTO public.clients (id, name)
VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'Skeleton Test Client #76');

SET LOCAL ROLE authenticated;
SELECT is(
  cliente.existe('11111111-1111-1111-1111-111111111111'::uuid),
  true,
  'cliente.existe(uuid existente) retorna true'
);
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
