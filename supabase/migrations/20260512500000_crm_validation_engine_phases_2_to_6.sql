-- =============================================================
-- Motor de Validacao CRM — Fases 2 a 6
--
-- Phase 2: Cronometro por etapa (delay_justification column + blocker)
-- Phase 3: Gatilho D+N (already mostly in place, adds task-level blocked state)
-- Phase 4: Loop de reset (reset_crm_step RPC + validation_log action)
-- Phase 5: Reconciliacao Automation steps
-- Phase 6: Daily tasks integration (no DB changes, frontend-only)
-- =============================================================

BEGIN;

-- ============================================================
-- Phase 2: Add delay_justification to crm_configuracoes
-- ============================================================

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS delay_justification TEXT;

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS delay_justified_at TIMESTAMPTZ;

-- ============================================================
-- Phase 4: Expand validation_log action CHECK + add reset RPC
-- ============================================================

-- Drop and recreate CHECK constraint to add new actions
ALTER TABLE public.crm_validation_log
  DROP CONSTRAINT IF EXISTS crm_validation_log_action_check;

ALTER TABLE public.crm_validation_log
  ADD CONSTRAINT crm_validation_log_action_check
  CHECK (action IN (
    'advance', 'checklist_toggle', 'field_save',
    'blocked', 'reset_loop', 'finalized', 'delay_justification'
  ));

-- ============================================================
-- Phase 2+4: Update advance_crm_step to check deadline overdue
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
  _result JSONB;
  _deadline_ts TIMESTAMPTZ;
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
    _steps := CASE _cfg.produto
      WHEN 'v8' THEN ARRAY['receber_briefing','estruturar_funil','criar_campos','cadastrar_usuarios','importar_leads','agendar_call_apresentacao','conectar_meta_ads','call_apresentacao_treinamento','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
      WHEN 'automation' THEN ARRAY['receber_briefing','estruturar_funil','mapear_fluxos_chatbot','configurar_boas_vindas','configurar_atendimento_humano','testar_fluxos','conectar_whatsapp','conectar_meta_ads','agendar_call_apresentacao','call_apresentacao_treinamento','cadastrar_usuarios','importar_leads','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
      WHEN 'copilot' THEN ARRAY['receber_briefing','treinar_ia','agendar_call_apresentacao','realizar_call_apresentacao','validacao_cliente','finalizar_configuracoes','solicitar_testes','cobrar_feedback','aplicar_ajustes','call_validacao_final','ativar_sistema','call_pos_venda']
    END;

    _idx := array_position(_steps, _cfg.current_step);
    IF _idx IS NULL OR _idx >= array_length(_steps, 1) THEN
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
          delay_justification = NULL,
          delay_justified_at = NULL,
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

  -- 5. Check blocked_until (D+N temporal gate)
  IF _cfg.blocked_until IS NOT NULL AND _cfg.blocked_until > now() THEN
    _blockers := _blockers || jsonb_build_array(
      'Bloqueado ate ' || to_char(_cfg.blocked_until, 'DD/MM/YYYY HH24:MI')
    );
  END IF;

  -- 5b. Check deadline overdue: if step_entered_at + deadline_days < now(),
  --     require delay_justification before advancing
  IF _val.deadline_days IS NOT NULL AND _cfg.step_entered_at IS NOT NULL THEN
    _deadline_ts := _cfg.step_entered_at + (_val.deadline_days || ' days')::interval;
    IF _deadline_ts < now() THEN
      IF _cfg.delay_justification IS NULL OR trim(_cfg.delay_justification) = '' THEN
        _blockers := _blockers || jsonb_build_array(
          'Etapa estourada: justifique o atraso antes de avancar'
        );
      END IF;
    END IF;
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
    WHEN 'automation' THEN ARRAY['receber_briefing','estruturar_funil','mapear_fluxos_chatbot','configurar_boas_vindas','configurar_atendimento_humano','testar_fluxos','conectar_whatsapp','conectar_meta_ads','agendar_call_apresentacao','call_apresentacao_treinamento','cadastrar_usuarios','importar_leads','monitorar_adocao','cobrar_feedback','aplicar_ajustes','call_pos_venda']
    WHEN 'copilot' THEN ARRAY['receber_briefing','treinar_ia','agendar_call_apresentacao','realizar_call_apresentacao','validacao_cliente','finalizar_configuracoes','solicitar_testes','cobrar_feedback','aplicar_ajustes','call_validacao_final','ativar_sistema','call_pos_venda']
  END;

  _idx := array_position(_steps, _cfg.current_step);

  IF _idx IS NULL OR _idx >= array_length(_steps, 1) THEN
    -- Last step: finalize
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
        delay_justification = NULL,
        delay_justified_at = NULL,
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

GRANT EXECUTE ON FUNCTION public.advance_crm_step(UUID, UUID) TO authenticated;

-- ============================================================
-- Phase 4: RPC reset_crm_step — reset loop for validation steps
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_crm_step(
  _config_id UUID,
  _reason TEXT,
  _new_date TEXT DEFAULT NULL,
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
BEGIN
  -- 1. Load config
  SELECT * INTO _cfg
    FROM public.crm_configuracoes
    WHERE id = _config_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Configuracao nao encontrada');
  END IF;

  IF _cfg.is_finalizado THEN
    RETURN jsonb_build_object('success', false, 'error', 'Configuracao ja finalizada');
  END IF;

  -- 2. Load validation rules
  SELECT * INTO _val
    FROM public.crm_step_validations
    WHERE produto = _cfg.produto
      AND step_key = _cfg.current_step;

  IF NOT FOUND OR NOT _val.has_reset_loop THEN
    RETURN jsonb_build_object('success', false, 'error', 'Step nao permite reset loop');
  END IF;

  -- 3. Require reason
  IF _reason IS NULL OR trim(_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motivo do reset obrigatorio');
  END IF;

  -- 4. Reset: zero checklist, increment counter, clear fields
  UPDATE public.crm_configuracoes
    SET checklist_state = '{}'::jsonb,
        field_values = '{}'::jsonb,
        reset_count = COALESCE(reset_count, 0) + 1,
        step_entered_at = now(),
        delay_justification = NULL,
        delay_justified_at = NULL,
        updated_at = now()
    WHERE id = _config_id;

  -- 5. Audit log
  INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
    VALUES (
      _config_id,
      _cfg.current_step,
      'reset_loop',
      jsonb_build_object(
        'reason', _reason,
        'new_date', COALESCE(_new_date, ''),
        'reset_count', COALESCE(_cfg.reset_count, 0) + 1
      ),
      _performed_by
    );

  RETURN jsonb_build_object(
    'success', true,
    'reset_count', COALESCE(_cfg.reset_count, 0) + 1,
    'step_key', _cfg.current_step
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_crm_step(UUID, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================
-- Phase 5: Reconciliation — Automation steps
-- Merge apresentar_funil_crm + demonstrar_chatbot → call_apresentacao_treinamento
-- Add cadastrar_usuarios + importar_leads
-- ============================================================

-- 5a. Insert new step definitions for Automation (if not exist)
INSERT INTO public.crm_step_validations (produto, step_key, step_index, step_label, checklist_items, required_fields, deadline_days, trigger_delay_days, trigger_event, has_reset_loop, marks_timestamp, task_title_template)
VALUES
  ('automation', 'call_apresentacao_treinamento', 9, 'Call de apresentação e treinamento',
   '["Call realizada", "Cliente treinado no CRM e chatbot", "Duvidas esclarecidas"]'::jsonb,
   NULL, 1, NULL, NULL, false, 'training_at',
   '[Automation] Call Apresentação e Treinamento {client_name}'),
  ('automation', 'cadastrar_usuarios', 10, 'Cadastrar usuarios da equipe',
   '["Usuarios cadastrados", "Permissoes configuradas"]'::jsonb,
   NULL, 1, NULL, NULL, false, NULL,
   '[Automation] Cadastrar Usuarios {client_name}'),
  ('automation', 'importar_leads', 11, 'Importar base de leads',
   '["Base de leads recebida", "Importacao concluida"]'::jsonb,
   NULL, 1, NULL, NULL, false, NULL,
   '[Automation] Importar Leads {client_name}')
ON CONFLICT (produto, step_key) DO UPDATE
  SET step_index = EXCLUDED.step_index,
      step_label = EXCLUDED.step_label,
      checklist_items = EXCLUDED.checklist_items,
      task_title_template = EXCLUDED.task_title_template,
      marks_timestamp = EXCLUDED.marks_timestamp;

-- 5b. Update step_index for post-merge steps
-- New order: ...agendar_call_apresentacao(8), call_apresentacao_treinamento(9),
--            cadastrar_usuarios(10), importar_leads(11), monitorar_adocao(12),
--            cobrar_feedback(13), aplicar_ajustes(14), call_pos_venda(15)
UPDATE public.crm_step_validations SET step_index = 12 WHERE produto = 'automation' AND step_key = 'monitorar_adocao';
UPDATE public.crm_step_validations SET step_index = 13 WHERE produto = 'automation' AND step_key = 'cobrar_feedback';
UPDATE public.crm_step_validations SET step_index = 14 WHERE produto = 'automation' AND step_key = 'aplicar_ajustes';
UPDATE public.crm_step_validations SET step_index = 15 WHERE produto = 'automation' AND step_key = 'call_pos_venda';

-- 5c. Migrate live configs that are at the old merged steps
-- apresentar_funil_crm → call_apresentacao_treinamento
UPDATE public.crm_configuracoes
  SET current_step = 'call_apresentacao_treinamento',
      step_entered_at = COALESCE(step_entered_at, now()),
      updated_at = now()
  WHERE produto = 'automation'
    AND current_step = 'apresentar_funil_crm'
    AND is_finalizado = false;

-- demonstrar_chatbot → call_apresentacao_treinamento
UPDATE public.crm_configuracoes
  SET current_step = 'call_apresentacao_treinamento',
      step_entered_at = COALESCE(step_entered_at, now()),
      updated_at = now()
  WHERE produto = 'automation'
    AND current_step = 'demonstrar_chatbot'
    AND is_finalizado = false;

-- 5d. Remove old step definitions (soft: only if no more configs reference them)
DELETE FROM public.crm_step_validations
  WHERE produto = 'automation'
    AND step_key = 'apresentar_funil_crm'
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_configuracoes
      WHERE produto = 'automation' AND current_step = 'apresentar_funil_crm'
    );

DELETE FROM public.crm_step_validations
  WHERE produto = 'automation'
    AND step_key = 'demonstrar_chatbot'
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_configuracoes
      WHERE produto = 'automation' AND current_step = 'demonstrar_chatbot'
    );

-- 5e. Backfill step_entered_at for existing configs that have NULL
UPDATE public.crm_configuracoes
  SET step_entered_at = COALESCE(step_entered_at, updated_at, created_at)
  WHERE step_entered_at IS NULL;

COMMIT;
