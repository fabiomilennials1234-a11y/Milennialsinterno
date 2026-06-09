-- =============================================================================
-- ADR 0010 — Funil A/B: pipeline do CRM em dois presets fixos, decidido pelo
-- Gestor de ADS. Migration de build.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Nova coluna clients.funil (text, CHECK funil IN ('A','B'), NULLABLE até a
--      primeira geração de tarefa). Sem backfill: clientes com form_data legado
--      (padrao/personalizado) ficam como estão; funil só existe em novas gerações
--      (decisão de retro-classificação do ADR §Consequências — NÃO retro-classificar).
--   2. Estende a RPC public.torque_board_gerar com o param p_funil. A escrita de
--      clients.funil é ATÔMICA dentro da MESMA função SECURITY DEFINER que cria o
--      card — NÃO há UPDATE cru de clients.funil pelo frontend. Isso:
--        - garante atomicidade (card + funil numa transação);
--        - reusa a autorização já existente (_torque_board_pode_escrever) =
--          o RLS de escrita do ADR §6 ("quem gera a tarefa: Gestor de ADS / cúpula");
--        - mantém clients fechado pra UPDATE direto pelo cliente — superfície menor.
--   3. Leitura de clients.funil segue o RLS de SELECT já existente em clients
--      (pode_ver_cliente). Nenhuma policy nova é necessária — a coluna herda a
--      policy da tabela. PostgREST recarrega o schema (NOTIFY) — coluna nova em
--      tabela já exposta, não precisa de re-PATCH de db_schema.
--
-- QUIRK: a escrita de clients dentro de SECURITY DEFINER bypassa RLS de clients —
--   por isso a autorização é EXPLÍCITA via _torque_board_pode_escrever (já era).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna clients.funil + CHECK
-- -----------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS funil text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_funil_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_funil_check CHECK (funil IS NULL OR funil IN ('A','B'));
  END IF;
END $$;

COMMENT ON COLUMN public.clients.funil IS
  'ADR 0010 — Funil A/B: preset de pipeline de qualificação do CRM que o cliente '
  'segue. NULL até a primeira geração de tarefa do CRM. Mutuamente exclusivo (A|B). '
  'Escrito SOMENTE via RPC torque_board_gerar (dono: Gestor de ADS). Lido por quem '
  'pode_ver_cliente (herda RLS de clients).';

-- -----------------------------------------------------------------------------
-- 2. Estende torque_board_gerar com p_funil (escrita atômica de clients.funil)
--    CREATE OR REPLACE preserva a assinatura antiga? NÃO — a assinatura muda
--    (novo param). Adicionamos p_funil com DEFAULT NULL pra manter compat de
--    chamadas posicionais antigas e criar a nova sobrecarga de forma limpa.
--    Como o conjunto de tipos muda, dropamos a versão antiga explicitamente.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.torque_board_gerar(uuid, text, text, jsonb);

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
  -- Autorização (replica crm_config_write; gestor_id é o do card a criar).
  -- Esta MESMA checagem é o RLS de escrita do funil (ADR §6): quem gera a tarefa.
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

  -- Escrita atômica do funil no cliente (fonte única de escrita — ADR §3).
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
  'escrita do funil. Autoriza via _torque_board_pode_escrever (Gestor de ADS / '
  'has_page_access(gestor-crm) / admin) — esta checagem É o RLS de escrita do funil.';

-- -----------------------------------------------------------------------------
-- 3. Grants (re-aplicar após o DROP — a sobrecarga antiga não existe mais)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_board_gerar(uuid, text, text, jsonb, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. PostgREST: recarregar schema (coluna nova em tabela já exposta).
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
