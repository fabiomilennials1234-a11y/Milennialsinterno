-- 20260603180000_torque_crm_board_checklist_rpc.sql
--
-- Slice 3 (#93) — Checklist editável + auto-move do Board Torque CRM. ADR 0006.
--
-- O QUE FAZ (idempotente):
--   torque_board_checklist_set(p_config_id uuid, p_checklist jsonb) -> text
--     Substitui o checklist INTEIRO de um card (toggle/add/remove/rename são
--     todas mutações do mesmo array — o cliente computa o próximo array com o
--     módulo puro src/lib/torqueCrm/checklist.ts e manda o array completo).
--     Decide o AUTO-MOVE atomicamente na MESMA transação: se o card está em
--     'tier' e o checklist ficou 100% completo (não-vazio), promove para
--     'apresentacao'. Retorna o board_status resultante.
--
-- POR QUE UMA RPC (replace) E NÃO 4 (toggle/add/remove/rename):
--   uma única porta de escrita = superfície mínima, sem race entre ops, e o
--   auto-move sai ATÔMICO com a escrita do array (mata "client marcou completo
--   mas servidor não moveu"). Last-write-wins é aceitável: um gestor por card.
--
-- AUTO-MOVE É ONE-WAY (espelha boardImplantacao.onChecklistComplete):
--   só 'tier' -> 'apresentacao'. NUNCA rebaixa. Card já em 'apresentacao'
--   (possivelmente agendado) com item desmarcado NÃO volta pra 'tier' —
--   desfazer não pode destruir um agendamento. Checklist vazio nunca completa.
--
-- HARDENING (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + schema-qual.
--   Autorização EXPLÍCITA via _torque_board_pode_escrever (replica policies
--   crm_config_* da #91): is_admin OR has_page_access('gestor-crm') OR dono.
--
-- QUIRK: crm_configuracoes.gestor_id é TEXT — comparar auth.uid()::text.

BEGIN;

-- =============================================================================
-- Helper: o checklist está 100% completo? (espelha checklist.isComplete no TS)
-- Vazio nunca é completo. Cada elemento precisa de done=true.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._torque_checklist_completo(_checklist jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_array_length(_checklist) > 0
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(_checklist) AS e
       WHERE COALESCE((e->>'done')::boolean, false) IS NOT TRUE
     );
$$;

-- =============================================================================
-- Helper: valida o SHAPE do checklist [{id:text, label:text, done:bool}, ...].
-- Barra lixo antes de gravar (defesa além do CHECK jsonb_typeof='array').
-- =============================================================================
CREATE OR REPLACE FUNCTION public._torque_checklist_shape_ok(_checklist jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(_checklist) = 'array'
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(_checklist) AS e
       WHERE jsonb_typeof(e) <> 'object'
          OR e->>'id' IS NULL OR btrim(e->>'id') = ''
          OR e->>'label' IS NULL OR btrim(e->>'label') = ''
          OR jsonb_typeof(e->'done') <> 'boolean'
     );
$$;

-- =============================================================================
-- torque_board_checklist_set — replace do checklist + auto-move atômico.
-- =============================================================================
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

  -- Autorização (replica crm_config_write da #91).
  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode editar o checklist do card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  -- Shape: array de {id,label,done} bem-formado.
  IF NOT public._torque_checklist_shape_ok(p_checklist) THEN
    RAISE EXCEPTION 'checklist inválido: esperado array de {id:text,label:text,done:bool}'
      USING ERRCODE = 'P0001';
  END IF;

  -- Auto-move ONE-WAY (espelha onChecklistComplete): só 'tier' -> 'apresentacao'
  -- quando 100% completo. Qualquer outro estado preserva board_status.
  v_next := CASE
    WHEN v_status = 'tier' AND public._torque_checklist_completo(p_checklist)
      THEN 'apresentacao'
    ELSE v_status
  END;

  UPDATE public.crm_configuracoes
     SET checklist = p_checklist,
         board_status = v_next
   WHERE id = p_config_id;

  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.torque_board_checklist_set(uuid, jsonb) IS
  'Contrato do board Torque CRM (ADR 0006, Slice #93): substitui o checklist '
  'inteiro de um card e decide o auto-move ATÔMICO — tier->apresentacao quando '
  'o checklist fica 100% completo (one-way; nunca rebaixa). Espelha '
  'checklist.isComplete + boardImplantacao.onChecklistComplete. Autoriza como '
  'as policies crm_config_* (#91). Retorna o board_status resultante.';

-- Grants mínimos: só authenticated (escopo re-checado dentro).
REVOKE ALL ON FUNCTION public.torque_board_checklist_set(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_board_checklist_set(uuid, jsonb) TO authenticated;

COMMIT;
