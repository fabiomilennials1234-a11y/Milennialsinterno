-- 20260504220000_client_creative_usage.sql
--
-- Tabela de contagem de materiais (video/design) por cliente com granularidade
-- mensal. Modelo row-por-mes elimina necessidade de cron de reset.
-- RPC increment_client_creatives faz upsert atomico.
-- Tambem adiciona _creatives_quantity ao kanban_create_card.

BEGIN;

-- ============================================================
-- 1. Tabela client_creative_usage
-- ============================================================

CREATE TABLE public.client_creative_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  year_month    text NOT NULL,  -- 'YYYY-MM' formato fixo
  material_type text NOT NULL CHECK (material_type IN ('video', 'design')),
  used_count    integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, year_month, material_type)
);

CREATE INDEX idx_client_creative_usage_client_ym
  ON public.client_creative_usage (client_id, year_month);

ALTER TABLE public.client_creative_usage ENABLE ROW LEVEL SECURITY;

-- SELECT: mesmas regras de quem ve clientes (executivos, admins, ou assigned)
CREATE POLICY "client_creative_usage_select" ON public.client_creative_usage
  FOR SELECT TO authenticated
  USING (
    public.is_executive(auth.uid())
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_creative_usage.client_id
      AND (
        c.assigned_ads_manager = auth.uid()
        OR c.assigned_comercial = auth.uid()
        OR c.assigned_crm = auth.uid()
        OR c.assigned_outbound_manager = auth.uid()
        OR c.assigned_mktplace = auth.uid()::text
      )
    )
  );

-- Insert/Update/Delete somente via RPC SECURITY DEFINER

GRANT SELECT ON public.client_creative_usage TO authenticated;

-- ============================================================
-- 2. RPC increment_client_creatives
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_client_creatives(
  _client_id uuid,
  _material_type text,
  _quantity integer DEFAULT 1
)
RETURNS public.client_creative_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ym text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  v_row public.client_creative_usage;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF _material_type NOT IN ('video', 'design') THEN
    RAISE EXCEPTION 'invalid material_type' USING ERRCODE = '22023';
  END IF;

  IF _quantity < 1 THEN
    RAISE EXCEPTION 'quantity must be >= 1' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.client_creative_usage (client_id, year_month, material_type, used_count)
  VALUES (_client_id, v_ym, _material_type, _quantity)
  ON CONFLICT (client_id, year_month, material_type)
  DO UPDATE SET
    used_count = client_creative_usage.used_count + EXCLUDED.used_count,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_client_creatives(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_client_creatives(uuid, text, integer) TO authenticated;

-- ============================================================
-- 3. Extend kanban_create_card with _creatives_quantity
-- ============================================================

CREATE OR REPLACE FUNCTION public.kanban_create_card(
  _board_id uuid,
  _column_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _priority text DEFAULT 'medium',
  _due_date date DEFAULT NULL,
  _assigned_to uuid DEFAULT NULL,
  _tags text[] DEFAULT NULL,
  _status text DEFAULT NULL,
  _card_type text DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _creatives_quantity integer DEFAULT NULL
)
RETURNS public.kanban_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_column_board_id uuid;
  v_position integer;
  v_card public.kanban_cards;
  v_column_title text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NULLIF(BTRIM(_title), '') IS NULL THEN
    RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
  END IF;

  SELECT board_id, title
    INTO v_column_board_id, v_column_title
  FROM public.kanban_columns
  WHERE id = _column_id;

  IF v_column_board_id IS NULL OR v_column_board_id <> _board_id THEN
    RAISE EXCEPTION 'column does not belong to board' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_operate_kanban_card(v_caller, _board_id, 'create') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_column_id::text, 0));

  SELECT COALESCE(MAX(position), -1) + 1
    INTO v_position
  FROM public.kanban_cards
  WHERE column_id = _column_id
    AND COALESCE(archived, false) = false
    AND (_status IS NULL OR status IS NOT DISTINCT FROM _status);

  INSERT INTO public.kanban_cards (
    board_id,
    column_id,
    client_id,
    title,
    description,
    priority,
    due_date,
    assigned_to,
    tags,
    status,
    card_type,
    position,
    created_by,
    progress,
    creatives_quantity
  )
  VALUES (
    _board_id,
    _column_id,
    _client_id,
    BTRIM(_title),
    _description,
    COALESCE(_priority, 'medium'),
    _due_date,
    _assigned_to,
    _tags,
    _status,
    _card_type,
    v_position,
    v_caller,
    0,
    _creatives_quantity
  )
  RETURNING * INTO v_card;

  INSERT INTO public.card_activities (card_id, user_id, action, details)
  VALUES (
    v_card.id,
    v_caller,
    'created',
    jsonb_build_object('title', v_card.title, 'to', COALESCE(v_column_title, 'Coluna'))
  );

  RETURN v_card;
END;
$$;

-- Revoke/Grant for new signature (12 params)
REVOKE ALL ON FUNCTION public.kanban_create_card(uuid, uuid, text, text, text, date, uuid, text[], text, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kanban_create_card(uuid, uuid, text, text, text, date, uuid, text[], text, text, uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.kanban_create_card(uuid, uuid, text, text, text, date, uuid, text[], text, text, uuid, integer) IS
  'Cria card de kanban de forma transacional com creatives_quantity opcional.';

COMMIT;
