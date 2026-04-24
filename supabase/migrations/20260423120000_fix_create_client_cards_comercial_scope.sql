-- 20260423120000_fix_create_client_cards_comercial_scope.sql
--
-- Fix determinismo de lookup de board no trigger `create_client_cards()`.
--
-- CONTEXTO (decisao do fundador, 2026-04-23):
-- A arquitetura e "board comercial GLOBAL + scoping por client.group_id via RLS"
-- (Opcao B). Boards per-grupo (grupo-1-comercial, grupo-2-comercial) NAO existem
-- em prod e nao serao criados. Scoping e feito em runtime via `can_view_card()`
-- (ver migration 20260423131000) que filtra cards pelo group_id do client.
--
-- PROBLEMA QUE ESTA MIGRATION RESOLVE:
-- A versao anterior de `create_client_cards()` fazia:
--   SELECT id FROM kanban_boards WHERE slug ILIKE '%comercial%' LIMIT 1;
-- sem ORDER BY, portanto escolha nao deterministica se houver multiplos boards
-- com "comercial" no slug (ex.: 'comercial', 'comercial-v2'). Hoje so existe
-- 'comercial' em prod, mas o SQL e fragil — basta um board novo aparecer pra
-- quebrar sem aviso.
--
-- FIX: lookup por match exato `slug = 'comercial'` (alem de normalizar os
-- outros 3 boards: 'projetos', 'ads', 'financeiro'/'financeiro-board').
-- Nenhum backfill — cards ja estao no board certo (o unico que existe).
-- Nenhuma mudanca de escopo por grupo no trigger — o escopo vai pro RLS.
--
-- SEGURANCA:
--   - Trigger segue SECURITY DEFINER.
--   - Nenhuma policy RLS tocada nesta migration (ver 20260423130000 e 131000).
--   - Idempotente: CREATE OR REPLACE FUNCTION.

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
  -- Ads manager name
  SELECT name INTO v_ads_manager_name
  FROM public.profiles
  WHERE user_id = NEW.assigned_ads_manager
  LIMIT 1;

  -- Group slug
  SELECT slug INTO v_group_slug
  FROM public.organization_groups
  WHERE id = NEW.group_id;

  -- ---------------------------------------------------------------------------
  -- 1. Gestor de Projetos — board global 'projetos' (match exato)
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_board_gestor_projetos_id
  FROM public.kanban_boards
  WHERE slug = 'projetos'
  LIMIT 1;

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
  -- 2. Gestor de Ads — board global 'ads' (match exato)
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_board_gestor_ads_id
  FROM public.kanban_boards
  WHERE slug = 'ads'
  LIMIT 1;

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
  -- 3. Financeiro — preferir 'financeiro-board' (nome canonico do seed),
  --    fallback 'financeiro'. Ordem explicita com CASE WHEN ORDER BY.
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
  -- 4. Consultor Comercial — board global 'comercial' (match exato).
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
  'Cria cards nos 4 boards globais (projetos, ads, financeiro, comercial) quando cliente eh inserido. Redefinido em 20260423120000 para lookup deterministico por match exato de slug. Scoping por grupo e feito em RLS via can_view_card (ver 20260423131000).';

COMMIT;
