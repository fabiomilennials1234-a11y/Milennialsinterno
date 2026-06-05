-- 20260605140000_ads_crm_owns_predicate.sql
--
-- Slice 1 (#136) — Gestor de ads gera/atribui tarefa de CRM, escopado à carteira.
-- PRD #135, ADR 0006. Feature de AUTORIZAÇÃO.
--
-- O QUE FAZ (idempotente):
--   1. Predicado ÚNICO public._ads_owns_client(_client_id, _caller) — fonte única
--      reusada nas 3 slices: TRUE sse o cliente está na carteira de ads do caller
--      (clients.assigned_ads_manager = _caller). STABLE, search_path travado.
--   2. _torque_board_pode_escrever ganha 3º arg _client_id (DEFAULT NULL) e um
--      ramo OR _ads_owns_client(_client_id, _caller). Assinatura nova é aditiva:
--      o default preserva qualquer caller de 2 args. Callers internos passam o
--      client_id para habilitar o ramo ads.
--   3. torque_board_gerar passa p_client_id ao predicado. torque_board_comecar
--      resolve o client_id do card e o passa adiante (ads_dono pode "Começar").
--   4. assign_crm_gestor ganha o ramo _ads_owns_client e é ENDURECIDO:
--      search_path '' (estava 'public') + identificadores schema-qualified.
--
-- INVARIANTE DE SEGURANÇA: gestor_ads só gera/atribui para clientes da SUA
-- carteira. Cliente de outro ads => permission denied (42501). Sem novo caminho
-- de escrita fora de ownership. Preserva is_admin / has_page_access / gestor_id /
-- is_executive / has_role(gestor_crm|sucesso_cliente).
--
-- QUIRK (confirmado no remoto): clients.assigned_ads_manager é UUID (não text) —
-- compara = _caller direto, SEM ::text. (O ::text do CLAUDE.md vale p/ assigned_mktplace.)
--
-- HARDENING: todas SECURITY DEFINER com search_path='' e schema-qualify; o
-- predicado é STABLE (espelha is_admin/has_role).

BEGIN;

-- =============================================================================
-- 1. Predicado único de ownership de ads. Fonte única (slices #136/#137/#138).
--    SECURITY INVOKER (default): quando chamado de dentro de uma função
--    SECURITY DEFINER, herda o contexto do owner e enxerga a row sem barrar em
--    RLS; quando usado em policy RLS (slice #137), roda como o próprio usuário,
--    lendo só clients que a policy de clients já permitiria — mas como é leitura
--    de uma única coluna de ownership por id, não vaza nada além do booleano.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._ads_owns_client(_client_id uuid, _caller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.clients c
     WHERE c.id = _client_id
       AND c.assigned_ads_manager = _caller
  );
$$;

COMMENT ON FUNCTION public._ads_owns_client(uuid, uuid) IS
  'Predicado único de ownership de ads (PRD #135, slice #136): TRUE sse o cliente '
  'está na carteira de ads do caller (clients.assigned_ads_manager = _caller). '
  'Fonte única reusada por _torque_board_pode_escrever, assign_crm_gestor e pela '
  'policy RLS de SELECT do board (slice #137). assigned_ads_manager é UUID.';

REVOKE ALL ON FUNCTION public._ads_owns_client(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public._ads_owns_client(uuid, uuid) TO authenticated;

-- =============================================================================
-- 2. _torque_board_pode_escrever — + ramo ads. Assinatura ganha 3º arg
--    (_client_id DEFAULT NULL). Como a assinatura muda de aridade, a versão de
--    2 args precisa ser DROPada — senão ficariam duas funções e chamadas de 2
--    args resolveriam pela ANTIGA (sem ramo ads). Os callers internos passam 3
--    args; o default NULL existe só para qualquer caller externo legado.
-- =============================================================================
DROP FUNCTION IF EXISTS public._torque_board_pode_escrever(text, uuid);

CREATE OR REPLACE FUNCTION public._torque_board_pode_escrever(
  _gestor_id text,
  _caller    uuid,
  _client_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.is_admin(_caller)
      OR public.has_page_access(_caller, 'gestor-crm')
      OR _gestor_id = _caller::text
      OR (_client_id IS NOT NULL AND public._ads_owns_client(_client_id, _caller));
$$;

COMMENT ON FUNCTION public._torque_board_pode_escrever(text, uuid, uuid) IS
  'Predicado de autorização do board Torque CRM. Replica crm_config_* (#91) e + '
  'ramo ads (#136): ads dono do cliente (assigned_ads_manager) pode gerar/mover. '
  '_client_id NULL => ramo ads inativo (preserva callers de 2 args).';

-- =============================================================================
-- 3a. torque_board_gerar — passa p_client_id ao predicado (habilita ramo ads).
--     Corpo idêntico ao da #92, só a chamada de autorização muda.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.torque_board_gerar(
  p_client_id uuid,
  p_gestor_id text,
  p_produto   text,
  p_form_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id     uuid;
BEGIN
  -- Autorização: admin / page-grant / gestor do card / OU ads dono do cliente.
  IF NOT public._torque_board_pode_escrever(p_gestor_id, v_caller, p_client_id) THEN
    RAISE EXCEPTION 'permission denied: caller não pode gerar card de board'
      USING ERRCODE = '42501';
  END IF;

  IF p_gestor_id IS NULL OR btrim(p_gestor_id) = '' THEN
    RAISE EXCEPTION 'gestor_id obrigatório' USING ERRCODE = 'P0001';
  END IF;

  IF p_produto NOT IN ('torque','automation','copilot') THEN
    RAISE EXCEPTION 'produto inválido: % (esperado torque|automation|copilot)', p_produto
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id) THEN
    RAISE EXCEPTION 'cliente % não existe (referência órfã barrada)', p_client_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id
  FROM public.crm_configuracoes
  WHERE client_id = p_client_id AND produto = p_produto
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.crm_configuracoes (
    client_id, gestor_id, produto, current_step, is_finalizado,
    form_data, created_by, board_status, checklist
  )
  VALUES (
    p_client_id, p_gestor_id, p_produto,
    (public._torque_steps(p_produto))[1],
    false, COALESCE(p_form_data, '{}'::jsonb), v_caller,
    'a_fazer', '[]'::jsonb
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =============================================================================
-- 3b. torque_board_comecar — resolve o client_id do card e o passa ao predicado
--     (ads dono pode "Começar" o card da sua carteira). Resto idêntico à #92.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.torque_board_comecar(p_config_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_gestor_id text;
  v_status    text;
  v_client_id uuid;
BEGIN
  SELECT gestor_id, board_status, client_id
    INTO v_gestor_id, v_status, v_client_id
  FROM public.crm_configuracoes
  WHERE id = p_config_id;

  IF v_gestor_id IS NULL AND v_status IS NULL AND v_client_id IS NULL THEN
    RAISE EXCEPTION 'card % não existe (referência órfã barrada)', p_config_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Autorização: + ramo ads via client_id do card.
  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller, v_client_id) THEN
    RAISE EXCEPTION 'permission denied: caller não pode mover o card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'a_fazer' THEN
    RAISE EXCEPTION 'transição inválida: Começar exige board_status=''a_fazer'', card % está em ''%''', p_config_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_configuracoes
     SET board_status = 'tier'
   WHERE id = p_config_id;
END;
$$;

-- =============================================================================
-- 4. assign_crm_gestor — + ramo ads dono + HARDENING (search_path '' + qualify).
--    Preserva is_admin / is_executive / gestor_crm / sucesso_cliente.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.assign_crm_gestor(
  _client_id uuid,
  _gestor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_gestor_role public.user_role;
  v_client_crm_status text;
  v_result jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Autorização: admin / executive / gestor_crm / sucesso_cliente
  --              OU ads dono do cliente (escopo de carteira, #136).
  IF NOT (
    public.is_admin(v_caller)
    OR public.is_executive(v_caller)
    OR public.has_role(v_caller, 'gestor_crm'::public.user_role)
    OR public.has_role(v_caller, 'sucesso_cliente'::public.user_role)
    OR public._ads_owns_client(_client_id, v_caller)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Target precisa ser gestor_crm de fato.
  SELECT ur.role INTO v_gestor_role
    FROM public.user_roles ur
   WHERE ur.user_id = _gestor_id
     AND ur.role = 'gestor_crm'::public.user_role
   LIMIT 1;

  IF v_gestor_role IS NULL THEN
    RAISE EXCEPTION 'target user is not a gestor_crm' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.crm_status INTO v_client_crm_status
    FROM public.clients c
   WHERE c.id = _client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.clients
     SET assigned_crm   = _gestor_id,
         crm_status     = CASE WHEN crm_status IS NULL THEN 'novo' ELSE crm_status END,
         crm_entered_at = CASE WHEN crm_status IS NULL THEN now() ELSE crm_entered_at END,
         updated_at     = now()
   WHERE id = _client_id
   RETURNING jsonb_build_object(
     'id', id,
     'assigned_crm', assigned_crm,
     'crm_status', crm_status,
     'crm_entered_at', crm_entered_at
   ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.assign_crm_gestor(uuid, uuid) IS
  'Atribui gestor_crm a um cliente e entra no fluxo CRM (crm_status=novo) se ainda '
  'não iniciado. Callable por admin, executive, gestor_crm, sucesso_cliente OU o '
  'gestor de ads dono do cliente (escopo de carteira, #136). Hardened: search_path=''''.';

-- Grants (reafirma; idempotente).
REVOKE ALL ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.torque_board_comecar(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.assign_crm_gestor(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.torque_board_comecar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_crm_gestor(uuid, uuid) TO authenticated;

COMMIT;
