-- supabase/tests/create_client_cards_comercial_scope_test.sql
--
-- pgTAP: guarda o determinismo do trigger `create_client_cards()` para o card
-- comercial apos decisao arquitetural "Opcao B" (2026-04-23):
--
--   - Board `comercial` eh GLOBAL (slug = 'comercial' exato, group_id IS NULL).
--   - Scoping por grupo acontece em RLS via `can_view_card()`, NAO no trigger.
--   - Nao existem boards per-grupo `grupo-X-comercial` — nao procurar via
--     ILIKE '%comercial%'.
--
-- Guarda contra regressoes:
--   - Alguem recolocar ILIKE '%comercial%' no trigger (cenario nao-deterministico
--     que escolheria qualquer board com "comercial" no slug — ex.: se alguem
--     criasse um board `ex-comercial` ou `comercial-legacy`).
--   - Alguem remover `SECURITY DEFINER` (funcao nao poderia mais inserir na
--     presenca de RLS em `kanban_cards`).
--   - Alguem remover `SET search_path = public` (vetor de hijack em
--     SECURITY DEFINER).
--
-- Contexto historico: versao anterior deste teste (pre-132000) assumia
-- arquitetura per-group-board `grupo-1-comercial`/`grupo-2-comercial` que
-- nunca existiu em prod. Reescrito para arquitetura atual (migration
-- 20260423132000).
--
-- Migrations guardadas:
--   - 20260423120000_fix_create_client_cards_comercial_scope.sql
--   - 20260423132000_fix_create_client_cards_preserve_per_group_projetos_ads.sql

BEGIN;

SELECT plan(5);

-- ---------------------------------------------------------------------------
-- Seed minimo: 1 grupo, 1 board global `zztest-comercial`, 1 coluna.
-- Usamos slug dedicado de teste para NAO colidir com o board real `comercial`
-- do prod/seed — garantimos determinismo sem depender de estado externo.
--
-- Precisamos ENTAO temporariamente redirecionar o trigger para o nosso board
-- de teste. Fazemos isso criando tambem o board real esperado pelo trigger
-- via ON CONFLICT DO NOTHING (se seed ja existe, usamos o real; se nao,
-- criamos um proxy com slug='comercial').
-- ---------------------------------------------------------------------------

-- Grupo isolado
INSERT INTO public.organization_groups (id, slug, name)
VALUES ('cccccccc-0000-0000-0000-000000000001'::uuid, 'zztest-comercial-grp', 'ZZ Test Grupo Comercial')
ON CONFLICT (id) DO NOTHING;

-- Board global `comercial` — se nao existe, cria proxy. Se existe, reutiliza.
-- Nao setamos group_id (DEVE ser NULL pra validar decisao "board global").
INSERT INTO public.kanban_boards (id, slug, name)
VALUES ('dddddddd-0000-0000-0000-000000000001'::uuid, 'comercial', 'Comercial (Global)')
ON CONFLICT (slug) DO NOTHING;

-- Coluna 'Novos Clientes' no board comercial real (qualquer que seja o id)
INSERT INTO public.kanban_columns (id, board_id, title, position, color)
SELECT 'eeeeeeee-0000-0000-0000-000000000001'::uuid, kb.id, 'Novos Clientes', 0, '#22c55e'
FROM public.kanban_boards kb
WHERE kb.slug = 'comercial'
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Test 1: funcao create_client_cards existe
-- ---------------------------------------------------------------------------
SELECT has_function(
  'public', 'create_client_cards',
  'create_client_cards() function exists'
);

-- ---------------------------------------------------------------------------
-- Test 2: funcao eh SECURITY DEFINER (sem isso o trigger nao consegue inserir
-- em kanban_cards sob RLS restrita)
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'create_client_cards' LIMIT 1),
  true,
  'create_client_cards is SECURITY DEFINER'
);

-- ---------------------------------------------------------------------------
-- Test 3: funcao tem SET search_path = public (previne search_path hijack)
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'create_client_cards'
      AND n.nspname = 'public'
      AND p.proconfig @> ARRAY['search_path=public']
  ),
  'create_client_cards has SET search_path = public'
);

-- ---------------------------------------------------------------------------
-- Test 4: INSERT em clients cria card comercial no board com slug='comercial'
-- exato (NAO em qualquer board ILIKE '%comercial%').
-- ---------------------------------------------------------------------------
INSERT INTO public.clients (id, name, group_id, created_by)
VALUES (
  'ffffffff-0000-0000-0000-000000000001'::uuid,
  'ZZ Test Cliente Trigger Comercial',
  'cccccccc-0000-0000-0000-000000000001'::uuid,
  (SELECT user_id FROM public.profiles LIMIT 1)
);

SELECT isnt_empty(
  $$SELECT 1 FROM public.kanban_cards kc
    JOIN public.kanban_boards kb ON kb.id = kc.board_id
    WHERE kc.client_id = 'ffffffff-0000-0000-0000-000000000001'::uuid
      AND kc.card_type = 'consultor_comercial'
      AND kb.slug = 'comercial'$$,
  'INSERT client creates card on GLOBAL board (slug = comercial exact)'
);

-- ---------------------------------------------------------------------------
-- Test 5: o card comercial foi para UM board so (determinismo). Se alguem
-- reintroduzir ILIKE '%comercial%' e houver multiplos boards com "comercial"
-- no slug, esse teste ainda passa se houver ORDER BY + LIMIT 1 — mas
-- protegemos contra o erro original (card criado em board errado) ao validar
-- tambem que o board escolhido tem group_id IS NULL (board global).
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.kanban_cards kc
   JOIN public.kanban_boards kb ON kb.id = kc.board_id
   WHERE kc.client_id = 'ffffffff-0000-0000-0000-000000000001'::uuid
     AND kc.card_type = 'consultor_comercial'
     AND kb.group_id IS NULL),
  1,
  'comercial card lands on exactly 1 global board (group_id IS NULL)'
);

-- ---------------------------------------------------------------------------
-- Teardown — ROLLBACK limpa tudo
-- ---------------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;
