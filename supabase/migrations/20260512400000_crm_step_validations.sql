-- =============================================================
-- Motor de Validacao de Etapas do CRM
--
-- 1. crm_step_validations   — definicao das regras por step
-- 2. crm_validation_log     — audit trail de acoes de validacao
-- 3. Extensao crm_configuracoes — estado de checklist/campos/bloqueio
-- 4. RPC advance_crm_step   — validacao server-side antes de avancar
-- 5. Seed data              — todas as 38 etapas dos 3 produtos
-- =============================================================

BEGIN;

-- ============================================================
-- 1) crm_step_validations — regras por etapa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crm_step_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto TEXT NOT NULL CHECK (produto IN ('v8', 'automation', 'copilot')),
  step_key TEXT NOT NULL,
  step_index SMALLINT NOT NULL,
  step_label TEXT NOT NULL,
  -- checklist_items: ["Funil estruturado", "Campos criados"]
  checklist_items JSONB,
  -- required_fields: [{"key":"activation_at","type":"datetime","label":"Data de ativacao"}]
  required_fields JSONB,
  -- prazo em dias uteis para esta etapa (null = sem prazo por etapa)
  deadline_days SMALLINT,
  -- trigger_delay_days/trigger_event: cronometro pos-acao
  trigger_delay_days SMALLINT,
  trigger_event TEXT,
  -- has_reset_loop: se ao reprovar volta pro inicio do loop
  has_reset_loop BOOLEAN NOT NULL DEFAULT false,
  -- marks_timestamp: campo de timestamp a gravar (activation_at, training_at)
  marks_timestamp TEXT,
  -- task_title_template: "[{produto}] Titulo {client_name}"
  task_title_template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(produto, step_key)
);

ALTER TABLE public.crm_step_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_validations_select" ON public.crm_step_validations;
CREATE POLICY "step_validations_select"
  ON public.crm_step_validations
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_step_validations_produto
  ON public.crm_step_validations(produto, step_index);

-- ============================================================
-- 2) crm_validation_log — audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crm_validation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.crm_configuracoes(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'advance', 'checklist_toggle', 'field_save',
    'blocked', 'reset_loop', 'finalized'
  )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_validation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validation_log_insert" ON public.crm_validation_log;
CREATE POLICY "validation_log_insert"
  ON public.crm_validation_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "validation_log_select" ON public.crm_validation_log;
CREATE POLICY "validation_log_select"
  ON public.crm_validation_log
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_validation_log_config
  ON public.crm_validation_log(config_id, created_at DESC);

-- ============================================================
-- 3) Extensao crm_configuracoes — estado de checklist/campos
-- ============================================================

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS field_values JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS step_entered_at TIMESTAMPTZ;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS activation_at TIMESTAMPTZ;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS training_at TIMESTAMPTZ;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS reset_count SMALLINT NOT NULL DEFAULT 0;

-- ============================================================
-- 4) RPC advance_crm_step — validacao server-side
-- ============================================================

CREATE OR REPLACE FUNCTION public.advance_crm_step(
  _config_id UUID,
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg RECORD;
  _val RECORD;
  _next_step TEXT;
  _next_val RECORD;
  _blockers JSONB := '[]'::jsonb;
  _cs JSONB;
  _fv JSONB;
  _item TEXT;
  _field RECORD;
  _steps TEXT[];
  _idx INT;
  _client RECORD;
  _result JSONB;
BEGIN
  -- 1. Load config
  SELECT * INTO _cfg
    FROM public.crm_configuracoes
    WHERE id = _config_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'blockers', '["Configuracao nao encontrada"]'::jsonb);
  END IF;

  IF _cfg.is_finalizado THEN
    RETURN jsonb_build_object('allowed', false, 'blockers', '["Configuracao ja finalizada"]'::jsonb);
  END IF;

  -- 2. Load validation rules for current step
  SELECT * INTO _val
    FROM public.crm_step_validations
    WHERE produto = _cfg.produto
      AND step_key = _cfg.current_step;

  -- No validation rules = free pass (backward compat)
  IF NOT FOUND THEN
    -- Just advance without validation
    _steps := CASE _cfg.produto
      WHEN 'v8' THEN ARRAY['receber_briefing','estruturar_funil','criar_campos','cadastrar_usuarios','importar_leads','agendar_call_apresentacao','conectar_meta_ads','call_apresentacao_treinamento','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
      WHEN 'automation' THEN ARRAY['receber_briefing','estruturar_funil','mapear_fluxos_chatbot','configurar_boas_vindas','configurar_atendimento_humano','testar_fluxos','conectar_whatsapp','conectar_meta_ads','agendar_call_apresentacao','apresentar_funil_crm','demonstrar_chatbot','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
      WHEN 'copilot' THEN ARRAY['receber_briefing','treinar_ia','agendar_call_apresentacao','realizar_call_apresentacao','validacao_cliente','finalizar_configuracoes','solicitar_testes','cobrar_feedback','aplicar_ajustes','call_validacao_final','ativar_sistema','call_pos_venda']
    END;

    _idx := array_position(_steps, _cfg.current_step);
    IF _idx IS NULL OR _idx >= array_length(_steps, 1) THEN
      -- Last step: finalize
      UPDATE public.crm_configuracoes
        SET is_finalizado = true,
            finalizado_at = now(),
            updated_at = now()
        WHERE id = _config_id;

      INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
        VALUES (_config_id, _cfg.current_step, 'finalized', '{}'::jsonb, _performed_by);

      RETURN jsonb_build_object('allowed', true, 'finalized', true);
    END IF;

    _next_step := _steps[_idx + 1];
    UPDATE public.crm_configuracoes
      SET current_step = _next_step,
          step_entered_at = now(),
          checklist_state = '{}'::jsonb,
          field_values = '{}'::jsonb,
          blocked_until = NULL,
          updated_at = now()
      WHERE id = _config_id;

    INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
      VALUES (_config_id, _cfg.current_step, 'advance', jsonb_build_object('next_step', _next_step), _performed_by);

    RETURN jsonb_build_object('allowed', true, 'finalized', false, 'next_step', _next_step);
  END IF;

  -- 3. Validate checklist
  _cs := _cfg.checklist_state;
  IF _val.checklist_items IS NOT NULL AND jsonb_array_length(_val.checklist_items) > 0 THEN
    FOR _item IN SELECT jsonb_array_elements_text(_val.checklist_items)
    LOOP
      IF NOT ((_cs->>_item)::boolean IS TRUE) THEN
        _blockers := _blockers || jsonb_build_array('Checklist pendente: ' || _item);
      END IF;
    END LOOP;
  END IF;

  -- 4. Validate required fields
  _fv := _cfg.field_values;
  IF _val.required_fields IS NOT NULL AND jsonb_array_length(_val.required_fields) > 0 THEN
    FOR _field IN SELECT * FROM jsonb_to_recordset(_val.required_fields)
      AS x("key" TEXT, "type" TEXT, "label" TEXT)
    LOOP
      IF _fv->>_field.key IS NULL OR trim(_fv->>_field.key) = '' THEN
        _blockers := _blockers || jsonb_build_array('Campo obrigatorio: ' || _field.label);
      END IF;
    END LOOP;
  END IF;

  -- 5. Check blocked_until
  IF _cfg.blocked_until IS NOT NULL AND _cfg.blocked_until > now() THEN
    _blockers := _blockers || jsonb_build_array(
      'Bloqueado ate ' || to_char(_cfg.blocked_until, 'DD/MM/YYYY HH24:MI')
    );
  END IF;

  -- 6. If blockers, log and return
  IF jsonb_array_length(_blockers) > 0 THEN
    INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
      VALUES (_config_id, _cfg.current_step, 'blocked', jsonb_build_object('blockers', _blockers), _performed_by);

    RETURN jsonb_build_object('allowed', false, 'blockers', _blockers);
  END IF;

  -- 7. All validations passed — determine next step
  _steps := CASE _cfg.produto
    WHEN 'v8' THEN ARRAY['receber_briefing','estruturar_funil','criar_campos','cadastrar_usuarios','importar_leads','agendar_call_apresentacao','conectar_meta_ads','call_apresentacao_treinamento','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
    WHEN 'automation' THEN ARRAY['receber_briefing','estruturar_funil','mapear_fluxos_chatbot','configurar_boas_vindas','configurar_atendimento_humano','testar_fluxos','conectar_whatsapp','conectar_meta_ads','agendar_call_apresentacao','apresentar_funil_crm','demonstrar_chatbot','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
    WHEN 'copilot' THEN ARRAY['receber_briefing','treinar_ia','agendar_call_apresentacao','realizar_call_apresentacao','validacao_cliente','finalizar_configuracoes','solicitar_testes','cobrar_feedback','aplicar_ajustes','call_validacao_final','ativar_sistema','call_pos_venda']
  END;

  _idx := array_position(_steps, _cfg.current_step);

  IF _idx IS NULL OR _idx >= array_length(_steps, 1) THEN
    -- Last step: finalize
    -- Mark timestamps if applicable
    IF _val.marks_timestamp = 'activation_at' THEN
      UPDATE public.crm_configuracoes SET activation_at = now() WHERE id = _config_id;
    ELSIF _val.marks_timestamp = 'training_at' THEN
      UPDATE public.crm_configuracoes SET training_at = now() WHERE id = _config_id;
    END IF;

    UPDATE public.crm_configuracoes
      SET is_finalizado = true,
          finalizado_at = now(),
          updated_at = now()
      WHERE id = _config_id;

    INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
      VALUES (_config_id, _cfg.current_step, 'finalized', '{}'::jsonb, _performed_by);

    RETURN jsonb_build_object('allowed', true, 'finalized', true);
  END IF;

  -- Mark timestamps before advancing
  IF _val.marks_timestamp = 'activation_at' THEN
    UPDATE public.crm_configuracoes SET activation_at = now() WHERE id = _config_id;
  ELSIF _val.marks_timestamp = 'training_at' THEN
    UPDATE public.crm_configuracoes SET training_at = now() WHERE id = _config_id;
  END IF;

  _next_step := _steps[_idx + 1];

  -- 8. Advance step, reset per-step state
  UPDATE public.crm_configuracoes
    SET current_step = _next_step,
        step_entered_at = now(),
        checklist_state = '{}'::jsonb,
        field_values = '{}'::jsonb,
        blocked_until = NULL,
        updated_at = now()
    WHERE id = _config_id;

  -- 9. Check if next step has trigger_delay_days (auto-block)
  SELECT * INTO _next_val
    FROM public.crm_step_validations
    WHERE produto = _cfg.produto
      AND step_key = _next_step;

  IF FOUND AND _next_val.trigger_delay_days IS NOT NULL AND _next_val.trigger_delay_days > 0 THEN
    UPDATE public.crm_configuracoes
      SET blocked_until = now() + (_next_val.trigger_delay_days || ' days')::interval
      WHERE id = _config_id;
  END IF;

  -- 10. Log
  INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
    VALUES (_config_id, _cfg.current_step, 'advance', jsonb_build_object('next_step', _next_step), _performed_by);

  RETURN jsonb_build_object('allowed', true, 'finalized', false, 'next_step', _next_step);
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.advance_crm_step(UUID, UUID) TO authenticated;

-- ============================================================
-- 5) Seed data — ALL 38 steps across 3 products
-- ============================================================

-- =================== V8 (12 steps) ===================

INSERT INTO public.crm_step_validations (produto, step_key, step_index, step_label, checklist_items, required_fields, deadline_days, trigger_delay_days, trigger_event, has_reset_loop, marks_timestamp, task_title_template) VALUES
-- 1. Receber briefing
('v8', 'receber_briefing', 0, 'Receber briefing do treinador comercial',
  '["Briefing recebido do comercial", "Necessidades do cliente mapeadas"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[V8] Receber Briefing {client_name}'),

-- 2. Estruturar funil
('v8', 'estruturar_funil', 1, 'Estruturar etapas do funil no CRM',
  '["Funil criado no CRM", "Etapas nomeadas conforme briefing"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[V8] Estruturar Funil CRM {client_name}'),

-- 3. Criar campos
('v8', 'criar_campos', 2, 'Criar campos personalizados',
  '["Campos personalizados criados", "Validacao de campos OK"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[V8] Criar Campos Personalizados {client_name}'),

-- 4. Cadastrar usuarios
('v8', 'cadastrar_usuarios', 3, 'Cadastrar usuarios da equipe',
  '["Usuarios cadastrados", "Permissoes configuradas"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[V8] Cadastrar Usuarios {client_name}'),

-- 5. Importar leads
('v8', 'importar_leads', 4, 'Importar base de leads',
  '["Base de leads recebida", "Importacao concluida"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[V8] Importar Leads {client_name}'),

-- 6. Agendar call apresentacao
('v8', 'agendar_call_apresentacao', 5, 'Agendar call de apresentacao com cliente',
  '["Call agendada com cliente"]'::jsonb,
  '[{"key":"call_date","type":"datetime","label":"Data/hora da call"}]'::jsonb,
  1, NULL, NULL, false, NULL,
  '[V8] Agendar Call Apresentacao {client_name}'),

-- 7. Conectar Meta Ads
('v8', 'conectar_meta_ads', 6, 'Conectar Meta Ads ao CRM',
  '["Meta Ads conectado", "Pixel configurado"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[V8] Conectar Meta Ads {client_name}'),

-- 8. Call apresentacao e treinamento
('v8', 'call_apresentacao_treinamento', 7, 'Call de apresentacao e treinamento',
  '["Call realizada", "Cliente treinado nas funcoes basicas"]'::jsonb,
  NULL, 1, NULL, NULL, false, 'training_at',
  '[V8] Call Apresentacao e Treinamento {client_name}'),

-- 9. Monitorar adocao
('v8', 'monitorar_adocao', 8, 'Monitorar adocao nos primeiros dias',
  '["Verificado uso do CRM pelo cliente"]'::jsonb,
  NULL, 3, 2, 'pos_treinamento', false, NULL,
  '[V8] Monitorar Adocao {client_name}'),

-- 10. Cobrar feedback
('v8', 'cobrar_feedback', 9, 'Cobrar feedback do cliente',
  '["Feedback recebido"]'::jsonb,
  '[{"key":"feedback_notes","type":"text","label":"Resumo do feedback"}]'::jsonb,
  2, NULL, NULL, false, NULL,
  '[V8] Cobrar Feedback {client_name}'),

-- 11. Aplicar ajustes
('v8', 'aplicar_ajustes', 10, 'Aplicar ajustes (prazo 2 dias)',
  '["Ajustes aplicados conforme feedback"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[V8] Aplicar Ajustes {client_name}'),

-- 12. Call pos-venda
('v8', 'call_pos_venda', 11, 'Call de pos-venda',
  '["Call de pos-venda realizada", "Cliente satisfeito"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[V8] Call Pos-Venda {client_name}');

-- =================== AUTOMATION (15 steps) ===================

INSERT INTO public.crm_step_validations (produto, step_key, step_index, step_label, checklist_items, required_fields, deadline_days, trigger_delay_days, trigger_event, has_reset_loop, marks_timestamp, task_title_template) VALUES
-- 1. Receber briefing
('automation', 'receber_briefing', 0, 'Receber briefing do treinador comercial',
  '["Briefing recebido do comercial", "Fluxos de atendimento mapeados"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Receber Briefing {client_name}'),

-- 2. Estruturar funil
('automation', 'estruturar_funil', 1, 'Estruturar etapas do funil no CRM',
  '["Funil criado no CRM", "Etapas de automacao definidas"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Estruturar Funil CRM {client_name}'),

-- 3. Mapear fluxos chatbot
('automation', 'mapear_fluxos_chatbot', 2, 'Mapear fluxos do chatbot',
  '["Fluxos de chatbot desenhados", "Arvore de decisao validada"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[Automation] Mapear Fluxos Chatbot {client_name}'),

-- 4. Configurar boas-vindas
('automation', 'configurar_boas_vindas', 3, 'Configurar mensagem de boas-vindas / Follow-up',
  '["Mensagem de boas-vindas configurada", "Follow-up automatico ativo"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Configurar Boas-Vindas {client_name}'),

-- 5. Configurar atendimento humano
('automation', 'configurar_atendimento_humano', 4, 'Configurar direcionamento para atendimento humano',
  '["Regras de direcionamento configuradas", "Horarios de atendimento definidos"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Configurar Atendimento Humano {client_name}'),

-- 6. Testar fluxos
('automation', 'testar_fluxos', 5, 'Testar todos os fluxos internamente',
  '["Todos os fluxos testados", "Erros corrigidos"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Testar Fluxos {client_name}'),

-- 7. Conectar WhatsApp
('automation', 'conectar_whatsapp', 6, 'Conectar WhatsApp ao CRM',
  '["WhatsApp conectado", "Numero verificado"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Conectar WhatsApp {client_name}'),

-- 8. Conectar Meta Ads
('automation', 'conectar_meta_ads', 7, 'Conectar Meta Ads ao CRM',
  '["Meta Ads conectado"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Conectar Meta Ads {client_name}'),

-- 9. Agendar call apresentacao
('automation', 'agendar_call_apresentacao', 8, 'Agendar call de apresentacao com cliente',
  '["Call agendada com cliente"]'::jsonb,
  '[{"key":"call_date","type":"datetime","label":"Data/hora da call"}]'::jsonb,
  1, NULL, NULL, false, NULL,
  '[Automation] Agendar Call Apresentacao {client_name}'),

-- 10. Apresentar funil CRM
('automation', 'apresentar_funil_crm', 9, 'Apresentar funil e estrutura do CRM',
  '["Funil apresentado ao cliente", "Duvidas esclarecidas"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Automation] Apresentar Funil CRM {client_name}'),

-- 11. Demonstrar chatbot
('automation', 'demonstrar_chatbot', 10, 'Demonstrar fluxo completo do chatbot',
  '["Demonstracao do chatbot realizada", "Cliente aprovou fluxos"]'::jsonb,
  NULL, 1, NULL, NULL, false, 'training_at',
  '[Automation] Demonstrar Chatbot {client_name}'),

-- 12. Monitorar adocao
('automation', 'monitorar_adocao', 11, 'Monitorar adocao nos primeiros dias',
  '["Verificado uso do CRM e chatbot pelo cliente"]'::jsonb,
  NULL, 3, 2, 'pos_treinamento', false, NULL,
  '[Automation] Monitorar Adocao {client_name}'),

-- 13. Cobrar feedback
('automation', 'cobrar_feedback', 12, 'Cobrar feedback do cliente',
  '["Feedback recebido"]'::jsonb,
  '[{"key":"feedback_notes","type":"text","label":"Resumo do feedback"}]'::jsonb,
  2, NULL, NULL, false, NULL,
  '[Automation] Cobrar Feedback {client_name}'),

-- 14. Aplicar ajustes
('automation', 'aplicar_ajustes', 13, 'Aplicar ajustes (prazo 2 dias)',
  '["Ajustes aplicados conforme feedback"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[Automation] Aplicar Ajustes {client_name}'),

-- 15. Call pos-venda
('automation', 'call_pos_venda', 14, 'Call de pos-venda',
  '["Call de pos-venda realizada", "Cliente satisfeito"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[Automation] Call Pos-Venda {client_name}');

-- =================== COPILOT (12 steps) ===================

INSERT INTO public.crm_step_validations (produto, step_key, step_index, step_label, checklist_items, required_fields, deadline_days, trigger_delay_days, trigger_event, has_reset_loop, marks_timestamp, task_title_template) VALUES
-- 1. Receber briefing
('copilot', 'receber_briefing', 0, 'Receber briefing do treinador comercial',
  '["Briefing recebido do comercial", "Requisitos da IA mapeados"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Copilot] Receber Briefing {client_name}'),

-- 2. Treinar IA
('copilot', 'treinar_ia', 1, 'Treinar a IA no CRM (Copilot)',
  '["IA treinada com dados do cliente", "Respostas testadas internamente"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[Copilot] Treinar IA {client_name}'),

-- 3. Agendar call apresentacao
('copilot', 'agendar_call_apresentacao', 2, 'Agendar call de apresentacao com cliente',
  '["Call agendada com cliente"]'::jsonb,
  '[{"key":"call_date","type":"datetime","label":"Data/hora da call"}]'::jsonb,
  1, NULL, NULL, false, NULL,
  '[Copilot] Agendar Call Apresentacao {client_name}'),

-- 4. Realizar call apresentacao
('copilot', 'realizar_call_apresentacao', 3, 'Realizar call de apresentacao',
  '["Call de apresentacao realizada", "Funcionalidades demonstradas"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Copilot] Realizar Call Apresentacao {client_name}'),

-- 5. Validacao cliente
('copilot', 'validacao_cliente', 4, 'Validacao do cliente',
  '["Cliente aprovou a configuracao"]'::jsonb,
  '[{"key":"client_approved","type":"boolean","label":"Cliente aprovou?"}]'::jsonb,
  2, NULL, NULL, true, NULL,
  '[Copilot] Validacao do Cliente {client_name}'),

-- 6. Finalizar configuracoes
('copilot', 'finalizar_configuracoes', 5, 'Finalizar configuracoes pos-aprovacao',
  '["Configuracoes finais aplicadas"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Copilot] Finalizar Configuracoes {client_name}'),

-- 7. Solicitar testes
('copilot', 'solicitar_testes', 6, 'Solicitar testes ao cliente',
  '["Testes solicitados ao cliente", "Prazo de teste comunicado"]'::jsonb,
  NULL, 2, 2, 'pos_configuracao', false, NULL,
  '[Copilot] Solicitar Testes {client_name}'),

-- 8. Cobrar feedback
('copilot', 'cobrar_feedback', 7, 'Cobrar feedback do cliente',
  '["Feedback recebido"]'::jsonb,
  '[{"key":"feedback_notes","type":"text","label":"Resumo do feedback"}]'::jsonb,
  2, NULL, NULL, false, NULL,
  '[Copilot] Cobrar Feedback {client_name}'),

-- 9. Aplicar ajustes
('copilot', 'aplicar_ajustes', 8, 'Aplicar ajustes (prazo 2 dias)',
  '["Ajustes aplicados conforme feedback"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[Copilot] Aplicar Ajustes {client_name}'),

-- 10. Call validacao final
('copilot', 'call_validacao_final', 9, 'Call de validacao final',
  '["Call de validacao final realizada", "Cliente aprovou versao final"]'::jsonb,
  NULL, 1, NULL, NULL, false, NULL,
  '[Copilot] Call Validacao Final {client_name}'),

-- 11. Ativar sistema
('copilot', 'ativar_sistema', 10, 'Ativar sistema',
  '["Sistema ativado em producao"]'::jsonb,
  NULL, 1, NULL, NULL, false, 'activation_at',
  '[Copilot] Ativar Sistema {client_name}'),

-- 12. Call pos-venda
('copilot', 'call_pos_venda', 11, 'Call de pos-venda',
  '["Call de pos-venda realizada", "Cliente satisfeito"]'::jsonb,
  NULL, 2, NULL, NULL, false, NULL,
  '[Copilot] Call Pos-Venda {client_name}');

COMMIT;
