-- =============================================================
-- CRM Validation Engine — Phase 7 polish
--
-- 7.5: Add delay_justification_category to crm_configuracoes
-- 7.8: Extend reset_crm_step to accept failed_items
-- 7.9: Notify gestor on step advance via system_notifications
-- =============================================================

BEGIN;

-- ============================================================
-- 7.5: Categorized delay justification
-- ============================================================

ALTER TABLE public.crm_configuracoes
  ADD COLUMN IF NOT EXISTS delay_justification_category TEXT;

-- ============================================================
-- 7.8: Update reset_crm_step to accept failed_items
-- Drop old 4-param overload first to avoid ambiguity
-- ============================================================

DROP FUNCTION IF EXISTS public.reset_crm_step(uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.reset_crm_step(
  _config_id UUID,
  _reason TEXT,
  _new_date TEXT DEFAULT NULL,
  _performed_by UUID DEFAULT NULL,
  _failed_items JSONB DEFAULT NULL
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
        delay_justification_category = NULL,
        updated_at = now()
    WHERE id = _config_id;

  -- 5. Audit log (with failed_items if provided)
  INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
    VALUES (
      _config_id,
      _cfg.current_step,
      'reset_loop',
      jsonb_build_object(
        'reason', _reason,
        'new_date', COALESCE(_new_date, ''),
        'reset_count', COALESCE(_cfg.reset_count, 0) + 1,
        'failed_items', COALESCE(_failed_items, '[]'::jsonb)
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

-- Must re-grant after replacing
GRANT EXECUTE ON FUNCTION public.reset_crm_step(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;

-- ============================================================
-- 7.9: Notify gestor when card advances to a new step
-- Insert into system_notifications from advance_crm_step
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
  _client_name TEXT;
  _next_label TEXT;
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

      -- Notify gestor: finalized
      IF _cfg.gestor_id IS NOT NULL THEN
        SELECT COALESCE(c.razao_social, c.name, 'Cliente') INTO _client_name
          FROM public.clients c WHERE c.id = _cfg.client_id;

        INSERT INTO public.system_notifications (recipient_id, notification_type, title, message, client_id, metadata)
          VALUES (
            _cfg.gestor_id::uuid,
            'crm_step_advance',
            'CRM finalizado: ' || COALESCE(_client_name, 'Cliente'),
            'Configuracao ' || upper(_cfg.produto) || ' do cliente ' || COALESCE(_client_name, '') || ' foi finalizada.',
            _cfg.client_id,
            jsonb_build_object('config_id', _config_id, 'produto', _cfg.produto, 'finalized', true)
          );
      END IF;

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
          delay_justification_category = NULL,
          updated_at = now()
      WHERE id = _config_id;

    INSERT INTO public.crm_validation_log (config_id, step_key, action, details, performed_by)
      VALUES (_config_id, _cfg.current_step, 'advance', jsonb_build_object('next_step', _next_step), _performed_by);

    -- Notify gestor: step advance
    IF _cfg.gestor_id IS NOT NULL THEN
      SELECT COALESCE(c.razao_social, c.name, 'Cliente') INTO _client_name
        FROM public.clients c WHERE c.id = _cfg.client_id;
      SELECT step_label INTO _next_label
        FROM public.crm_step_validations WHERE produto = _cfg.produto AND step_key = _next_step;

      INSERT INTO public.system_notifications (recipient_id, notification_type, title, message, client_id, metadata)
        VALUES (
          _cfg.gestor_id::uuid,
          'crm_step_advance',
          upper(_cfg.produto) || ': Nova etapa — ' || COALESCE(_client_name, 'Cliente'),
          'Proxima etapa: ' || COALESCE(_next_label, _next_step),
          _cfg.client_id,
          jsonb_build_object('config_id', _config_id, 'produto', _cfg.produto, 'next_step', _next_step)
        );
    END IF;

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

  -- 5b. Check deadline overdue
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

    -- Notify gestor: finalized
    IF _cfg.gestor_id IS NOT NULL THEN
      SELECT COALESCE(c.razao_social, c.name, 'Cliente') INTO _client_name
        FROM public.clients c WHERE c.id = _cfg.client_id;

      INSERT INTO public.system_notifications (recipient_id, notification_type, title, message, client_id, metadata)
        VALUES (
          _cfg.gestor_id::uuid,
          'crm_step_advance',
          'CRM finalizado: ' || COALESCE(_client_name, 'Cliente'),
          'Configuracao ' || upper(_cfg.produto) || ' do cliente ' || COALESCE(_client_name, '') || ' foi finalizada.',
          _cfg.client_id,
          jsonb_build_object('config_id', _config_id, 'produto', _cfg.produto, 'finalized', true)
        );
    END IF;

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
        delay_justification_category = NULL,
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

  -- 11. Notify gestor: step advance
  IF _cfg.gestor_id IS NOT NULL THEN
    SELECT COALESCE(c.razao_social, c.name, 'Cliente') INTO _client_name
      FROM public.clients c WHERE c.id = _cfg.client_id;
    SELECT step_label INTO _next_label
      FROM public.crm_step_validations WHERE produto = _cfg.produto AND step_key = _next_step;

    INSERT INTO public.system_notifications (recipient_id, notification_type, title, message, client_id, metadata)
      VALUES (
        _cfg.gestor_id::uuid,
        'crm_step_advance',
        upper(_cfg.produto) || ': Nova etapa — ' || COALESCE(_client_name, 'Cliente'),
        'Proxima etapa: ' || COALESCE(_next_label, _next_step),
        _cfg.client_id,
        jsonb_build_object('config_id', _config_id, 'produto', _cfg.produto, 'next_step', _next_step)
      );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'finalized', false, 'next_step', _next_step);
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_crm_step(UUID, UUID) TO authenticated;

COMMIT;
