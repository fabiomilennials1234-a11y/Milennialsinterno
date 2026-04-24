-- 20260423132000_fix_create_client_cards_preserve_per_group_projetos_ads.sql
--
-- HOT-FIX para regressao introduzida em 20260423120000: o trigger
-- `create_client_cards()` foi simplificado para usar `slug = 'projetos'` e
-- `slug = 'ads'` (match exato), mas em prod NAO existem boards globais
-- 'projetos'/'ads' — apenas boards per-grupo/per-squad:
--   - grupo-1-projetos, grupo-2-projetos
--   - grupo-2-squad-1-ads, grupo-2-squad-2-ads
--
-- Validacao live (dry-run com INSERT + ROLLBACK de cliente teste, 2026-04-23):
--   - comercial:  1 card criado (OK — board unico 'comercial')
--   - financeiro: 1 card criado (OK — board unico 'financeiro')
--   - projetos:   0 cards (REGRESSAO — perdeu per-group lookup)
--   - ads:        0 cards (REGRESSAO — perdeu per-squad lookup)
--
-- FIX: restaurar lookup per-group para projetos e per-squad para ads,
-- mantendo o fix deterministico de comercial (slug = 'comercial' exato).
-- Financeiro continua com ORDER BY CASE (board unico em prod).
--
-- Precondicao: migration 20260423120000 ja aplicada em prod (idempotente via
-- CREATE OR REPLACE FUNCTION — esta migration sobrescreve em cima).

BEGIN;

CREATE OR REPLACE FUNCTION public.create_client_cards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_gestor_projetos_id UUID;
  v_board_gestor_ads_id UUID;
  v_board_financeiro_id UUID;
  v_board_comercial_id UUID;
  v_column_id UUID;
  v_ads_manager_name TEXT;
  v_group_slug TEXT;
BEGIN
  SELECT name INTO v_ads_manager_name
  FROM public.profiles
  WHERE user_id = NEW.assigned_ads_manager
  LIMIT 1;

  SELECT slug INTO v_group_slug
  FROM public.organization_groups
  WHERE id = NEW.group_id;

  -- ---------------------------------------------------------------------------
  -- 1. Gestor de Projetos — preferir board do grupo do cliente.
  --    Ordem: exact per-group slug → any slug ILIKE '%projetos%' com group_id
  --    match → fallback global (nao deve acontecer em prod).
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_board_gestor_projetos_id
  FROM public.kanban_boards
  WHERE group_id = NEW.group_id AND slug ILIKE '%projetos%'
  ORDER BY
    CASE
      WHEN v_group_slug IS NOT NULL AND slug = v_group_slug || 'projetos' THEN 0
      WHEN v_group_slug IS NOT NULL AND slug = 'grupo-' || regexp_replace(v_group_slug, '^grupo-', '') || 'projetos' THEN 0
      ELSE 1
    END,
    slug
  LIMIT 1;

  IF v_board_gestor_projetos_id IS NULL THEN
    SELECT id INTO v_board_gestor_projetos_id
    FROM public.kanban_boards
    WHERE slug = 'projetos'
    LIMIT 1;
  END IF;

  IF v_board_gestor_projetos_id IS NOT NULL THEN
    SELECT id INTO v_column_id FROM public.kanban_columns
    WHERE board_id = v_board_gestor_projetos_id AND title = 'Novos Clientes' LIMIT 1;

    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id FROM public.kanban_columns
      WHERE board_id = v_board_gestor_projetos_id ORDER BY position ASC LIMIT 1;
    END IF;

    IF v_column_id IS NOT NULL THEN
      INSERT INTO public.kanban_cards (
        board_id, column_id, title, description, client_id, card_type, created_by, priority
      ) VALUES (
        v_board_gestor_projetos_id, v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Grupo: ' || COALESCE(v_group_slug, 'N/A') || E'\n' ||
        'Informacoes: ' || COALESCE(NEW.general_info, 'N/A'),
        NEW.id, 'gestor_projetos', NEW.created_by, 'medium'
      );
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Gestor de Ads — preferir board do squad do cliente.
  --    Ordem: squad_id match → slug ILIKE '%ads%' qualquer → fallback global.
  -- ---------------------------------------------------------------------------
  IF NEW.squad_id IS NOT NULL THEN
    SELECT id INTO v_board_gestor_ads_id
    FROM public.kanban_boards
    WHERE squad_id = NEW.squad_id AND slug ILIKE '%ads%'
    ORDER BY slug
    LIMIT 1;
  END IF;

  IF v_board_gestor_ads_id IS NULL THEN
    SELECT id INTO v_board_gestor_ads_id
    FROM public.kanban_boards
    WHERE slug = 'ads'
    LIMIT 1;
  END IF;

  IF v_board_gestor_ads_id IS NOT NULL THEN
    SELECT id INTO v_column_id FROM public.kanban_columns
    WHERE board_id = v_board_gestor_ads_id AND title = 'Novos Clientes' LIMIT 1;

    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id FROM public.kanban_columns
      WHERE board_id = v_board_gestor_ads_id ORDER BY position ASC LIMIT 1;
    END IF;

    IF v_column_id IS NOT NULL THEN
      INSERT INTO public.kanban_cards (
        board_id, column_id, title, description, client_id, card_type, created_by, assigned_to, priority
      ) VALUES (
        v_board_gestor_ads_id, v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Investimento Previsto: R$ ' || COALESCE(NEW.expected_investment::TEXT, 'N/A') || E'\n' ||
        'Gestor de Ads: ' || COALESCE(v_ads_manager_name, 'N/A'),
        NEW.id, 'gestor_ads', NEW.created_by, NEW.assigned_ads_manager, 'high'
      );
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Financeiro — board unico. Prefere 'financeiro-board' se existir.
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_board_financeiro_id
  FROM public.kanban_boards
  WHERE slug IN ('financeiro-board', 'financeiro')
  ORDER BY CASE WHEN slug = 'financeiro-board' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_board_financeiro_id IS NOT NULL THEN
    SELECT id INTO v_column_id FROM public.kanban_columns
    WHERE board_id = v_board_financeiro_id AND title = 'Novos Clientes' LIMIT 1;

    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id FROM public.kanban_columns
      WHERE board_id = v_board_financeiro_id ORDER BY position ASC LIMIT 1;
    END IF;

    IF v_column_id IS NOT NULL THEN
      INSERT INTO public.kanban_cards (
        board_id, column_id, title, description, client_id, card_type, created_by, priority
      ) VALUES (
        v_board_financeiro_id, v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Razao Social: ' || COALESCE(NEW.razao_social, 'N/A') || E'\n' ||
        'CNPJ: ' || COALESCE(NEW.cnpj, 'N/A') || E'\n' ||
        'CPF: ' || COALESCE(NEW.cpf, 'N/A') || E'\n' ||
        'Investimento: R$ ' || COALESCE(NEW.expected_investment::TEXT, 'N/A'),
        NEW.id, 'financeiro', NEW.created_by, 'medium'
      );
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4. Comercial — board GLOBAL (slug = 'comercial' exato, deterministico).
  --    Scoping por grupo acontece em RLS via can_view_card (20260423131000).
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_board_comercial_id
  FROM public.kanban_boards
  WHERE slug = 'comercial'
  LIMIT 1;

  IF v_board_comercial_id IS NOT NULL THEN
    SELECT id INTO v_column_id FROM public.kanban_columns
    WHERE board_id = v_board_comercial_id AND title = 'Novos Clientes' LIMIT 1;

    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id FROM public.kanban_columns
      WHERE board_id = v_board_comercial_id ORDER BY position ASC LIMIT 1;
    END IF;

    IF v_column_id IS NOT NULL THEN
      INSERT INTO public.kanban_cards (
        board_id, column_id, title, description, client_id, card_type, created_by, priority
      ) VALUES (
        v_board_comercial_id, v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Informacoes: ' || COALESCE(NEW.general_info, 'N/A'),
        NEW.id, 'consultor_comercial', NEW.created_by, 'medium'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_client_cards() IS
  'Cria cards nos 4 boards quando cliente eh inserido. Projetos: per-group. Ads: per-squad. Financeiro: board unico. Comercial: global (RLS scoping via can_view_card). Hot-fix 20260423132000 restaura per-group/per-squad para projetos/ads apos regressao em 20260423120000.';

COMMIT;
