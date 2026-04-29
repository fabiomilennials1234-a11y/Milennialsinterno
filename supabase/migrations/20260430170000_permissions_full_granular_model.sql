-- 20260430170000_permissions_full_granular_model.sql
--
-- Modelo granular de permissões — catalogá-las todas no DB e permitir
-- override por usuário (action override em kanbans, capability grant em
-- ações do sistema).
--
-- Substitui is_admin_override (removido) por matriz fina ajustável.
--
-- Tabelas:
--   - app_capabilities: catálogo declarativo de capabilities (key, label,
--     category, is_sensitive, default_roles).
--   - user_capability_grants: grants explícitos por usuário (granted true/false).
--   - user_action_overrides: override fino da matriz operacional kanban
--     (page_slug × action × granted).
--
-- Helpers:
--   - has_capability(user, key): admin OR explicit grant OR default_roles.
--   - can_operate_kanban_card: consulta user_action_overrides primeiro,
--     depois cai na matriz por page_slug.
--
-- is_admin_override removido em migration separada.

BEGIN;

-- ── 1. Catálogo de capabilities ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_capabilities (
  key            text PRIMARY KEY,
  label          text NOT NULL,
  category       text NOT NULL CHECK (category IN (
    'pages','kanban_actions','users','organization',
    'clients','financeiro','rh','sensitive','system'
  )),
  description    text,
  is_sensitive   boolean NOT NULL DEFAULT false,
  default_roles  text[] NOT NULL DEFAULT ARRAY[]::text[],
  position       int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_capabilities_read ON public.app_capabilities;
CREATE POLICY app_capabilities_read
  ON public.app_capabilities FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS app_capabilities_admin_write ON public.app_capabilities;
CREATE POLICY app_capabilities_admin_write
  ON public.app_capabilities FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed das capabilities. default_roles vazio = nenhum (só admin).
INSERT INTO public.app_capabilities (key, label, category, description, is_sensitive, default_roles, position) VALUES
  -- Gestão de usuários
  ('users.create',          'Criar usuários',                      'users',        'Cadastrar novos usuários no sistema',                                       false, ARRAY[]::text[], 10),
  ('users.edit',            'Editar usuários',                     'users',        'Alterar dados, cargo, grupo e páginas de qualquer usuário',                 false, ARRAY[]::text[], 20),
  ('users.delete',          'Remover usuários',                    'users',        'Deletar usuários do sistema',                                                false, ARRAY[]::text[], 30),
  ('users.grant_admin',     'Conceder permissões a outros',        'users',        'Editar capabilities/grants de qualquer outro usuário (poder de administrador)', true, ARRAY[]::text[], 40),
  -- Organização
  ('groups.crud',           'Gerenciar grupos',                    'organization', 'Criar / editar / deletar grupos organizacionais',                            false, ARRAY[]::text[], 10),
  ('squads.crud',           'Gerenciar squads',                    'organization', 'Criar / editar / deletar squads dentro de grupos',                           false, ARRAY[]::text[], 20),
  ('categories.crud',       'Gerenciar categorias independentes',  'organization', 'Criar / editar / deletar categorias independentes',                          false, ARRAY[]::text[], 30),
  -- Clientes
  ('clients.create',        'Criar cliente',                       'clients',      'Cadastrar novo cliente no sistema',                                          false, ARRAY['sucesso_cliente']::text[], 10),
  ('clients.edit',          'Editar cliente',                      'clients',      'Alterar dados, contrato, atribuições do cliente',                            false, ARRAY['sucesso_cliente']::text[], 20),
  ('clients.archive',       'Arquivar cliente',                    'clients',      'Arquivar cliente (move para histórico)',                                     false, ARRAY['sucesso_cliente']::text[], 30),
  ('clients.delete',        'Deletar cliente',                     'clients',      'Remover cliente permanentemente do sistema',                                 true,  ARRAY[]::text[], 40),
  ('clients.distrato',      'Iniciar/gerenciar distrato',          'clients',      'Iniciar processo de saída e ações de distrato',                              false, ARRAY['sucesso_cliente','financeiro']::text[], 50),
  -- Financeiro
  ('financeiro.view',          'Ver overview financeiro',          'financeiro',   'Acesso ao dashboard agregado e indicadores financeiros',                     false, ARRAY['financeiro']::text[], 10),
  ('financeiro.contas.crud',   'Gerenciar contas a pagar/receber', 'financeiro',   'Criar / editar / deletar contas a pagar e receber',                          false, ARRAY['financeiro']::text[], 20),
  ('financeiro.mrr.edit',      'Editar MRR / reajustes',           'financeiro',   'Registrar mudanças de MRR (expansão, depreciação, churn manual)',            false, ARRAY['financeiro']::text[], 30),
  ('financeiro.folha.view',    'Ver folha / salários',             'financeiro',   'Acesso a dados de folha de pagamento e salários',                            true,  ARRAY[]::text[], 40),
  ('financeiro.comissoes.view','Ver comissões individuais',        'financeiro',   'Acesso a comissões pagas por usuário (PII financeira)',                     true,  ARRAY[]::text[], 50),
  -- RH
  ('rh.vagas.crud',         'Gerenciar vagas',                     'rh',           'Criar / editar / arquivar vagas de RH',                                      false, ARRAY['rh','sucesso_cliente']::text[], 10),
  ('rh.candidatos.view',    'Ver candidatos (PII)',                'rh',           'Acesso a CPF, e-mail, telefone e dados pessoais de candidatos',             true,  ARRAY['rh']::text[], 20),
  ('rh.candidatos.edit',    'Editar candidatos (PII)',             'rh',           'Alterar dados pessoais de candidatos',                                       true,  ARRAY['rh']::text[], 30),
  -- Sistema
  ('audit.view',            'Ver auditoria de acessos',            'system',       'Acesso ao painel /admin/auditoria com log de quem acessou cada página',     false, ARRAY[]::text[], 10),
  ('settings.edit',         'Editar configurações globais',        'system',       'Alterar configurações do sistema (feature flags, parâmetros globais)',       true,  ARRAY[]::text[], 20),
  ('mtech.access',          'Acessar Milennials Tech',             'system',       'Ver kanban e backlog técnico independente do cargo',                         false, ARRAY['devs']::text[], 30)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      is_sensitive = EXCLUDED.is_sensitive,
      default_roles = EXCLUDED.default_roles,
      position = EXCLUDED.position;

-- ── 2. user_capability_grants ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_capability_grants (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.app_capabilities(key) ON DELETE CASCADE,
  granted        boolean NOT NULL DEFAULT true,
  granted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  reason         text,
  PRIMARY KEY (user_id, capability_key)
);

ALTER TABLE public.user_capability_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_capability_grants_self_read ON public.user_capability_grants;
CREATE POLICY user_capability_grants_self_read
  ON public.user_capability_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS user_capability_grants_admin_write ON public.user_capability_grants;
CREATE POLICY user_capability_grants_admin_write
  ON public.user_capability_grants FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── 3. user_action_overrides ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_action_overrides (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_slug   text NOT NULL,
  action      text NOT NULL CHECK (action IN ('create','move','archive','delete','edit_briefing')),
  granted     boolean NOT NULL DEFAULT true,
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  reason      text,
  PRIMARY KEY (user_id, page_slug, action)
);

ALTER TABLE public.user_action_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_action_overrides_self_read ON public.user_action_overrides;
CREATE POLICY user_action_overrides_self_read
  ON public.user_action_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS user_action_overrides_admin_write ON public.user_action_overrides;
CREATE POLICY user_action_overrides_admin_write
  ON public.user_action_overrides FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── 4. has_capability helper ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_capability(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_default_roles text[];
  v_explicit record;
BEGIN
  IF _user_id IS NULL OR _key IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Grant explícito (granted=true ou granted=false) sobrepõe default.
  SELECT granted INTO v_explicit
  FROM public.user_capability_grants
  WHERE user_id = _user_id AND capability_key = _key;

  IF FOUND THEN
    RETURN v_explicit.granted;
  END IF;

  -- Default por role.
  SELECT default_roles INTO v_default_roles
  FROM public.app_capabilities
  WHERE key = _key;

  IF v_default_roles IS NULL OR array_length(v_default_roles, 1) IS NULL THEN
    RETURN false;
  END IF;

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_role = ANY(v_default_roles);
END;
$$;

REVOKE ALL ON FUNCTION public.has_capability(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.has_capability(uuid, text) IS
  'Avalia capability granular. Admin sempre passa. Grant explícito sobrepõe default. Default determinado por app_capabilities.default_roles.';

-- ── 5. can_operate_kanban_card consulta override antes da matriz ──────

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

  -- Override fino: se houver row em user_action_overrides, ela é a verdade.
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

  -- Matriz por page_slug (mesma de antes).
  IF v_page_slug = 'design' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','design','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'editor-video' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','editor_video','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'devs' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','devs','sucesso_cliente']);
  END IF;
  IF v_page_slug = 'atrizes-gravacao' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','atrizes_gravacao','sucesso_cliente']);
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

COMMENT ON FUNCTION public.can_operate_kanban_card(uuid, uuid, text) IS
  'Permissao canonica de operacao em kanban. Override fino via user_action_overrides sobrepoe matriz. Fail-closed em slug nao mapeado.';

-- ── 6. RPCs get_user_permissions / set_user_permissions ───────────────

CREATE OR REPLACE FUNCTION public.get_user_permissions(_target_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_payload jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'only admins can read user permissions' USING ERRCODE = '42501';
  END IF;
  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'target user required' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'page_grants', COALESCE((
      SELECT jsonb_agg(page_slug)
      FROM public.user_page_grants
      WHERE user_id = _target_user AND revoked_at IS NULL
    ), '[]'::jsonb),
    'capability_grants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', capability_key, 'granted', granted))
      FROM public.user_capability_grants
      WHERE user_id = _target_user
    ), '[]'::jsonb),
    'action_overrides', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'page_slug', page_slug,
        'action',    action,
        'granted',   granted
      ))
      FROM public.user_action_overrides
      WHERE user_id = _target_user
    ), '[]'::jsonb)
  ) INTO v_payload;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- set_user_permissions: substitui state completo (delete + insert) em transação.
CREATE OR REPLACE FUNCTION public.set_user_permissions(
  _target_user        uuid,
  _capability_grants  jsonb,
  _action_overrides   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'only admins can set user permissions' USING ERRCODE = '42501';
  END IF;
  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'target user required' USING ERRCODE = '22023';
  END IF;

  -- Capability grants: substitui completamente.
  DELETE FROM public.user_capability_grants WHERE user_id = _target_user;

  IF _capability_grants IS NOT NULL AND jsonb_typeof(_capability_grants) = 'array' THEN
    INSERT INTO public.user_capability_grants (user_id, capability_key, granted, granted_by)
    SELECT
      _target_user,
      (item->>'key')::text,
      COALESCE((item->>'granted')::boolean, true),
      v_caller
    FROM jsonb_array_elements(_capability_grants) AS item
    WHERE item->>'key' IS NOT NULL;
  END IF;

  -- Action overrides: substitui completamente.
  DELETE FROM public.user_action_overrides WHERE user_id = _target_user;

  IF _action_overrides IS NOT NULL AND jsonb_typeof(_action_overrides) = 'array' THEN
    INSERT INTO public.user_action_overrides (user_id, page_slug, action, granted, granted_by)
    SELECT
      _target_user,
      (item->>'page_slug')::text,
      (item->>'action')::text,
      COALESCE((item->>'granted')::boolean, true),
      v_caller
    FROM jsonb_array_elements(_action_overrides) AS item
    WHERE item->>'page_slug' IS NOT NULL
      AND item->>'action' IS NOT NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_permissions(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_permissions(uuid, jsonb, jsonb) TO authenticated;

COMMIT;
