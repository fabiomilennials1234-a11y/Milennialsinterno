-- 20260605130000_torque_crm_sla_foundation.sql
--
-- Slice 2 (#129) — Fundação de SLA do Board Torque CRM. ADR 0006.
--
-- O QUE FAZ (idempotente, não-destrutivo):
--   1. crm_configuracoes.stage_entered_at TIMESTAMPTZ — quando o card ENTROU na
--      sua coluna ATUAL do board (o relógio do SLA por coluna). Backfill dos
--      cards existentes = updated_at (melhor aproximação da última transição).
--      NÃO confundir com a coluna legada step_entered_at (state-machine de steps,
--      dormente). stage = COLUNA do board (a_fazer/tier/apresentacao/pronto);
--      step = passo do checklist antigo.
--   2. Tabela crm_sla: 1 linha por COLUNA LÓGICA do board, com max_days INT.
--      Colunas lógicas = {a_fazer, torque, automation, copilot, apresentacao,
--      pronto}. As 3 de tier (torque/automation/copilot) são as faces de
--      board_status='tier' por produto — por isso a chave é a coluna lógica, não
--      board_status cru. pronto = sem SLA (linha ausente / max_days NULL).
--      Seed: a_fazer=2, torque=3, automation=5, copilot=10, apresentacao=4.
--      RLS: leitura por qualquer authenticated; escrita só admin.
--   3. As RPCs de transição passam a gravar stage_entered_at:
--        - torque_board_gerar     : nasce com stage_entered_at = created_at.
--        - torque_board_comecar   : a_fazer->tier  => stage_entered_at = now().
--        - torque_board_checklist_set : SÓ quando há transição de coluna
--          (tier->apresentacao) => stage_entered_at = now(). Toggle de item que
--          NÃO move a coluna NÃO reseta o relógio (senão o SLA nunca venceria).
--        - torque_board_pronto    : apresentacao->pronto => stage_entered_at = now().
--        - torque_board_agendar   : NÃO mexe (não muda de coluna).
--
-- SEGURANÇA: crm_sla nasce com RLS ON. Leitura aberta a authenticated (é
--   metadado de configuração, não dado de cliente — não vaza nada sensível).
--   Escrita restrita a is_admin. stage_entered_at é só um timestamp de transição
--   de coluna: não expõe nada além do que board_status já expõe.
--
-- HARDENING: as RPCs reescritas preservam SECURITY DEFINER + search_path='' +
--   schema-qualified + a MESMA autorização (_torque_board_pode_escrever). A
--   reescrita é CREATE OR REPLACE — só adiciona a coluna nos UPDATE/INSERT.

BEGIN;

-- =============================================================================
-- 1. stage_entered_at — relógio do SLA por coluna do board.
-- =============================================================================
ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;

-- Backfill idempotente: só preenche o que ainda está NULL (não sobrescreve um
-- valor já gravado por uma transição real). updated_at é a melhor aproximação
-- da última vez que o card mudou de estado.
UPDATE public.crm_configuracoes
   SET stage_entered_at = COALESCE(updated_at, created_at, now())
 WHERE stage_entered_at IS NULL;

COMMENT ON COLUMN public.crm_configuracoes.stage_entered_at IS
  'Quando o card entrou na sua COLUNA atual do board Torque CRM (ADR 0006, #129). '
  'Relógio do SLA por coluna. Gravado pelas RPCs de transição (gerar=created_at; '
  'comecar/checklist_set[só na transição tier->apresentacao]/pronto=now(); agendar '
  'não-mexe). NÃO confundir com step_entered_at (state-machine de steps, legado).';

-- =============================================================================
-- 2. crm_sla — max_days por coluna lógica do board.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crm_sla (
  coluna     text PRIMARY KEY,
  max_days   int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_sla_coluna_check
    CHECK (coluna IN ('a_fazer','torque','automation','copilot','apresentacao','pronto')),
  -- max_days > 0 quando presente; NULL = sem SLA (ex.: pronto, estado terminal).
  CONSTRAINT crm_sla_max_days_positive CHECK (max_days IS NULL OR max_days > 0)
);

COMMENT ON TABLE public.crm_sla IS
  'SLA por coluna lógica do board Torque CRM (ADR 0006, #129): max_days até o card '
  'ser considerado ATRASADO naquela coluna. As 3 colunas de tier (torque/automation/'
  'copilot) são as faces de board_status=''tier'' por produto. pronto = sem SLA '
  '(linha ausente ou max_days NULL). Atraso é DERIVADO em render, nunca persistido.';
COMMENT ON COLUMN public.crm_sla.coluna IS
  'Coluna lógica do board: a_fazer|torque|automation|copilot|apresentacao|pronto.';
COMMENT ON COLUMN public.crm_sla.max_days IS
  'Dias máximos na coluna antes de atrasar. NULL = sem SLA.';

-- Seed idempotente (não sobrescreve um max_days já ajustado por um admin).
INSERT INTO public.crm_sla (coluna, max_days) VALUES
  ('a_fazer', 2),
  ('torque', 3),
  ('automation', 5),
  ('copilot', 10),
  ('apresentacao', 4)
ON CONFLICT (coluna) DO NOTHING;

-- RLS: leitura authenticated; escrita só admin.
ALTER TABLE public.crm_sla ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_sla_select ON public.crm_sla;
CREATE POLICY crm_sla_select ON public.crm_sla
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS crm_sla_write ON public.crm_sla;
CREATE POLICY crm_sla_write ON public.crm_sla
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- anon não toca.
REVOKE ALL ON public.crm_sla FROM anon;
GRANT SELECT ON public.crm_sla TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.crm_sla TO authenticated; -- gated by RLS (admin-only)

-- =============================================================================
-- 3. RPCs de transição — gravam stage_entered_at.
--    CREATE OR REPLACE preservando assinatura, hardening e autorização.
-- =============================================================================

-- 3.1 gerar: card NOVO nasce com stage_entered_at = created_at (o instante em que
--     entrou em A FAZER == o instante em que entrou no board).
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
  IF NOT public._torque_board_pode_escrever(p_gestor_id, v_caller) THEN
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

  -- Card NOVO em A FAZER. stage_entered_at = created_at (DEFAULT now()): entrou
  -- na coluna A FAZER no mesmo instante em que entrou no board.
  INSERT INTO public.crm_configuracoes (
    client_id, gestor_id, produto, current_step, is_finalizado,
    form_data, created_by, board_status, checklist, stage_entered_at
  )
  VALUES (
    p_client_id, p_gestor_id, p_produto,
    (public._torque_steps(p_produto))[1],
    false, COALESCE(p_form_data, '{}'::jsonb), v_caller,
    'a_fazer', '[]'::jsonb, now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3.2 comecar: a_fazer -> tier => stage_entered_at = now().
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

  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode mover o card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'a_fazer' THEN
    RAISE EXCEPTION 'transição inválida: Começar exige board_status=''a_fazer'', card % está em ''%''', p_config_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_configuracoes
     SET board_status = 'tier',
         stage_entered_at = now()  -- entrou na coluna do tier agora.
   WHERE id = p_config_id;
END;
$$;

-- 3.3 checklist_set: grava stage_entered_at SÓ quando a coluna muda
--     (tier -> apresentacao). Toggle de item que não move a coluna preserva o
--     relógio do SLA — senão marcar/desmarcar nunca deixaria o card vencer.
CREATE OR REPLACE FUNCTION public.torque_board_checklist_set(
  p_config_id uuid,
  p_checklist jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_gestor_id text;
  v_status    text;
  v_next      text;
BEGIN
  SELECT gestor_id, board_status INTO v_gestor_id, v_status
  FROM public.crm_configuracoes
  WHERE id = p_config_id;

  IF v_gestor_id IS NULL AND v_status IS NULL THEN
    RAISE EXCEPTION 'card % não existe (referência órfã barrada)', p_config_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode editar o checklist do card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  IF NOT public._torque_checklist_shape_ok(p_checklist) THEN
    RAISE EXCEPTION 'checklist inválido: esperado array de {id:text,label:text,done:bool}'
      USING ERRCODE = 'P0001';
  END IF;

  v_next := CASE
    WHEN v_status = 'tier' AND public._torque_checklist_completo(p_checklist)
      THEN 'apresentacao'
    ELSE v_status
  END;

  UPDATE public.crm_configuracoes
     SET checklist = p_checklist,
         board_status = v_next,
         -- Só reinicia o relógio do SLA quando a COLUNA realmente muda.
         stage_entered_at = CASE WHEN v_next <> v_status THEN now() ELSE stage_entered_at END
   WHERE id = p_config_id;

  RETURN v_next;
END;
$$;

-- 3.4 pronto: apresentacao -> pronto => stage_entered_at = now() (pronto não tem
--     SLA, mas registra a entrada na coluna por consistência/auditoria).
CREATE OR REPLACE FUNCTION public.torque_board_pronto(p_config_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_gestor_id text;
  v_status    text;
  v_at        timestamptz;
BEGIN
  SELECT gestor_id, board_status, apresentacao_at
    INTO v_gestor_id, v_status, v_at
  FROM public.crm_configuracoes
  WHERE id = p_config_id;

  IF v_gestor_id IS NULL AND v_status IS NULL THEN
    RAISE EXCEPTION 'card % não existe (referência órfã barrada)', p_config_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode concluir o card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'apresentacao' THEN
    RAISE EXCEPTION 'transição inválida: Pronto exige board_status=''apresentacao'', card % está em ''%''', p_config_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public._torque_pode_concluir(v_at) THEN
    RAISE EXCEPTION 'apresentação ainda não chegou: PRONTO só a partir de 00h do dia agendado (fuso America/Sao_Paulo)'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_configuracoes
     SET board_status = 'pronto',
         stage_entered_at = now()  -- entrou em PRONTOS agora.
   WHERE id = p_config_id;
END;
$$;

-- agendar NÃO é tocado (não muda de coluna; mantém stage_entered_at).

COMMIT;
