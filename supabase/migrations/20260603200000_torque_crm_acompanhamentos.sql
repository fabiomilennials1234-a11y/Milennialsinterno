-- 20260603200000_torque_crm_acompanhamentos.sql
--
-- Slice 5 (#95) — Board de Acompanhamentos (pós-implantação). ADR 0006 §2.
--
-- O QUE FAZ (idempotente, não-destrutivo):
--   1. Tabela crm_acompanhamentos: ENTIDADE NOVA E INDEPENDENTE do card de
--      implantação (crm_configuracoes). "Dois cards, mundos separados" (ADR §2).
--      Colunas: fazer_follow_up | follow_up_feito | tasks_em_aberto |
--      aguardando_resposta. checklist jsonb (vazio aqui; "Tasks em aberto"
--      ganha edição na Slice #96 reusando o módulo puro checklist.ts).
--      closed_at materializa "acompanhamento ATIVO" (closed_at IS NULL) e
--      sustenta a idempotência do gancho via índice único parcial.
--   2. RLS escopada gestor_crm — replica EXATAMENTE as policies crm_config_*
--      da #91: is_admin OR has_page_access('gestor-crm') OR gestor_id = uid.
--   3. torque_acomp_mover(p_acomp_id, p_coluna) -> void : drag livre, persiste a
--      coluna. Espelha o reducer puro src/lib/torqueCrm/acompanhamento.mover().
--   4. GANCHO em torque_board_pronto: ao concluir a apresentação (board_status
--      'apresentacao' -> 'pronto'), cria AUTOMATICAMENTE um card de
--      acompanhamento NOVO entrando em 'fazer_follow_up'. Idempotente: não
--      duplica se o cliente já tem acompanhamento ativo (ON CONFLICT no índice
--      parcial). O card de PRONTOS continua arquivado — nada é movido/apagado.
--
-- POR QUE GANCHO NA RPC (e não trigger em board_status='pronto'): torque_board_
--   pronto já é o ÚNICO caminho para 'pronto' (guard de estado + gate de data lá
--   dentro). Anexar o INSERT na MESMA transação mantém a verdade num lugar só e
--   atômica. Um trigger em board_status='pronto' dispararia também na migração de
--   cards vivos da #91 (que nascem 'pronto'), criando acompanhamentos fantasma —
--   indesejado. O gancho na RPC é cirúrgico: só na transição real.
--
-- HARDENING (ADR 0004 §3, padrão das RPCs #92–94): SECURITY DEFINER + SET
--   search_path='' + identificadores schema-qualified. Autorização EXPLÍCITA
--   (SECURITY DEFINER bypassa RLS) via _torque_board_pode_escrever (#92).
--
-- QUIRK: gestor_id é TEXT (espelha crm_configuracoes.gestor_id) — comparar
--   auth.uid()::text.

BEGIN;

-- =============================================================================
-- 1. Tabela crm_acompanhamentos — entidade independente do card de implantação.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crm_acompanhamentos (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  gestor_id   text,
  coluna      text        NOT NULL DEFAULT 'fazer_follow_up',
  checklist   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Coluna válida (espelha ACOMP_COLUNAS no TS).
ALTER TABLE public.crm_acompanhamentos
  DROP CONSTRAINT IF EXISTS crm_acompanhamentos_coluna_check;
ALTER TABLE public.crm_acompanhamentos
  ADD CONSTRAINT crm_acompanhamentos_coluna_check
  CHECK (coluna IN ('fazer_follow_up','follow_up_feito','tasks_em_aberto','aguardando_resposta'));

-- checklist deve ser array JSON (mesma defesa de crm_configuracoes).
ALTER TABLE public.crm_acompanhamentos
  DROP CONSTRAINT IF EXISTS crm_acompanhamentos_checklist_is_array_check;
ALTER TABLE public.crm_acompanhamentos
  ADD CONSTRAINT crm_acompanhamentos_checklist_is_array_check
  CHECK (jsonb_typeof(checklist) = 'array');

-- Invariante de idempotência: no máximo UM acompanhamento ATIVO por cliente.
-- Ativo = closed_at IS NULL. Índice parcial = a chave do ON CONFLICT do gancho.
CREATE UNIQUE INDEX IF NOT EXISTS crm_acompanhamentos_um_ativo_por_cliente
  ON public.crm_acompanhamentos (client_id)
  WHERE closed_at IS NULL;

-- Index de leitura do board (por gestor, ativos primeiro).
CREATE INDEX IF NOT EXISTS crm_acompanhamentos_gestor_idx
  ON public.crm_acompanhamentos (gestor_id);

COMMENT ON TABLE public.crm_acompanhamentos IS
  'Board de Acompanhamentos pós-implantação (ADR 0006 §2). Entidade INDEPENDENTE '
  'do card de implantação (crm_configuracoes): dois cards, mundos separados. '
  'Nasce ao cliente cair em PRONTOS (gancho em torque_board_pronto).';
COMMENT ON COLUMN public.crm_acompanhamentos.coluna IS
  'Coluna do board: fazer_follow_up|follow_up_feito|tasks_em_aberto|aguardando_resposta.';
COMMENT ON COLUMN public.crm_acompanhamentos.closed_at IS
  'NULL = acompanhamento ativo (sustenta o índice único de idempotência do gancho). '
  'Fechamento de ciclo chega em slice futura; hoje nada fecha.';

-- updated_at automático (padrão do projeto).
CREATE OR REPLACE FUNCTION public._crm_acomp_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_acomp_touch ON public.crm_acompanhamentos;
CREATE TRIGGER trg_crm_acomp_touch
  BEFORE UPDATE ON public.crm_acompanhamentos
  FOR EACH ROW EXECUTE FUNCTION public._crm_acomp_touch_updated_at();

-- =============================================================================
-- 2. RLS — escopo gestor_crm (replica crm_config_* da #91).
-- =============================================================================
ALTER TABLE public.crm_acompanhamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_acomp_select ON public.crm_acompanhamentos;
CREATE POLICY crm_acomp_select ON public.crm_acompanhamentos
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_page_access(auth.uid(), 'gestor-crm')
    OR gestor_id = auth.uid()::text
  );

DROP POLICY IF EXISTS crm_acomp_write ON public.crm_acompanhamentos;
CREATE POLICY crm_acomp_write ON public.crm_acompanhamentos
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_page_access(auth.uid(), 'gestor-crm')
    OR gestor_id = auth.uid()::text
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_page_access(auth.uid(), 'gestor-crm')
    OR gestor_id = auth.uid()::text
  );

-- =============================================================================
-- 3. torque_acomp_mover — drag livre, persiste a coluna (espelha mover() no TS).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.torque_acomp_mover(
  p_acomp_id uuid,
  p_coluna   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_gestor_id text;
  v_exists    boolean;
BEGIN
  SELECT gestor_id, true INTO v_gestor_id, v_exists
  FROM public.crm_acompanhamentos
  WHERE id = p_acomp_id;

  IF v_exists IS NULL THEN
    RAISE EXCEPTION 'acompanhamento % não existe (referência órfã barrada)', p_acomp_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Autorização (replica crm_acomp_write / crm_config_write da #91).
  IF NOT public._torque_board_pode_escrever(v_gestor_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode mover o acompanhamento %', p_acomp_id
      USING ERRCODE = '42501';
  END IF;

  -- Guard de coluna (espelha acompanhamento.mover / CHECK da tabela). Drag livre:
  -- qualquer coluna válida; sem gate sequencial. Coluna inválida é barrada aqui.
  IF p_coluna NOT IN ('fazer_follow_up','follow_up_feito','tasks_em_aberto','aguardando_resposta') THEN
    RAISE EXCEPTION 'coluna inválida: % (esperado fazer_follow_up|follow_up_feito|tasks_em_aberto|aguardando_resposta)', p_coluna
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.crm_acompanhamentos
     SET coluna = p_coluna
   WHERE id = p_acomp_id;
END;
$$;

COMMENT ON FUNCTION public.torque_acomp_mover(uuid, text) IS
  'Board de Acompanhamentos (ADR 0006 §2, Slice #95): drag livre — move o card '
  'para a coluna informada (sem gate sequencial). Espelha o reducer puro '
  'src/lib/torqueCrm/acompanhamento.mover(). Autoriza como crm_config_* (#91).';

REVOKE ALL ON FUNCTION public.torque_acomp_mover(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.torque_acomp_mover(uuid, text) TO authenticated;

-- =============================================================================
-- 4. Gancho em torque_board_pronto — cria o acompanhamento ao cair em PRONTOS.
--    Reescreve a função da #94 ACRESCENTANDO o INSERT idempotente no fim; toda a
--    lógica anterior (autorização, guard de estado, gate de data) é preservada
--    palavra-por-palavra. O card de implantação PERMANECE em 'pronto' (arquivado).
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
  v_client_id uuid;
BEGIN
  SELECT gestor_id, board_status, apresentacao_at, client_id
    INTO v_gestor_id, v_status, v_at, v_client_id
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

  -- Arquiva o card de implantação em PRONTOS (permanece — não some, ADR §2.5).
  UPDATE public.crm_configuracoes
     SET board_status = 'pronto'
   WHERE id = p_config_id;

  -- GANCHO (Slice #95): cria o card de Acompanhamento NOVO e independente,
  -- entrando em 'fazer_follow_up'. Idempotente — o índice único parcial
  -- (client_id WHERE closed_at IS NULL) garante NO MÁXIMO um ativo por cliente;
  -- ON CONFLICT DO NOTHING não duplica se já existe acompanhamento ativo.
  INSERT INTO public.crm_acompanhamentos (client_id, gestor_id, coluna)
  VALUES (v_client_id, v_gestor_id, 'fazer_follow_up')
  ON CONFLICT (client_id) WHERE (closed_at IS NULL) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.torque_board_pronto(uuid) IS
  'Contrato do board Torque CRM (ADR 0006 §94 + GANCHO §95): conclui a '
  'apresentação (''apresentacao''->''pronto'', arquivado) RE-VALIDANDO o gate de '
  'data no servidor; e cria AUTOMATICAMENTE o card de Acompanhamento '
  '(''fazer_follow_up'') de forma idempotente (um ativo por cliente). Autoriza '
  'como as policies crm_config_* (#91).';

COMMIT;
