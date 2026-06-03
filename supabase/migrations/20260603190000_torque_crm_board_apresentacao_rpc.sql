-- 20260603190000_torque_crm_board_apresentacao_rpc.sql
--
-- Slice 4 (#94) — Apresentação do Board Torque CRM: agendar / pronto / reagendar.
-- ADR 0006.
--
-- O QUE FAZ (idempotente):
--   1. _torque_pode_concluir(_apresentacao_at timestamptz) -> boolean
--      Gate de data NO SERVIDOR (espelha src/lib/torqueCrm/dateGate.podeConcluir):
--      true sse now() já alcançou 00h do DIA-CALENDÁRIO de _apresentacao_at no
--      fuso America/Sao_Paulo. Por DIA, não por hora — adiantado não trava.
--      NULL -> false (não há data agendada). Compara as DATAS (::date no tz SP).
--   2. torque_board_agendar(p_config_id uuid, p_apresentacao_at timestamptz) -> void
--      Grava apresentacao_at (primeiro agendamento E reagendamento são a mesma
--      operação). Card precisa estar em 'apresentacao' (espelha o reducer
--      reagendar — só se agenda/reagenda o que está agendado). NÃO muda
--      board_status.
--   3. torque_board_pronto(p_config_id uuid) -> void
--      Conclui: board_status 'apresentacao' -> 'pronto' (arquiva em PRONTOS).
--      Espelha boardImplantacao.marcarPronto. RE-VALIDA O GATE DE DATA: exige
--      apresentacao_at NOT NULL E _torque_pode_concluir = true. O cliente NUNCA
--      é confiável para liberar a transição — o botão da UI é só UX; a verdade
--      é aqui (ATENÇÃO do escopo #94).
--
-- HARDENING (ADR 0004 §3, padrão das RPCs #92/#93): SECURITY DEFINER +
--   SET search_path='' + identificadores schema-qualified. Autorização EXPLÍCITA
--   via _torque_board_pode_escrever (replica policies crm_config_* da #91):
--   is_admin OR has_page_access('gestor-crm') OR gestor_id = auth.uid()::text.
--
-- QUIRK: crm_configuracoes.gestor_id é TEXT — comparar auth.uid()::text.

BEGIN;

-- =============================================================================
-- Gate de data — espelha dateGate.podeConcluir (TS). Por dia-calendário no fuso
-- de SP: compara a DATA (no tz America/Sao_Paulo) de now() com a de _apresentacao_at.
-- AT TIME ZONE converte o timestamptz para o horário local de SP; ::date trunca
-- ao dia-calendário. Assim 00:00 SP do dia libera; véspera (mesmo 23:59) trava;
-- e um instante que já virou em UTC mas ainda é véspera em SP fica travado.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._torque_pode_concluir(_apresentacao_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT _apresentacao_at IS NOT NULL
     AND (now() AT TIME ZONE 'America/Sao_Paulo')::date
         >= (_apresentacao_at AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

COMMENT ON FUNCTION public._torque_pode_concluir(timestamptz) IS
  'Gate de data do board Torque CRM (ADR 0006, Slice #94): true sse now() já '
  'alcançou 00h do dia-calendário de _apresentacao_at no fuso America/Sao_Paulo. '
  'Por dia, não por hora. Espelha src/lib/torqueCrm/dateGate.podeConcluir.';

-- =============================================================================
-- 1. torque_board_agendar — grava apresentacao_at (agendar/reagendar).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.torque_board_agendar(
  p_config_id       uuid,
  p_apresentacao_at timestamptz
)
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
    RAISE EXCEPTION 'permission denied: caller não pode agendar a apresentação do card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  IF p_apresentacao_at IS NULL THEN
    RAISE EXCEPTION 'data da apresentação obrigatória' USING ERRCODE = 'P0001';
  END IF;

  -- Guard de estado (espelha boardImplantacao.reagendar): só se agenda/reagenda
  -- o que está em 'apresentacao'. board_status NÃO muda.
  IF v_status <> 'apresentacao' THEN
    RAISE EXCEPTION 'transição inválida: agendar exige board_status=''apresentacao'', card % está em ''%''', p_config_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_configuracoes
     SET apresentacao_at = p_apresentacao_at
   WHERE id = p_config_id;
END;
$$;

COMMENT ON FUNCTION public.torque_board_agendar(uuid, timestamptz) IS
  'Contrato do board Torque CRM (ADR 0006, Slice #94): grava apresentacao_at '
  '(agendar/reagendar — mesma operação). Card permanece em ''apresentacao'' '
  '(espelha boardImplantacao.reagendar). Autoriza como as policies crm_config_* (#91).';

-- =============================================================================
-- 2. torque_board_pronto — apresentacao -> pronto, COM gate de data no servidor.
-- =============================================================================
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

  -- Autorização (replica crm_config_write da #91).
  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode concluir o card %', p_config_id
      USING ERRCODE = '42501';
  END IF;

  -- Guard de estado (espelha boardImplantacao.marcarPronto): só apresentacao -> pronto.
  IF v_status <> 'apresentacao' THEN
    RAISE EXCEPTION 'transição inválida: Pronto exige board_status=''apresentacao'', card % está em ''%''', p_config_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- GATE DE DATA no servidor (ATENÇÃO #94): nem que o client force, só conclui a
  -- partir de 00h do dia agendado (fuso SP). apresentacao_at obrigatório.
  IF NOT public._torque_pode_concluir(v_at) THEN
    RAISE EXCEPTION 'apresentação ainda não chegou: PRONTO só a partir de 00h do dia agendado (fuso America/Sao_Paulo)'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_configuracoes
     SET board_status = 'pronto'
   WHERE id = p_config_id;
END;
$$;

COMMENT ON FUNCTION public.torque_board_pronto(uuid) IS
  'Contrato do board Torque CRM (ADR 0006, Slice #94): conclui a apresentação '
  '(board_status ''apresentacao''->''pronto''). Espelha boardImplantacao.marcarPronto. '
  'RE-VALIDA o gate de data no servidor (_torque_pode_concluir): só a partir de '
  '00h do dia agendado (fuso SP). Autoriza como as policies crm_config_* (#91).';

-- Grants mínimos: só authenticated executa (escopo re-checado dentro).
REVOKE ALL ON FUNCTION public.torque_board_agendar(uuid, timestamptz) FROM public, anon;
REVOKE ALL ON FUNCTION public.torque_board_pronto(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_board_agendar(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.torque_board_pronto(uuid) TO authenticated;

COMMIT;
