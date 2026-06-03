-- 20260603170000_torque_crm_board_rpc.sql
--
-- Slice 2 (#92) — Interações do Board Torque CRM. ADR 0006.
--
-- O QUE FAZ (idempotente):
--   1. torque_board_gerar(p_client_id, p_gestor_id, p_produto, p_form_data)
--      -> uuid : cria/garante o card de board de um cliente, roteado pro tier
--      informado, NASCENDO na coluna A FAZER (board_status='a_fazer'). Substitui
--      o INSERT cru de useCreateCrmConfiguracoes (ADR §92.3: escrita só via RPC).
--      Idempotente por UNIQUE(client_id, produto): se já existe, devolve o id
--      existente sem alterar.
--   2. torque_board_comecar(p_config_id) -> void : promove o card de A FAZER pra
--      coluna do seu tier (board_status 'a_fazer' -> 'tier'). Espelha o reducer
--      puro src/lib/torqueCrm/boardImplantacao.comecar() e é provado pela pgTAP.
--
-- HARDENING (ADR 0004 §3, padrão dos módulos cliente/demanda):
--   SECURITY DEFINER + SET search_path='' + identificadores schema-qualified.
--   Como SECURITY DEFINER bypassa RLS, a autorização é EXPLÍCITA dentro da função
--   e replica EXATAMENTE o predicado das policies crm_config_* da #91:
--     is_admin OR has_page_access('gestor-crm') OR gestor_id = auth.uid()::text
--
-- QUIRK: crm_configuracoes.gestor_id é TEXT (não uuid) — comparar auth.uid()::text.
--
-- Por que ficam em public (não em schema 'board' dedicado): o módulo CRM ainda
-- não foi extraído pelo strangler; crm_configuracoes vive em public e as helpers
-- da #91 (torque_step_to_checklist etc.) já estão em public. Criar schema agora
-- seria over-engineering. Reversível: migram juntas quando o CRM for extraído.

BEGIN;

-- =============================================================================
-- Predicado de autorização do board — espelha as policies crm_config_* (#91).
-- Centraliza a regra "quem mexe no board do CRM" usada pelas RPCs SECURITY
-- DEFINER (que bypassam RLS e precisam re-checar explicitamente).
-- =============================================================================
CREATE OR REPLACE FUNCTION public._torque_board_pode_escrever(_gestor_id text, _caller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.is_admin(_caller)
      OR public.has_page_access(_caller, 'gestor-crm')
      OR _gestor_id = _caller::text;
$$;

-- =============================================================================
-- 1. torque_board_gerar — card nasce em A FAZER (ADR 0006). Único caminho de
--    criação do card de board (substitui o INSERT cru no client).
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
  -- Autorização (replica crm_config_write da #91; gestor_id é o do card a criar).
  IF NOT public._torque_board_pode_escrever(p_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode gerar card de board'
      USING ERRCODE = '42501';
  END IF;

  IF p_gestor_id IS NULL OR btrim(p_gestor_id) = '' THEN
    RAISE EXCEPTION 'gestor_id obrigatório' USING ERRCODE = 'P0001';
  END IF;

  -- Tier válido (espelha o CHECK crm_configuracoes_produto_check).
  IF p_produto NOT IN ('torque','automation','copilot') THEN
    RAISE EXCEPTION 'produto inválido: % (esperado torque|automation|copilot)', p_produto
      USING ERRCODE = 'P0001';
  END IF;

  -- Anti-órfão: o cliente precisa existir.
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id) THEN
    RAISE EXCEPTION 'cliente % não existe (referência órfã barrada)', p_client_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotente por UNIQUE(client_id, produto): se já existe, devolve o id.
  SELECT id INTO v_id
  FROM public.crm_configuracoes
  WHERE client_id = p_client_id AND produto = p_produto
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Card NOVO: nasce em A FAZER, com o step inicial do tier e checklist vazio
  -- (o seed do checklist é materializado quando o card entra no tier — slice
  -- de checklist; aqui o card de A FAZER ainda não expõe checklist).
  INSERT INTO public.crm_configuracoes (
    client_id, gestor_id, produto, current_step, is_finalizado,
    form_data, created_by, board_status, checklist
  )
  VALUES (
    p_client_id, p_gestor_id, p_produto,
    (public._torque_steps(p_produto))[1],  -- primeiro step do tier
    false, COALESCE(p_form_data, '{}'::jsonb), v_caller,
    'a_fazer', '[]'::jsonb
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb) IS
  'Contrato do board Torque CRM (ADR 0006, Slice #92): cria/garante o card de '
  'board de um cliente roteado pro tier, NASCENDO em A FAZER (board_status='
  '''a_fazer''). Idempotente por UNIQUE(client_id,produto). Autoriza como as '
  'policies crm_config_* (#91). Único caminho de criação do card de board.';

-- =============================================================================
-- 2. torque_board_comecar — promove A FAZER -> tier. Espelha o reducer puro.
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
BEGIN
  SELECT gestor_id, board_status INTO v_gestor_id, v_status
  FROM public.crm_configuracoes
  WHERE id = p_config_id;

  IF v_gestor_id IS NULL AND v_status IS NULL THEN
    RAISE EXCEPTION 'card % não existe (referência órfã barrada)', p_config_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Autorização (replica crm_config_write da #91).
  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode mover o card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  -- Guard de transição (espelha boardImplantacao.comecar): só a_fazer -> tier.
  IF v_status <> 'a_fazer' THEN
    RAISE EXCEPTION 'transição inválida: Começar exige board_status=''a_fazer'', card % está em ''%''', p_config_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_configuracoes
     SET board_status = 'tier'
   WHERE id = p_config_id;
END;
$$;

COMMENT ON FUNCTION public.torque_board_comecar(uuid) IS
  'Contrato do board Torque CRM (ADR 0006, Slice #92): "Começar" promove o card '
  'de A FAZER pra coluna do seu tier (board_status ''a_fazer''->''tier''). '
  'Espelha o reducer puro boardImplantacao.comecar(); guard de transição '
  'idempotente contra duplo-clique. Autoriza como as policies crm_config_* (#91).';

-- Grants mínimos: só authenticated executa (RLS/escopo é re-checado dentro).
REVOKE ALL ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.torque_board_comecar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.torque_board_comecar(uuid) TO authenticated;

COMMIT;
