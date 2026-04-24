-- =============================================================================
-- AUDITORIA LIVE — Maycon (consultor_comercial, Grupo 2) ve 114 cards em
-- /kanban/comercial coluna "Novos Clientes" mas 0 em outras colunas.
-- Data: 2026-04-23
-- Contexto: db-specialist nao teve acesso DB live (sem MCP, sem Docker, sem
-- creds em .env). Estas queries sao pra rodar em staging (prioridade) ou prod
-- (read-only). Rodar como role `postgres` ou `service_role` onde indicado —
-- queries que simulam JWT precisam rodar em transaction com SET LOCAL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Q1: Estado real dos boards comerciais
-- Pergunta: group_id/squad_id/category_id dos boards 'comercial',
--           'grupo-1-comercial', 'grupo-2-comercial'? allowed_roles e page_slug
--           foram populados?
-- -----------------------------------------------------------------------------
SELECT
  id,
  slug,
  name,
  group_id,
  squad_id,
  category_id,
  allowed_roles,
  page_slug,
  created_at
FROM public.kanban_boards
WHERE slug ILIKE '%comercial%'
ORDER BY slug;

-- -----------------------------------------------------------------------------
-- Q2: Perfil do Maycon + roles
-- Pergunta: user_id, group_id, squad_id, category_id, lista de roles do Maycon?
-- -----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.name,
  p.email,
  p.group_id,
  p.squad_id,
  p.category_id,
  p.is_coringa,
  p.additional_pages,
  array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL) AS roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE p.name ILIKE 'Maycon%' OR p.email ILIKE '%maycon%'
GROUP BY p.user_id, p.name, p.email, p.group_id, p.squad_id,
         p.category_id, p.is_coringa, p.additional_pages;

-- -----------------------------------------------------------------------------
-- Q3: Policies live em kanban_cards e kanban_boards
-- Pergunta: quais policies SELECT estao realmente ativas? Ha policy permissiva
--           nao rastreavel via migrations (ex.: hotfix manual via Supabase Dashboard)?
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('kanban_cards', 'kanban_boards', 'kanban_columns')
ORDER BY tablename, cmd, policyname;

-- -----------------------------------------------------------------------------
-- Q3b: Definicao atual de can_view_board em prod (vs migration 20260420180000)
-- Pergunta: a funcao em prod tem o fix de ler user_roles, ou tem lixo antigo?
-- -----------------------------------------------------------------------------
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('can_view_board', 'can_view_user', 'is_ceo', 'is_executive', 'is_admin');

-- -----------------------------------------------------------------------------
-- Q4: Count cards por board comercial (bypass RLS: rode como `postgres` ou
--     `service_role`). Revela distribuicao real.
-- -----------------------------------------------------------------------------
SELECT
  b.slug,
  b.id              AS board_id,
  b.group_id,
  b.squad_id,
  count(c.*)        AS total_cards,
  count(c.*) FILTER (WHERE c.archived = false)                AS active_cards,
  count(c.*) FILTER (WHERE c.column_id IN (
    SELECT id FROM public.kanban_columns kc
    WHERE kc.board_id = b.id AND kc.title = 'Novos Clientes'
  )) AS novos_clientes_cards
FROM public.kanban_boards b
LEFT JOIN public.kanban_cards c ON c.board_id = b.id
WHERE b.slug ILIKE '%comercial%'
GROUP BY b.slug, b.id, b.group_id, b.squad_id
ORDER BY b.slug;

-- -----------------------------------------------------------------------------
-- Q4b: Distribuicao de cards por coluna no board 'comercial' global
-- -----------------------------------------------------------------------------
SELECT
  kc.title           AS column_title,
  kc.position        AS column_position,
  count(kk.*)        AS cards
FROM public.kanban_columns kc
LEFT JOIN public.kanban_cards kk ON kk.column_id = kc.id AND kk.archived = false
WHERE kc.board_id = (SELECT id FROM public.kanban_boards WHERE slug = 'comercial' LIMIT 1)
GROUP BY kc.id, kc.title, kc.position
ORDER BY kc.position;

-- -----------------------------------------------------------------------------
-- Q5: Simula RLS com JWT do Maycon. SUBSTITUIR <maycon_uuid> pelo user_id
--     retornado em Q2. Deve rodar em transacao isolada.
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
-- Substituir o UUID abaixo pelo user_id retornado em Q2
SET LOCAL "request.jwt.claims" = '{"sub":"<maycon_uuid>","role":"authenticated"}';

-- Q5a: quais boards ele realmente ve?
SELECT
  b.slug,
  b.id,
  b.group_id,
  b.squad_id,
  b.category_id
FROM public.kanban_boards b
WHERE b.slug ILIKE '%comercial%'
ORDER BY b.slug;

-- Q5b: quantos cards ele ve em cada board comercial?
SELECT
  c.board_id,
  b.slug,
  count(*) AS visible_cards
FROM public.kanban_cards c
JOIN public.kanban_boards b ON b.id = c.board_id
WHERE b.slug ILIKE '%comercial%'
GROUP BY c.board_id, b.slug
ORDER BY b.slug;

-- Q5c: can_view_board direto, boolean por board
SELECT
  b.slug,
  b.id,
  public.can_view_board(auth.uid(), b.id) AS can_view
FROM public.kanban_boards b
WHERE b.slug ILIKE '%comercial%'
ORDER BY b.slug;

-- Q5d: has_page_access — sanity check do novo modelo
SELECT public.has_page_access(auth.uid(), 'consultor-comercial') AS has_page_access;

ROLLBACK;

-- -----------------------------------------------------------------------------
-- Q6: Maycon esta em squad_members? (tabela de vinculo)
--     Se nao estiver e squad_id do profile for NULL, sidebar mostra "Sem usuarios"
--     corretamente para os squads, pois filtro eh por profiles.squad_id.
-- -----------------------------------------------------------------------------
-- Primeiro: squad_members existe?
SELECT EXISTS (
  SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'squad_members'
) AS squad_members_table_exists;

-- Se existir:
-- SELECT sm.*, p.name, s.slug AS squad_slug
-- FROM public.squad_members sm
-- JOIN public.profiles p ON p.user_id = sm.user_id
-- JOIN public.squads s ON s.id = sm.squad_id
-- WHERE p.name ILIKE 'Maycon%';

-- -----------------------------------------------------------------------------
-- Q7: Quem sao os usuarios com squad_id setado no Grupo 2? (diagnostica
--     "Sem usuarios" no sidebar de Grupo 2 > Squad 1/Squad 2)
-- -----------------------------------------------------------------------------
SELECT
  og.slug                AS grupo_slug,
  s.slug                 AS squad_slug,
  s.id                   AS squad_id,
  count(p.*) FILTER (WHERE p.squad_id = s.id) AS users_vinculados
FROM public.organization_groups og
JOIN public.squads s ON s.group_id = og.id
LEFT JOIN public.profiles p ON p.squad_id = s.id
WHERE og.slug = 'grupo-2'
GROUP BY og.slug, s.slug, s.id
ORDER BY s.slug;

-- -----------------------------------------------------------------------------
-- Q8: Historico de cards comerciais pos-reset (02/mar) — origem das 114 linhas
-- -----------------------------------------------------------------------------
SELECT
  to_char(c.created_at, 'YYYY-MM') AS mes,
  count(*) AS cards_criados,
  count(DISTINCT c.client_id) AS clientes_distintos,
  count(*) FILTER (WHERE c.card_type = 'consultor_comercial') AS card_type_comercial,
  count(*) FILTER (WHERE c.created_by IS NULL) AS sem_created_by
FROM public.kanban_cards c
JOIN public.kanban_boards b ON b.id = c.board_id
WHERE b.slug = 'comercial'
  AND c.created_at > '2026-03-02'::timestamptz
GROUP BY to_char(c.created_at, 'YYYY-MM')
ORDER BY 1;
