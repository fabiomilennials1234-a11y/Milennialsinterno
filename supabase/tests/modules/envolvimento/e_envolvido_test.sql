-- supabase/tests/modules/envolvimento/e_envolvido_test.sql
-- pgTAP — Slice 2 (#78) — Envolvido (client_members) é a fonte única de
-- envolvimento, e cliente.e_envolvido é o predicado puro (C)+(C') do ADR 0005.
--
-- TDD vertical: este é o teste do KERNEL do design — a tabela + o predicado.
-- Comportamento via interface pública (o predicado), não implementação.
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/envolvimento/e_envolvido_test.sql
-- UUID prefix: 'e0000000' (envolvimento namespace; evita colisão com outros testes).

BEGIN;

SELECT plan(8);

-- =============================================================================
-- ESTRUTURA — a fonte única vive no schema do módulo `cliente` (ADR 0004/0005)
-- =============================================================================
SELECT has_table('cliente', 'client_members',
  'cliente.client_members existe (fonte única de Envolvido)');

SELECT has_function('cliente', 'e_envolvido', ARRAY['uuid', 'uuid'],
  'cliente.e_envolvido(uuid,uuid) existe (predicado de involvement)');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'cliente' AND p.proname = 'e_envolvido'),
  true,
  'cliente.e_envolvido é SECURITY DEFINER (hardening ADR 0004)');

-- =============================================================================
-- CONTRATO — escrita direta em client_members é REVOGADA de authenticated.
-- Só a RPC SECURITY DEFINER do módulo escreve (ADR 0004). Casa SQLSTATE 42501
-- (permission denied) — o REVOKE, não a RLS.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
     VALUES ('e0000000-0000-0000-0000-0000000000c1'::uuid,
             'e0000000-0000-0000-0000-00000000f001'::uuid, 'ads_manager') $$,
  '42501',
  'permission denied for table client_members',
  'INSERT direto em client_members por authenticated é negado pelo REVOKE (contrato)'
);
RESET ROLE;

-- =============================================================================
-- COMPORTAMENTO do predicado — seed via role privilegiado (rollback ao fim).
-- =============================================================================
INSERT INTO public.clients (id, name)
VALUES ('e0000000-0000-0000-0000-0000000000c1'::uuid, 'Envolvido Test Client');

INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES
  ('e0000000-0000-0000-0000-0000000000c1'::uuid,
   'e0000000-0000-0000-0000-0000000000a1'::uuid, 'ads_manager');

-- não-envolvido -> false
SELECT is(
  cliente.e_envolvido('e0000000-0000-0000-0000-0000000000c1'::uuid,
                      'e0000000-0000-0000-0000-00000000bad0'::uuid),
  false,
  'e_envolvido(client, não-membro) retorna false');

-- envolvido -> true
SELECT is(
  cliente.e_envolvido('e0000000-0000-0000-0000-0000000000c1'::uuid,
                      'e0000000-0000-0000-0000-0000000000a1'::uuid),
  true,
  'e_envolvido(client, membro) retorna true');

-- cliente sem membros -> false (não vaza)
SELECT is(
  cliente.e_envolvido('e0000000-0000-0000-0000-0000000000c9'::uuid,
                      'e0000000-0000-0000-0000-0000000000a1'::uuid),
  false,
  'e_envolvido(cliente-sem-membros, membro-de-outro) retorna false');

-- chamável como authenticated (GRANT EXECUTE funciona)
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT cliente.e_envolvido('e0000000-0000-0000-0000-0000000000c1'::uuid,
                               'e0000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'e_envolvido é chamável por authenticated (GRANT EXECUTE)');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
