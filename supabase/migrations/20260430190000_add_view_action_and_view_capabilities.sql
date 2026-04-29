-- 20260430190000_add_view_action_and_view_capabilities.sql
--
-- Estende modelo granular com:
--   - action='view' em user_action_overrides → permite negar/conceder
--     visualização de cards/tarefas por kanban (page_slug).
--   - can_view_board consulta override 'view' antes da lógica atual.
--   - capabilities de visualização para clientes/dados sensíveis.

BEGIN;

-- ── 1. Aceitar action='view' em user_action_overrides ──────────────────

ALTER TABLE public.user_action_overrides
  DROP CONSTRAINT IF EXISTS user_action_overrides_action_check;

ALTER TABLE public.user_action_overrides
  ADD CONSTRAINT user_action_overrides_action_check
  CHECK (action IN ('view','create','move','archive','delete','edit_briefing'));

-- ── 2. can_view_board consulta override 'view' ─────────────────────────

CREATE OR REPLACE FUNCTION public.can_view_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
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
  board_page_slug text;
  v_override_granted boolean;
BEGIN
  SELECT public.is_ceo(_user_id) INTO user_is_ceo;
  IF user_is_ceo THEN
    RETURN true;
  END IF;

  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;

  IF user_role = 'gestor_projetos' THEN
    RETURN true;
  END IF;

  SELECT group_id, squad_id, category_id
    INTO user_group_id, user_squad_id, user_category_id
  FROM public.profiles
  WHERE user_id = _user_id;

  SELECT
    group_id,
    squad_id,
    category_id,
    COALESCE(allowed_roles, ARRAY[]::text[]),
    page_slug
    INTO board_group_id, board_squad_id, board_category_id, board_allowed_roles, board_page_slug
  FROM public.kanban_boards
  WHERE id = _board_id;

  -- Override fino do admin: se há row de view, ela é a verdade.
  IF board_page_slug IS NOT NULL THEN
    SELECT granted INTO v_override_granted
    FROM public.user_action_overrides
    WHERE user_id = _user_id
      AND page_slug = board_page_slug
      AND action = 'view';

    IF FOUND THEN
      RETURN v_override_granted;
    END IF;
  END IF;

  -- Caminho canônico: grant ativo da página ligada ao board.
  IF board_page_slug IS NOT NULL AND public.has_page_access(_user_id, board_page_slug) THEN
    RETURN true;
  END IF;

  IF user_squad_id IS NOT NULL AND board_squad_id = user_squad_id THEN
    RETURN true;
  END IF;

  IF user_group_id IS NOT NULL AND board_group_id = user_group_id AND board_squad_id IS NULL THEN
    RETURN true;
  END IF;

  IF user_category_id IS NOT NULL AND board_category_id = user_category_id THEN
    RETURN true;
  END IF;

  IF user_role IS NOT NULL
     AND array_length(board_allowed_roles, 1) IS NOT NULL
     AND user_role = ANY(board_allowed_roles) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.can_view_board(uuid, uuid) IS
  'Visibilidade de board. Override fino via user_action_overrides (action=view) sobrepoe regras gerais.';

-- ── 3. Capabilities de visualização ─────────────────────────────────────

INSERT INTO public.app_capabilities (key, label, category, description, is_sensitive, default_roles, position) VALUES
  ('clients.view',           'Ver lista de clientes',           'clients',  'Acesso à listagem geral de clientes (Lista de Clientes)',                       false, ARRAY['sucesso_cliente','financeiro','outbound']::text[],  5),
  ('clients.view_contract',  'Ver contrato do cliente',         'clients',  'Acesso aos detalhes de contrato (datas, duração, produtos contratados)',        false, ARRAY['sucesso_cliente','financeiro']::text[],            55),
  ('clients.view_financial', 'Ver dados financeiros do cliente','clients',  'Acesso a monthly_value, sales_percentage e investment do cliente (sensível)',   true,  ARRAY['financeiro']::text[],                              60),
  ('clients.view_pii',       'Ver PII do cliente (CPF/CNPJ)',   'clients',  'Acesso a CPF, CNPJ, telefone e razão social',                                   true,  ARRAY['financeiro','sucesso_cliente']::text[],            70),
  ('tasks.view_all',         'Ver todas as tarefas (não-suas)', 'system',   'Override geral: vê tarefas de outros usuários em qualquer área',                false, ARRAY[]::text[],                                          50),
  ('reports.view',           'Ver relatórios executivos',       'system',   'Acesso a dashboards de CEO, indicadores agregados e relatórios',                false, ARRAY[]::text[],                                          60)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      is_sensitive = EXCLUDED.is_sensitive,
      default_roles = EXCLUDED.default_roles,
      position = EXCLUDED.position;

COMMIT;
