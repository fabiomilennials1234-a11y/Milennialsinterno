-- 20260603160000_torque_crm_board_foundation.sql
--
-- Slice 1 (#91) — Fundação do Board Torque CRM. ADR 0006.
--
-- O QUE FAZ (idempotente, não-destrutivo):
--   1. Estende crm_configuracoes: board_status, checklist (jsonb [{id,label,done}]),
--      apresentacao_at. board_status: a_fazer | tier | apresentacao | pronto.
--   2. Renomeia o tier v8 → torque (consistente com a tag 'esperar_torque'):
--        - solta/recria o CHECK de produto;
--        - UPDATE crm_configuracoes.produto 'v8'→'torque';
--        - UPDATE clients.torque_crm_products (text[]) 'v8'→'torque';
--        - limpa o default stale 'criar_pipeline' de current_step.
--   3. Migra cards vivos preservando progresso: current_step → checklist marcando
--      done o PREFIXO de steps até o current_step (ordem canônica por tier).
--      board_status derivado: is_finalizado → 'pronto'; checklist 100% → 'apresentacao';
--      senão 'tier'. (A FAZER é estado de card recém-gerado; nenhum vivo nasce aqui.)
--   4. Fecha o furo de RLS: a policy atual é USING(true)/WITH CHECK(true) (qualquer
--      authenticated lê/escreve qualquer card). Passa a escopar por
--      admin OR page-grant 'gestor-crm' OR dono (gestor_id = auth.uid()).
--
-- A lógica de prefixo-done espelha src/lib/torqueCrm/migracaoSteps.ts (vitest)
-- e é provada de novo pela pgTAP supabase/tests/gestor-crm/torque_board_migration_test.sql.
--
-- QUIRK: gestor_id é TEXT (não uuid); comparar com auth.uid()::text.

BEGIN;

-- =============================================================================
-- 0. State-machines canônicas por tier (espelham CRM_STEPS_BY_PRODUTO no TS).
--    Função IMMUTABLE auxiliar: ordem dos steps de um tier.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._torque_steps(_produto text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE _produto
    WHEN 'torque' THEN ARRAY[
      'receber_briefing','estruturar_funil','criar_campos','cadastrar_usuarios',
      'importar_leads','agendar_call_apresentacao','conectar_meta_ads',
      'call_apresentacao_treinamento','monitorar_adocao','cobrar_feedback',
      'aplicar_ajustes','call_pos_venda']
    WHEN 'automation' THEN ARRAY[
      'receber_briefing','estruturar_funil','mapear_fluxos_chatbot',
      'configurar_boas_vindas','configurar_atendimento_humano','testar_fluxos',
      'conectar_whatsapp','conectar_meta_ads','agendar_call_apresentacao',
      'call_apresentacao_treinamento','cadastrar_usuarios','importar_leads',
      'monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
    WHEN 'copilot' THEN ARRAY[
      'receber_briefing','treinar_ia','agendar_call_apresentacao',
      'realizar_call_apresentacao','validacao_cliente','finalizar_configuracoes',
      'solicitar_testes','cobrar_feedback','aplicar_ajustes','call_validacao_final',
      'ativar_sistema','call_pos_venda']
    ELSE ARRAY[]::text[]
  END;
$$;

-- Labels humanos (espelham CRM_STEP_LABEL). Fallback = o próprio id do step.
CREATE OR REPLACE FUNCTION public._torque_step_label(_step text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE _step
    WHEN 'receber_briefing' THEN 'Receber briefing do treinador comercial'
    WHEN 'agendar_call_apresentacao' THEN 'Agendar call de apresentação com cliente'
    WHEN 'cobrar_feedback' THEN 'Cobrar feedback do cliente'
    WHEN 'aplicar_ajustes' THEN 'Aplicar ajustes (prazo 2 dias)'
    WHEN 'call_pos_venda' THEN 'Call de pós-venda'
    WHEN 'conectar_meta_ads' THEN 'Conectar Meta Ads ao CRM'
    WHEN 'monitorar_adocao' THEN 'Monitorar adoção nos primeiros dias'
    WHEN 'estruturar_funil' THEN 'Estruturar etapas do funil no CRM'
    WHEN 'criar_campos' THEN 'Criar campos personalizados'
    WHEN 'cadastrar_usuarios' THEN 'Cadastrar usuários da equipe'
    WHEN 'importar_leads' THEN 'Importar base de leads'
    WHEN 'call_apresentacao_treinamento' THEN 'Call de apresentação e treinamento'
    WHEN 'treinar_ia' THEN 'Treinar a IA no CRM (Copilot)'
    WHEN 'realizar_call_apresentacao' THEN 'Realizar call de apresentação'
    WHEN 'validacao_cliente' THEN 'Validação do cliente'
    WHEN 'finalizar_configuracoes' THEN 'Finalizar configurações pós-aprovação'
    WHEN 'solicitar_testes' THEN 'Solicitar testes ao cliente'
    WHEN 'call_validacao_final' THEN 'Call de validação final'
    WHEN 'ativar_sistema' THEN 'Ativar sistema'
    WHEN 'mapear_fluxos_chatbot' THEN 'Mapear fluxos do chatbot'
    WHEN 'configurar_boas_vindas' THEN 'Configurar mensagem de boas-vindas / Follow-up'
    WHEN 'configurar_atendimento_humano' THEN 'Configurar direcionamento para atendimento humano'
    WHEN 'testar_fluxos' THEN 'Testar todos os fluxos internamente'
    WHEN 'conectar_whatsapp' THEN 'Conectar WhatsApp ao CRM'
    ELSE _step
  END;
$$;

-- stepToChecklist no SQL (espelha o módulo TS). Prefixo done até current_step.
CREATE OR REPLACE FUNCTION public.torque_step_to_checklist(_produto text, _current_step text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH steps AS (
    SELECT s AS id, ord
    FROM unnest(public._torque_steps(_produto)) WITH ORDINALITY AS t(s, ord)
  ),
  cutoff AS (
    SELECT COALESCE((SELECT ord FROM steps WHERE id = _current_step), 0) AS c
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'label', public._torque_step_label(s.id),
      'done', (s.ord <= (SELECT c FROM cutoff) AND (SELECT c FROM cutoff) > 0)
    ) ORDER BY s.ord
  ), '[]'::jsonb)
  FROM steps s;
$$;

-- =============================================================================
-- 1. Colunas novas
-- =============================================================================
ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS board_status text NOT NULL DEFAULT 'tier',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS apresentacao_at timestamptz;

-- CHECK de board_status (drop-recreate idempotente)
ALTER TABLE public.crm_configuracoes
  DROP CONSTRAINT IF EXISTS crm_configuracoes_board_status_check;
ALTER TABLE public.crm_configuracoes
  ADD CONSTRAINT crm_configuracoes_board_status_check
  CHECK (board_status IN ('a_fazer','tier','apresentacao','pronto'));

-- checklist deve ser um array JSON
ALTER TABLE public.crm_configuracoes
  DROP CONSTRAINT IF EXISTS crm_configuracoes_checklist_is_array_check;
ALTER TABLE public.crm_configuracoes
  ADD CONSTRAINT crm_configuracoes_checklist_is_array_check
  CHECK (jsonb_typeof(checklist) = 'array');

-- =============================================================================
-- 2. Rename v8 → torque
-- =============================================================================
-- Solta o default stale antes de tocar no CHECK/valores.
ALTER TABLE public.crm_configuracoes ALTER COLUMN current_step DROP DEFAULT;

-- Solta o CHECK antigo de produto, migra os valores, recria com 'torque'.
ALTER TABLE public.crm_configuracoes
  DROP CONSTRAINT IF EXISTS crm_configuracoes_produto_check;

UPDATE public.crm_configuracoes SET produto = 'torque' WHERE produto = 'v8';

ALTER TABLE public.crm_configuracoes
  ADD CONSTRAINT crm_configuracoes_produto_check
  CHECK (produto = ANY (ARRAY['torque'::text,'automation'::text,'copilot'::text]));

-- clients.torque_crm_products é text[]: troca o elemento 'v8' por 'torque'.
UPDATE public.clients
   SET torque_crm_products = array_replace(torque_crm_products, 'v8', 'torque')
 WHERE torque_crm_products IS NOT NULL
   AND 'v8' = ANY (torque_crm_products);

-- =============================================================================
-- 3. Migração de progresso dos cards vivos (preserva trabalho)
-- =============================================================================
UPDATE public.crm_configuracoes c
   SET checklist = public.torque_step_to_checklist(c.produto, c.current_step),
       board_status = CASE
         WHEN c.is_finalizado THEN 'pronto'
         WHEN c.current_step = (public._torque_steps(c.produto))[array_length(public._torque_steps(c.produto),1)]
           THEN 'apresentacao'   -- checklist 100% → pronto para agendar apresentação
         ELSE 'tier'
       END
 WHERE jsonb_array_length(c.checklist) = 0;  -- idempotente: só preenche vazios

-- =============================================================================
-- 4. RLS — fecha o furo USING(true). Escopo gestor_crm (ADR 0006 §consequências).
-- =============================================================================
ALTER TABLE public.crm_configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_config_all ON public.crm_configuracoes;

CREATE POLICY crm_config_select ON public.crm_configuracoes
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_page_access(auth.uid(), 'gestor-crm')
    OR gestor_id = auth.uid()::text
  );

CREATE POLICY crm_config_write ON public.crm_configuracoes
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

COMMENT ON COLUMN public.crm_configuracoes.board_status IS
  'Coluna do board Torque CRM (ADR 0006): a_fazer|tier|apresentacao|pronto.';
COMMENT ON COLUMN public.crm_configuracoes.checklist IS
  'Checklist achatado [{id,label,done}] (ADR 0006). Seed = steps do tier; editável por card. Substitui a state-machine rígida (current_step/checklist_state dormentes).';
COMMENT ON COLUMN public.crm_configuracoes.apresentacao_at IS
  'Data/hora agendada da apresentação (America/Sao_Paulo). NULL até o card entrar em apresentacao.';

COMMIT;
