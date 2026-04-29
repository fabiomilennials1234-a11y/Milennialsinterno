-- 20260430200000_remove_atrizes_gravacao.sql
--
-- Remove completamente o domínio "Gravação PRO+" (atrizes-gravacao) do sistema.
-- Audit prévio: 0 users com role atrizes_gravacao, 0 cards, 0 briefings,
-- 0 notifications. Apenas 1 board vazio.
--
-- Mantém o valor 'atrizes_gravacao' no enum user_role (Postgres não permite
-- DROP de valor de enum sem reescrever; preservamos para histórico).

BEGIN;

-- ── 1. Drop tabelas específicas do domínio ──────────────────────────────

DROP TABLE IF EXISTS public.atrizes_completion_notifications CASCADE;
DROP TABLE IF EXISTS public.atrizes_briefings              CASCADE;

-- ── 2. Drop board (cascade limpa colunas/cards se houver) ───────────────

DELETE FROM public.kanban_boards WHERE page_slug = 'atrizes-gravacao' OR slug ILIKE '%atrizes%';

-- ── 3. Remove de app_pages e user_page_grants ───────────────────────────

DELETE FROM public.user_page_grants WHERE page_slug = 'atrizes-gravacao';
DELETE FROM public.app_pages        WHERE slug      = 'atrizes-gravacao';

-- ── 4. Remove overrides ────────────────────────────────────────────────

DELETE FROM public.user_action_overrides WHERE page_slug = 'atrizes-gravacao';

-- ── 5. Remove matriz em can_operate_kanban_card ────────────────────────

CREATE OR REPLACE FUNCTION public.can_operate_kanban_card(_user_id uuid, _board_id uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
  v_page_slug text;
  v_action text := lower(coalesce(_action, ''));
  v_override_granted boolean;
BEGIN
  IF _user_id IS NULL OR _board_id IS NULL OR v_action = '' THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF NOT public.can_view_board(_user_id, _board_id) THEN
    RETURN false;
  END IF;

  SELECT page_slug INTO v_page_slug
  FROM public.kanban_boards
  WHERE id = _board_id;

  IF v_page_slug IS NOT NULL THEN
    SELECT granted INTO v_override_granted
    FROM public.user_action_overrides
    WHERE user_id = _user_id
      AND page_slug = v_page_slug
      AND action = v_action;

    IF FOUND THEN
      RETURN v_override_granted;
    END IF;
  END IF;

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_page_slug = 'design' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','design','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'editor-video' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','editor_video','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'devs' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','devs','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'produtora' THEN
    IF v_action IN ('archive', 'delete', 'edit_briefing') THEN
      RETURN v_role = ANY(ARRAY['gestor_ads','produtora','sucesso_cliente']);
    END IF;
    IF v_action IN ('create', 'move') THEN
      RETURN v_role = ANY(ARRAY['gestor_ads','produtora','sucesso_cliente','editor_video']);
    END IF;
    RETURN false;
  END IF;
  IF v_page_slug = 'rh' THEN
    RETURN v_role = ANY(ARRAY['rh','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'financeiro' THEN
    RETURN v_role = ANY(ARRAY['financeiro']);
  END IF;
  IF v_page_slug = 'gestor-crm' THEN
    RETURN v_role = ANY(ARRAY['gestor_crm','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'outbound' THEN
    RETURN v_role = ANY(ARRAY['outbound','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'consultor-mktplace' THEN
    RETURN v_role = ANY(ARRAY['consultor_mktplace']);
  END IF;
  IF v_page_slug = 'consultor-comercial' THEN
    RETURN v_role = ANY(ARRAY['consultor_comercial','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'gestor-ads' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'cadastro-clientes' THEN
    RETURN v_role = ANY(ARRAY['sucesso_cliente']);
  END IF;

  RETURN false;
END;
$function$;

COMMIT;
