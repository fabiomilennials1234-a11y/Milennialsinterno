-- supabase/tests/concessao_conceder_produto_test.sql
-- pgTAP — Slice #147 (Concessão). ADR 0009.
--
-- Prova as INVARIANTES da RPC public.conceder_produto (migração
-- 20260608140000_concessao_conceder_produto_rpc.sql), via INTERFACE PÚBLICA
-- (a RPC), não implementação. Tracer bullet central da Concessão.
--
-- Invariantes provadas:
--   ESTRUTURA / HARDENING
--     - conceder_produto(uuid,text,concessao_motivo,timestamptz) existe;
--     - SECURITY DEFINER + search_path travado.
--   HAPPY PATH
--     - admin concede produto novo -> retorna uuid; concessão `ativa`, motivo
--       correto, granted_by = admin; produto em contracted_products;
--       financeiro_active_clients com monthly_value = 0; card no board do slug.
--     - sucesso_cliente DONO da carteira (assigned_sucesso_cliente) -> concede.
--   SUPRESSÃO DE DINHEIRO (assert central, ADR 0009 §1)
--     - após concessão: ZERO upsell_commissions E ZERO mrr_changes do cliente.
--   AUTORIZAÇÃO (42501)
--     - role errada (gestor_ads) -> permission denied;
--     - CS FORA da carteira (assigned_sucesso_cliente != caller) -> permission denied.
--   MOTIVO INVÁLIDO
--     - literal fora do enum concessao_motivo -> erro de cast (22P02).
--   ATOMICIDADE / ANTI-ÓRFÃO
--     - cliente inexistente -> RAISE; NADA gravado em concessoes (sem efeito parcial).
--   CONFLITO BLOQUEIA (P0001, não idempotente)
--     - produto já em contracted_products -> RAISE; nenhuma concessão criada;
--     - concessão `ativa` duplicada (mesmo slug) -> RAISE.
--
-- Board/coluna/cliente são SEEDADOS pelo teste (determinístico). Tudo dentro de
-- BEGIN/ROLLBACK. Impersonação via set_config + SET LOCAL ROLE authenticated
-- (a RPC lê auth.uid()); RPC é SECURITY DEFINER e roda como owner por dentro.
--
-- UUID prefix: 'cd000000'. Runner: scripts/sb-pgtap.sh supabase/tests/concessao_conceder_produto_test.sql
BEGIN;

SELECT plan(26);

-- Helper de impersonação (padrão torque_board_rpc_test.sql).
CREATE OR REPLACE FUNCTION _cd_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public','conceder_produto',
  ARRAY['uuid','text','public.concessao_motivo','timestamptz'],
  'conceder_produto(uuid,text,concessao_motivo,timestamptz) existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='conceder_produto'),
  true, 'conceder_produto é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='conceder_produto'),
  'conceder_produto trava search_path (hardening SECURITY DEFINER)');

-- =============================================================================
-- SEED: admin (ceo), CS dono da carteira, CS forasteiro, gestor_ads (role errada).
--   2 clientes: um com board+coluna pra rotear card; outro p/ teste CS dono.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@m.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('cd000000-0000-0000-0000-0000000000a1'::uuid),  -- admin/ceo
  ('cd000000-0000-0000-0000-0000000000c1'::uuid),  -- CS dono da carteira
  ('cd000000-0000-0000-0000-0000000000c2'::uuid),  -- CS forasteiro (não dono)
  ('cd000000-0000-0000-0000-0000000000e1'::uuid)   -- gestor_ads (role errada)
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('cd000000-0000-0000-0000-0000000000a1'::uuid,'CD Admin','cda1@m.test'),
 ('cd000000-0000-0000-0000-0000000000c1'::uuid,'CD CS Dono','cdc1@m.test'),
 ('cd000000-0000-0000-0000-0000000000c2'::uuid,'CD CS Fora','cdc2@m.test'),
 ('cd000000-0000-0000-0000-0000000000e1'::uuid,'CD Ads','cde1@m.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('cd000000-0000-0000-0000-0000000000a1'::uuid,'ceo'),
 ('cd000000-0000-0000-0000-0000000000c1'::uuid,'sucesso_cliente'),
 ('cd000000-0000-0000-0000-0000000000c2'::uuid,'sucesso_cliente'),
 ('cd000000-0000-0000-0000-0000000000e1'::uuid,'gestor_ads')
ON CONFLICT (user_id,role) DO NOTHING;

-- Cliente A (board do slug existe) — dono CS = c1.
INSERT INTO public.clients (id,name,entry_date,contract_duration_months,assigned_sucesso_cliente)
VALUES ('cd000000-0000-0000-0000-0000000c1000'::uuid,'CD Client A',
        '2026-01-15'::date, 12, 'cd000000-0000-0000-0000-0000000000c1'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Cliente B (sem board pro slug — exercita fallback product_name=slug) — dono CS = c1.
INSERT INTO public.clients (id,name,entry_date,contract_duration_months,assigned_sucesso_cliente)
VALUES ('cd000000-0000-0000-0000-0000000c2000'::uuid,'CD Client B',
        '2026-02-15'::date, 12, 'cd000000-0000-0000-0000-0000000000c1'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Board + coluda "NOVOS CLIENTES" do slug de teste (card roteia por slug; o nome
-- do board é a fonte server-side de product_name — emenda 1).
INSERT INTO public.kanban_boards (id, slug, name)
VALUES ('cd000000-0000-0000-0000-00000000b100'::uuid,'cd-conc-prod','CD Concessão Produto')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kanban_columns (id, board_id, title, position)
VALUES ('cd000000-0000-0000-0000-00000000c100'::uuid,
        'cd000000-0000-0000-0000-00000000b100'::uuid,'NOVOS CLIENTES',0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- HAPPY PATH 1 — admin concede produto novo (cliente A).
-- =============================================================================
SELECT _cd_set('cd000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE _cd_conc ON COMMIT DROP AS
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c1000'::uuid,
    'cd-conc-prod',
    'risco_churn'::public.concessao_motivo,
    NULL
  ) AS id;

SELECT isnt(
  (SELECT id FROM _cd_conc), NULL,
  'admin concede: RPC retorna o uuid da concessão criada');

SELECT is(
  (SELECT status::text FROM public.concessoes WHERE id = (SELECT id FROM _cd_conc)),
  'ativa', 'concessão criada com status=ativa');

SELECT is(
  (SELECT motivo::text FROM public.concessoes WHERE id = (SELECT id FROM _cd_conc)),
  'risco_churn', 'concessão guarda o motivo passado (risco_churn)');

SELECT is(
  (SELECT granted_by FROM public.concessoes WHERE id = (SELECT id FROM _cd_conc)),
  'cd000000-0000-0000-0000-0000000000a1'::uuid,
  'concessão.granted_by = caller (admin)');

SELECT is(
  (SELECT monthly_value FROM public.concessoes WHERE id = (SELECT id FROM _cd_conc)),
  0::numeric, 'concessão.monthly_value = 0 (não infla MRR)');

SELECT is(
  (SELECT product_name FROM public.concessoes WHERE id = (SELECT id FROM _cd_conc)),
  'CD Concessão Produto',
  'product_name resolvido server-side = kanban_boards.name do slug (emenda 1)');

-- ENTREGA: produto entra em contracted_products.
SELECT ok(
  (SELECT 'cd-conc-prod' = ANY(contracted_products) FROM public.clients
     WHERE id='cd000000-0000-0000-0000-0000000c1000'::uuid),
  'entrega: contracted_products do cliente contém o slug concedido');

-- ENTREGA: linha financeiro com monthly_value = 0.
SELECT is(
  (SELECT monthly_value FROM public.financeiro_active_clients
     WHERE client_id='cd000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cd-conc-prod'),
  0::numeric, 'entrega: financeiro_active_clients.monthly_value = 0');

-- ENTREGA: card no board do slug, coluna novos-clientes, created_by = granter.
SELECT is(
  (SELECT count(*)::int FROM public.kanban_cards
     WHERE board_id='cd000000-0000-0000-0000-00000000b100'::uuid
       AND column_id='cd000000-0000-0000-0000-00000000c100'::uuid
       AND client_id='cd000000-0000-0000-0000-0000000c1000'::uuid
       AND created_by='cd000000-0000-0000-0000-0000000000a1'::uuid),
  1, 'entrega: card de board gerado na coluna novos-clientes, created_by=granter');

-- =============================================================================
-- SUPRESSÃO DE DINHEIRO (assert central, ADR 0009 §1) — APÓS a concessão acima.
--   Zero comissão (via upsells do cliente) E zero variação de MRR.
-- =============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.upsell_commissions uc
     JOIN public.upsells u ON u.id = uc.upsell_id
    WHERE u.client_id = 'cd000000-0000-0000-0000-0000000c1000'::uuid),
  0, 'SUPRESSÃO: nenhuma upsell_commissions gerada pela concessão');

SELECT is(
  (SELECT count(*)::int FROM public.mrr_changes
     WHERE client_id = 'cd000000-0000-0000-0000-0000000c1000'::uuid),
  0, 'SUPRESSÃO: nenhuma mrr_changes gerada pela concessão');

-- =============================================================================
-- HAPPY PATH 2 — CS DONO da carteira concede (cliente B; sem board -> fallback).
-- =============================================================================
RESET ROLE;
SELECT _cd_set('cd000000-0000-0000-0000-0000000000c1'::uuid);
SET LOCAL ROLE authenticated;

SELECT lives_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c2000'::uuid,
    'cd-sem-board',
    'compensacao_falha'::public.concessao_motivo,
    NULL)
$$, 'CS dono da carteira concede sem erro');

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE client_id='cd000000-0000-0000-0000-0000000c2000'::uuid
       AND product_slug='cd-sem-board' AND status='ativa'),
  1, 'CS dono: concessão ativa criada para o cliente B');

SELECT is(
  (SELECT product_name FROM public.concessoes
     WHERE client_id='cd000000-0000-0000-0000-0000000c2000'::uuid
       AND product_slug='cd-sem-board'),
  'cd-sem-board', 'fallback: sem board pro slug, product_name = slug (emenda 1)');

-- =============================================================================
-- AUTORIZAÇÃO — role errada (gestor_ads) -> 42501.
-- =============================================================================
RESET ROLE;
SELECT _cd_set('cd000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c1000'::uuid,
    'cd-outro-prod',
    'cortesia_estrategica'::public.concessao_motivo,
    NULL)
$$, '42501', NULL, 'role errada (gestor_ads) -> permission denied (42501)');

-- =============================================================================
-- AUTORIZAÇÃO — CS FORA da carteira (assigned_sucesso_cliente != caller) -> 42501.
--   c2 é sucesso_cliente, mas NÃO é o dono do cliente A (dono = c1).
-- =============================================================================
RESET ROLE;
SELECT _cd_set('cd000000-0000-0000-0000-0000000000c2'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c1000'::uuid,
    'cd-outro-prod',
    'cortesia_estrategica'::public.concessao_motivo,
    NULL)
$$, '42501', NULL, 'CS fora da carteira -> permission denied (42501)');

-- =============================================================================
-- MOTIVO INVÁLIDO — literal fora do enum -> erro de cast (22P02).
-- =============================================================================
SELECT throws_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c1000'::uuid,
    'cd-outro-prod',
    'motivo_que_nao_existe'::public.concessao_motivo,
    NULL)
$$, '22P02', NULL, 'motivo fora do enum -> erro de cast (22P02)');

-- =============================================================================
-- ATOMICIDADE / ANTI-ÓRFÃO — cliente inexistente -> RAISE; nada gravado.
--   Como admin (passa autorização? não: _concessao_pode_conceder p/ admin é true
--   independente do cliente -> chega no guard anti-órfão). Garante P0001 e zero linha.
-- =============================================================================
RESET ROLE;
SELECT _cd_set('cd000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-00000000dead'::uuid,
    'cd-orfao-prod',
    'risco_churn'::public.concessao_motivo,
    NULL)
$$, 'P0001', NULL, 'cliente inexistente -> RAISE (anti-órfão)');

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE client_id='cd000000-0000-0000-0000-00000000dead'::uuid),
  0, 'atomicidade: cliente inexistente NÃO gravou concessão (sem efeito parcial)');

-- =============================================================================
-- CONFLITO — produto já em contracted_products -> RAISE; nenhuma concessão nova.
--   Cliente A já tem 'cd-conc-prod' (entregue no happy path 1).
-- =============================================================================
SELECT throws_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c1000'::uuid,
    'cd-conc-prod',
    'risco_churn'::public.concessao_motivo,
    NULL)
$$, 'P0001', NULL, 'conflito: produto já contratado -> RAISE (P0001, não duplica)');

-- Exatamente 1 concessão de cd-conc-prod no cliente A (a 2ª tentativa não criou).
SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE client_id='cd000000-0000-0000-0000-0000000c1000'::uuid
       AND product_slug='cd-conc-prod'),
  1, 'conflito já-contratado: nenhuma concessão extra criada');

-- =============================================================================
-- CONFLITO — concessão ATIVA duplicada (mesmo slug ativo) -> RAISE.
--   Cliente B já tem concessão ativa de 'cd-sem-board' (happy path 2). Segunda
--   tentativa do MESMO slug bate o guard 2 (concessão ativa dup) ANTES do
--   guard 1 não pegar (slug já está em contracted_products também — ambos guards
--   protegem; aqui provamos que conceder de novo o mesmo slug ativo BLOQUEIA).
-- =============================================================================
RESET ROLE;
SELECT _cd_set('cd000000-0000-0000-0000-0000000000c1'::uuid);
SET LOCAL ROLE authenticated;

SELECT throws_ok($$
  SELECT public.conceder_produto(
    'cd000000-0000-0000-0000-0000000c2000'::uuid,
    'cd-sem-board',
    'risco_churn'::public.concessao_motivo,
    NULL)
$$, 'P0001', NULL, 'conflito: concessão ativa duplicada (mesmo slug) -> RAISE (P0001)');

SELECT is(
  (SELECT count(*)::int FROM public.concessoes
     WHERE client_id='cd000000-0000-0000-0000-0000000c2000'::uuid
       AND product_slug='cd-sem-board'),
  1, 'conflito ativa-dup: continua exatamente 1 concessão (não duplicou)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
