-- 20260430160000_cleanup_orphan_person_columns_rpc.sql
--
-- RPC: limpa colunas BY-* / JUSTIFICATIVA(*) cujos donos nao existem mais.
--
-- Boards especializados criam colunas BY <NOME> e JUSTIFICATIVA (<NOME>)
-- por usuario do role correspondente. Quando o usuario e removido, as
-- colunas ficam orfas. Frontend ja filtra na renderizacao, mas o DB acumula.
--
-- Esta RPC permite ao admin executar cleanup manual. So deleta colunas
-- com 0 cards (defensivo — preserva historico).
--
-- Apenas admins podem chamar.

BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_person_columns()
RETURNS TABLE(deleted_count int, deleted_titles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_deleted_count int := 0;
  v_deleted_titles text[] := ARRAY[]::text[];
  v_col record;
  v_card_count int;
  v_active_names text[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'only admins can cleanup orphan columns' USING ERRCODE = '42501';
  END IF;

  -- Itera colunas BY/JUSTIFICATIVA de boards especializados.
  FOR v_col IN
    SELECT
      kc.id,
      kc.title,
      kc.board_id,
      kb.page_slug,
      CASE kb.page_slug
        WHEN 'design'           THEN 'design'::text
        WHEN 'editor-video'     THEN 'editor_video'::text
        WHEN 'devs'             THEN 'devs'::text
        WHEN 'atrizes-gravacao' THEN 'atrizes_gravacao'::text
        WHEN 'produtora'        THEN 'produtora'::text
        ELSE NULL
      END AS role_for_board
    FROM public.kanban_columns kc
    JOIN public.kanban_boards kb ON kb.id = kc.board_id
    WHERE kb.page_slug IN ('design','editor-video','devs','atrizes-gravacao','produtora')
      AND (kc.title LIKE 'BY %' OR kc.title LIKE 'JUSTIFICATIVA (%')
  LOOP
    -- Pula se nao mapeado (defensivo).
    IF v_col.role_for_board IS NULL THEN CONTINUE; END IF;

    -- Lista nomes ATIVOS do role do board (uppercase).
    SELECT array_agg(upper(p.name))
      INTO v_active_names
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role::text = v_col.role_for_board;

    -- Extrai nome do title.
    DECLARE
      v_person_name text;
      v_is_orphan boolean;
    BEGIN
      IF v_col.title LIKE 'JUSTIFICATIVA (%' THEN
        v_person_name := upper(trim(substring(v_col.title FROM 'JUSTIFICATIVA \(([^)]+)\)')));
      ELSE
        v_person_name := upper(trim(substring(v_col.title FROM '^BY\s+(.+)$')));
      END IF;

      v_is_orphan := v_person_name IS NOT NULL
        AND (v_active_names IS NULL OR NOT (v_person_name = ANY(v_active_names)));

      IF NOT v_is_orphan THEN CONTINUE; END IF;

      -- So deleta se 0 cards na coluna (preserva historico).
      SELECT COUNT(*)::int INTO v_card_count
      FROM public.kanban_cards
      WHERE column_id = v_col.id;

      IF v_card_count > 0 THEN CONTINUE; END IF;

      DELETE FROM public.kanban_columns WHERE id = v_col.id;
      v_deleted_count := v_deleted_count + 1;
      v_deleted_titles := array_append(v_deleted_titles, v_col.title);
    END;
  END LOOP;

  RETURN QUERY SELECT v_deleted_count, v_deleted_titles;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_orphan_person_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_person_columns() TO authenticated;

COMMENT ON FUNCTION public.cleanup_orphan_person_columns() IS
  'Limpa colunas BY-*/JUSTIFICATIVA(*) cujos donos nao existem mais. Defensivo: so deleta colunas com 0 cards. Apenas admins.';

COMMIT;
