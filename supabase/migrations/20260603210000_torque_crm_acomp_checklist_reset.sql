-- 20260603210000_torque_crm_acomp_checklist_reset.sql
--
-- Slice 6 (#96) — Board de Acompanhamentos: "Tasks em aberto" editável + auto-move
-- + reset semanal. ADR 0006 §2 + ponto HITL #4. Fecha a aba Acompanhamentos.
--
-- O QUE FAZ (idempotente, não-destrutivo):
--   1. torque_acomp_checklist_set(p_acomp_id uuid, p_checklist jsonb) -> text
--      Substitui o checklist INTEIRO de um acompanhamento ("Tasks em aberto"
--      começa VAZIO; o gestor define as pendências). toggle/add/remove/rename são
--      mutações do mesmo array — o cliente computa o próximo array com o módulo
--      puro src/lib/torqueCrm/checklist.ts e manda o array completo. ESPELHA
--      torque_board_checklist_set (#93) palavra-por-palavra, trocando a tabela
--      (crm_acompanhamentos), a coluna de estado (coluna, não board_status) e a
--      direção do auto-move. Retorna a coluna resultante.
--   2. _cron_torque_acomp_reset_segunda() -> integer
--      Reset semanal (HITL #4): cards em 'follow_up_feito' E 'aguardando_resposta'
--      (ativos) voltam para 'fazer_follow_up'. 'tasks_em_aberto' fica INTACTO.
--      Idempotente (rodar 2x na mesma segunda não muda nada além do 1º run).
--      Espelha o módulo puro resetSegunda.colunasQueResetam().
--   3. cron.schedule('torque-acomp-reset-segunda', ...) — seg 00h America/Sao_Paulo.
--
-- AUTO-MOVE É ONE-WAY (espelha o auto-move de #93, direção própria deste board):
--   só 'tasks_em_aberto' -> 'fazer_follow_up', quando o checklist fica 100%
--   completo (não-vazio). NUNCA rebaixa. Card recém-chegado em 'tasks_em_aberto'
--   com checklist VAZIO NÃO auto-move (vazio nunca é completo — reusa o helper
--   _torque_checklist_completo de #93). Qualquer outra coluna preserva a coluna.
--
-- POR QUE UMA RPC (replace) E NÃO 4 (toggle/add/remove/rename): superfície mínima,
--   sem race entre ops, auto-move ATÔMICO com a escrita do array (mata "client
--   marcou completo mas servidor não moveu"). Last-write-wins: um gestor por card.
--
-- POR QUE pg_cron (e não trigger / edge): é o padrão do projeto (2 jobs vivos:
--   crm-stalled-client-tasks, check-crm-configs-delayed-hourly). Reset é temporal,
--   não reativo a um evento de linha — cron é o encaixe natural.
--
-- FUSO DO CRON (confirmado no remoto em 2026-06-03): America/Sao_Paulo está em
--   UTC-03 SEM horário de verão (DST abolido no Brasil desde 2019; sem previsão de
--   retorno). Logo SEGUNDA 00:00 SP == SEGUNDA 03:00 UTC. Cron = '0 3 * * 1'.
--   Verificado: (TIMESTAMP '2026-06-08 00:00' AT TIME ZONE 'America/Sao_Paulo')
--   AT TIME ZONE 'UTC' = 'Mon 03:00'. CONSEQUÊNCIA ACEITA (ADR): se o Brasil
--   reintroduzir DST, o job desloca 1h no verão — corrige-se trocando para
--   '0 2 * * 1' nos meses afetados (reversível em 1 linha).
--
-- HARDENING (ADR 0004 §3, padrão das RPCs #92–95): SECURITY DEFINER + SET
--   search_path='' + identificadores schema-qualified. Autorização EXPLÍCITA na
--   RPC de escrita via _torque_board_pode_escrever (#92). A função de cron NÃO tem
--   auth check (roda no contexto do pg_cron, superuser) e NÃO é exposta a
--   authenticated (REVOKE) — espelha _cron_generate_crm_stalled_tasks.
--
-- REUSO: _torque_checklist_completo e _torque_checklist_shape_ok já existem (#93).
--   NÃO duplicamos — só chamamos. Mantém uma verdade só de "completo" e "shape ok".
--
-- QUIRK: crm_acompanhamentos.gestor_id é TEXT — comparar auth.uid()::text.

BEGIN;

-- =============================================================================
-- 1. torque_acomp_checklist_set — replace do checklist + auto-move atômico.
--    Espelha torque_board_checklist_set (#93); direção do auto-move é própria:
--    'tasks_em_aberto' -> 'fazer_follow_up'.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.torque_acomp_checklist_set(
  p_acomp_id uuid,
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
  v_coluna    text;
  v_next      text;
  v_found     boolean := false;
BEGIN
  SELECT gestor_id, coluna, true INTO v_gestor_id, v_coluna, v_found
  FROM public.crm_acompanhamentos
  WHERE id = p_acomp_id;

  IF v_found IS NOT TRUE THEN
    RAISE EXCEPTION 'acompanhamento % não existe (referência órfã barrada)', p_acomp_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Autorização (replica crm_acomp_write / crm_config_write da #91).
  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode editar o checklist do acompanhamento %', p_acomp_id
      USING ERRCODE = '42501';
  END IF;

  -- Shape: array de {id,label,done} bem-formado (helper de #93).
  IF NOT public._torque_checklist_shape_ok(p_checklist) THEN
    RAISE EXCEPTION 'checklist inválido: esperado array de {id:text,label:text,done:bool}'
      USING ERRCODE = 'P0001';
  END IF;

  -- Auto-move ONE-WAY: só 'tasks_em_aberto' -> 'fazer_follow_up' quando 100%
  -- completo (não-vazio; helper _torque_checklist_completo de #93). Qualquer
  -- outro estado preserva a coluna — em especial, checklist VAZIO num card
  -- recém-chegado NÃO move (vazio nunca é completo).
  v_next := CASE
    WHEN v_coluna = 'tasks_em_aberto' AND public._torque_checklist_completo(p_checklist)
      THEN 'fazer_follow_up'
    ELSE v_coluna
  END;

  UPDATE public.crm_acompanhamentos
     SET checklist = p_checklist,
         coluna    = v_next
   WHERE id = p_acomp_id;

  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.torque_acomp_checklist_set(uuid, jsonb) IS
  'Board de Acompanhamentos (ADR 0006 §2, Slice #96): substitui o checklist '
  'inteiro de "Tasks em aberto" (começa vazio) e decide o auto-move ATÔMICO — '
  'tasks_em_aberto->fazer_follow_up quando 100% completo (one-way; nunca '
  'rebaixa; vazio nunca completa). Espelha torque_board_checklist_set (#93). '
  'Autoriza como as policies crm_config_*/crm_acomp_* (#91/#95). Retorna a coluna.';

REVOKE ALL ON FUNCTION public.torque_acomp_checklist_set(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_acomp_checklist_set(uuid, jsonb) TO authenticated;

-- =============================================================================
-- 2. _cron_torque_acomp_reset_segunda — reset semanal (HITL #4).
--    Espelha resetSegunda.colunasQueResetam() = follow_up_feito + aguardando_resposta;
--    destino fazer_follow_up. tasks_em_aberto e fazer_follow_up NÃO são tocados.
--    Idempotente: só cards ATIVOS nessas 2 colunas; rodar de novo é no-op.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._cron_torque_acomp_reset_segunda()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Sem auth check: chamado pelo pg_cron (contexto superuser).
  UPDATE public.crm_acompanhamentos
     SET coluna = 'fazer_follow_up'
   WHERE closed_at IS NULL
     AND coluna IN ('follow_up_feito', 'aguardando_resposta');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public._cron_torque_acomp_reset_segunda() IS
  'Reset semanal do board de Acompanhamentos (ADR 0006 §2 + HITL #4, Slice #96): '
  'cards ATIVOS em follow_up_feito E aguardando_resposta voltam para '
  'fazer_follow_up; tasks_em_aberto fica INTACTO. Idempotente. Espelha o módulo '
  'puro resetSegunda.colunasQueResetam(). Roda via pg_cron seg 00h America/Sao_Paulo '
  '(= seg 03:00 UTC). Não exposta a authenticated.';

-- Só pg_cron/superuser — não exposta a usuários (espelha _cron_generate_crm_stalled_tasks).
REVOKE ALL ON FUNCTION public._cron_torque_acomp_reset_segunda() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 3. pg_cron — SEGUNDA 00h America/Sao_Paulo = SEGUNDA 03:00 UTC (UTC-03, sem DST).
--    Unschedule-guard antes do schedule (padrão crm-stalled-client-tasks) =
--    idempotência da própria migração (re-rodar não duplica o job).
-- =============================================================================
SELECT cron.unschedule('torque-acomp-reset-segunda')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'torque-acomp-reset-segunda'
);

SELECT cron.schedule(
  'torque-acomp-reset-segunda',
  '0 3 * * 1',  -- seg 03:00 UTC == seg 00:00 America/Sao_Paulo (UTC-03)
  $$SELECT public._cron_torque_acomp_reset_segunda()$$
);

COMMIT;
