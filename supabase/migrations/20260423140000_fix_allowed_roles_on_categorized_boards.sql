-- 20260423140000_fix_allowed_roles_on_categorized_boards.sql
--
-- HOT-FIX P0 — Kanban Produtora (e Atrizes) renderiza tela vazia após RC4.
--
-- HISTORICO:
--   - 20260110190604 criou boards categorizados com slug `-board`:
--       - produtora-board (category_id = independent_categories.produtora)
--       - atrizes-board   (category_id = independent_categories.atrizes)
--       - rh-board        (category_id = independent_categories.rh)
--       - financeiro-board (category_id = independent_categories.financeiro)
--   - 20260110184318 ja havia criado versoes GLOBAIS com slug sem sufixo
--     (slug in 'produtora','atrizes','rh','financeiro') — coexistem em prod.
--   - 20260420170000_user_page_grants.sql (linhas 440-494) fez backfill de
--     allowed_roles[] APENAS nos slugs sem sufixo (WHERE slug = 'produtora',
--     WHERE slug = 'atrizes', etc). Os boards `-board` ficaram com
--     allowed_roles = '{}'.
--   - 20260423130000 dropou policies permissivas `USING (true)` em kanban_*.
--   - 20260423131000 estendeu can_view_board para avaliar allowed_roles,
--     PORÉM somente quando board_group_id IS NULL AND board_squad_id IS NULL
--     AND board_category_id IS NULL (linhas 119-124). Boards categorizados
--     nunca caem nesse ramo.
--
-- EFEITO BUG:
--   Frontend (src/components/produtora/ProdutoraKanbanBoard.tsx:26) consulta
--   `boardSlugLike: 'produtora-board'` — o board categorizado. can_view_board
--   retorna false para produtora/gestor_ads/outbound/sucesso_cliente/
--   editor_video (nenhum desses tem profile.category_id = produtora). Board
--   query devolve null → SpecializedKanbanBoard renderiza "Nenhum quadro de
--   produtora encontrado". Admins (is_ceo, gestor_projetos) veem OK via bypass.
--
-- FIX (duas partes):
--
--   PARTE A — Backfill allowed_roles[] nos 4 boards categorizados. Lista espelha
--   o backfill dos slugs globais em 20260420170000 + adiciona editor_video no
--   produtora-board (alinhado com PRODUTORA_BOARD_VIEWERS em
--   src/hooks/useProdutoraKanban.ts:26-34).
--
--   PARTE B — can_view_board: permitir allowed_roles como fallback ADICIONAL
--   em qualquer board (não só global). Se user nao matcha por squad/group/
--   category mas esta em allowed_roles → true. Preserva todos os paths
--   positivos anteriores; so estende os negativos.
--
-- SEGURANCA:
--   - allowed_roles e whitelist explicita por slug. Nenhum board recebe '*'.
--   - Policies SELECT em kanban_boards/columns/cards permanecem escopadas via
--     can_view_board/can_view_card — migration 20260423130000 mantem-se.
--   - can_view_card continua delegando para can_view_board em boards scoped
--     (20260423131000 linha 173-175) — escopo de client.group_id so aplica
--     em boards globais (produtora-board tem category_id → nao entra nessa
--     trilha). OK.
--
-- IMPACTO ESPERADO LIVE:
--   - Produtora, gestor_ads, outbound, sucesso_cliente, editor_video:
--     /kanban/produtora volta a renderizar.
--   - Atrizes: kanban de atrizes-board passa a responder para editor_video,
--     gestor_ads, outbound, sucesso_cliente, atrizes_gravacao.
--   - RH-board/financeiro-board: allowed_roles populado, mas rotas sao
--     redirecionadas em App.tsx (/kanban/rh → /rh); nao afeta UX atual.
--     Fix e preventivo pra consistencia.
--   - Admins (ceo/cto/gestor_projetos): inalterado (bypass).
--
-- ROLLBACK (emergencial):
--   UPDATE public.kanban_boards SET allowed_roles = '{}'
--     WHERE slug IN ('produtora-board','atrizes-board','rh-board','financeiro-board');
--   E restaurar can_view_board da migration 20260423131000 (ver pg_proc backup).

BEGIN;

-- =============================================================================
-- PARTE A — Backfill allowed_roles em boards categorizados
-- =============================================================================

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['produtora','gestor_ads','outbound','sucesso_cliente','editor_video'],
  page_slug = 'produtora'
WHERE slug = 'produtora-board'
  AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['atrizes_gravacao','editor_video','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'atrizes-gravacao'
WHERE slug = 'atrizes-board'
  AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['rh','sucesso_cliente'],
  page_slug = 'rh'
WHERE slug = 'rh-board'
  AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['financeiro'],
  page_slug = 'financeiro'
WHERE slug = 'financeiro-board'
  AND allowed_roles = '{}';

-- =============================================================================
-- PARTE B — can_view_board: allowed_roles como fallback adicional
-- =============================================================================
-- Mudanca cirurgica: condicao do branch allowed_roles passa de
--   `board_group_id IS NULL AND board_squad_id IS NULL AND board_category_id IS NULL`
-- para apenas `user_role = ANY(board_allowed_roles)`. Boards escopados agora
-- podem conceder acesso via allowed_roles TAMBEM, nao so por match de
-- squad/group/category. Semanticamente allowed_roles vira "whitelist aditiva".

CREATE OR REPLACE FUNCTION public.can_view_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_is_ceo boolean;
  user_role text;
  user_group_id uuid;
  user_squad_id uuid;
  user_category_id uuid;
  board_group_id uuid;
  board_squad_id uuid;
  board_category_id uuid;
  board_allowed_roles text[];
BEGIN
  -- CEO/CTO bypass
  SELECT public.is_ceo(_user_id) INTO user_is_ceo;
  IF user_is_ceo THEN
    RETURN true;
  END IF;

  -- Role principal do user
  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;

  -- gestor_projetos bypass
  IF user_role = 'gestor_projetos' THEN
    RETURN true;
  END IF;

  -- Escopo organizacional do user
  SELECT group_id, squad_id, category_id
    INTO user_group_id, user_squad_id, user_category_id
  FROM public.profiles WHERE user_id = _user_id;

  -- Escopo + allowed_roles do board
  SELECT group_id, squad_id, category_id, COALESCE(allowed_roles, ARRAY[]::text[])
    INTO board_group_id, board_squad_id, board_category_id, board_allowed_roles
  FROM public.kanban_boards WHERE id = _board_id;

  -- Board pertence ao squad do user
  IF user_squad_id IS NOT NULL AND board_squad_id = user_squad_id THEN
    RETURN true;
  END IF;

  -- Board coringa do grupo do user (squad null)
  IF user_group_id IS NOT NULL AND board_group_id = user_group_id AND board_squad_id IS NULL THEN
    RETURN true;
  END IF;

  -- Board da categoria independente do user
  IF user_category_id IS NOT NULL AND board_category_id = user_category_id THEN
    RETURN true;
  END IF;

  -- allowed_roles como whitelist aditiva (aplicavel a QUALQUER board, nao so globais).
  -- Fundador aprovou em 2026-04-23: allowed_roles agora e fallback valido mesmo
  -- quando board tem group_id/squad_id/category_id, desde que populado
  -- explicitamente. Backfills controlados via migration (nao auto-populado).
  IF user_role IS NOT NULL
     AND array_length(board_allowed_roles, 1) IS NOT NULL
     AND user_role = ANY(board_allowed_roles) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_view_board(uuid, uuid) IS
  'Autoriza acesso de leitura a um board. CEO/CTO/gestor_projetos bypass. Escopo por squad/group/category OU role em allowed_roles (whitelist aditiva, aplica a qualquer board). Atualizada em 20260423140000 para estender allowed_roles a boards categorizados (fix kanban produtora-board sem acesso apos RC4).';

COMMIT;
