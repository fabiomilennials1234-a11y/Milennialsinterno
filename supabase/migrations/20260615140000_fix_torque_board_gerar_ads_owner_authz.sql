-- 20260615140000_fix_torque_board_gerar_ads_owner_authz.sql
--
-- FIX (regressão de ordem de migration): a RPC public.torque_board_gerar
-- (assinatura de 5 args, introduzida em 20260609120000 — Funil A/B, commit f977df2)
-- chama o predicado de autorização com SÓ 2 args:
--     _torque_board_pode_escrever(p_gestor_id, v_caller)
-- Isso DERRUBA o ramo de autorização do GESTOR DE ADS dono do cliente, porque
-- _torque_board_pode_escrever(_gestor_id text, _caller uuid, _client_id uuid DEFAULT NULL)
-- só avalia o ramo `_ads_owns_client(_client_id, _caller)` quando _client_id NÃO é NULL.
-- Com 2 args, _client_id cai no DEFAULT NULL => o ramo ads NUNCA roda => o gestor de
-- ADS dono do cliente (assigned_ads_manager = caller) que NÃO é admin, NÃO tem
-- has_page_access('gestor-crm') e NÃO é o gestor_id do card recebe 42501 ao brifar.
--
-- A migration 20260609120000 sobrescreveu a versão correta de 20260605140000
-- (ADR 0006 / PRD #135, slice #136), que passava p_client_id (3 args). A mais nova
-- venceu. Nenhuma migration entre 20260609120000 e agora recria a RPC.
--
-- ESTE FIX: CREATE OR REPLACE da torque_board_gerar IDÊNTICA à versão viva de 5 args
-- (preserva p_funil, escrita atômica de clients.funil, todas as validações,
-- idempotência por UNIQUE(client_id,produto), INSERT), mudando SÓ a linha de
-- autorização para passar p_client_id (3 args), restaurando o ramo ads pretendido.
--
-- SEGURANÇA: NÃO alarga a superfície de autorização — apenas RESTAURA o ramo
-- `_ads_owns_client(p_client_id, v_caller)` que o ADR 0006 §6 / #136 já desenhou e
-- que existia na versão de 20260605140000. Quem não é dono do cliente (e não é
-- admin / page-grant / gestor_id do card) continua barrado com 42501.
--
-- QUIRK: clients.assigned_ads_manager é UUID — _ads_owns_client compara = _caller
-- direto, SEM ::text (ver cabeçalho de 20260605140000). NÃO confundir com
-- assigned_mktplace (esse é text).

CREATE OR REPLACE FUNCTION public.torque_board_gerar(
  p_client_id uuid,
  p_gestor_id text,
  p_produto   text,
  p_form_data jsonb DEFAULT '{}'::jsonb,
  p_funil     text  DEFAULT NULL
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
  -- Autorização: admin / page-grant 'gestor-crm' / gestor do card / OU ads dono
  -- do cliente (escopo de carteira, ADR 0006 §6 / #136). Esta MESMA checagem é o
  -- RLS de escrita do funil (ADR 0010 §6). p_client_id habilita o ramo ads.
  IF NOT public._torque_board_pode_escrever(p_gestor_id, v_caller, p_client_id) THEN
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

  -- Funil válido (defesa em profundidade — espelha o CHECK clients_funil_check).
  -- NULL é aceito (compat / geração sem funil); se vier, precisa ser A|B.
  IF p_funil IS NOT NULL AND p_funil NOT IN ('A','B') THEN
    RAISE EXCEPTION 'funil inválido: % (esperado A|B)', p_funil
      USING ERRCODE = 'P0001';
  END IF;

  -- Anti-órfão: o cliente precisa existir.
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id) THEN
    RAISE EXCEPTION 'cliente % não existe (referência órfã barrada)', p_client_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Escrita atômica do funil no cliente (fonte única de escrita — ADR 0010 §3).
  -- Só sobrescreve quando um funil é efetivamente passado; geração sem funil
  -- (p_funil NULL) não apaga um funil já definido.
  IF p_funil IS NOT NULL THEN
    UPDATE public.clients
       SET funil = p_funil
     WHERE id = p_client_id;
  END IF;

  -- Idempotente por UNIQUE(client_id, produto): se o card já existe, devolve o id.
  -- (O funil acima já foi atualizado — o dono ADS pode re-gerar pra trocar o funil
  --  do cliente mesmo com card existente; a regeneração é o canal de escrita.)
  SELECT id INTO v_id
  FROM public.crm_configuracoes
  WHERE client_id = p_client_id AND produto = p_produto
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Card NOVO: nasce em A FAZER, com o step inicial do tier e checklist vazio.
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

COMMENT ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb, text) IS
  'Contrato do board Torque CRM (ADR 0006 + ADR 0010): cria/garante o card de '
  'board roteado pro tier (NASCENDO em A FAZER, idempotente por UNIQUE(client_id,'
  'produto)) E grava clients.funil (preset A|B) atomicamente. Fonte ÚNICA de '
  'escrita do funil. Autoriza via _torque_board_pode_escrever(gestor_id, caller, '
  'client_id) — admin / has_page_access(gestor-crm) / gestor_id do card / ads dono '
  'do cliente (assigned_ads_manager). Esta checagem É o RLS de escrita do funil.';

-- Grants (reafirma; assinatura de 5 args).
REVOKE ALL ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
