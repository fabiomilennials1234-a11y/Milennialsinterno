-- 20260430240000_import_client_pre_validated_rpc.sql
--
-- Importa clientes pré-validados pelo Sucesso do Cliente (planilha massa).
-- Cada cliente entra:
--   - cx_validation_status='validado' (já passou pelo CX)
--   - client_onboarding na current_step indicada pela planilha
--   - SOMENTE 1 onboarding_task (a tarefa que avança para próxima etapa)
-- Sem tarefas retroativas (boas-vindas, call_1, etc).
--
-- 1. Trigger create_initial_onboarding_task ganha bypass via session var
--    `app.skip_initial_task = 'true'` para evitar duplicidade durante import.
-- 2. RPC import_client_pre_validated cria tudo numa transação atomica.

BEGIN;

-- ── 1. Trigger respeita skip via session var ────────────────────────────

CREATE OR REPLACE FUNCTION public.create_initial_onboarding_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skip text;
BEGIN
  -- Bypass durante import em massa.
  v_skip := current_setting('app.skip_initial_task', true);
  IF v_skip = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_ads_manager IS NOT NULL THEN
    INSERT INTO public.onboarding_tasks (
      client_id, assigned_to, task_type, title, description, status, due_date, milestone
    ) VALUES (
      NEW.id, NEW.assigned_ads_manager, 'marcar_call_1', 'Marcar Call 1',
      'Agendar a primeira call com o cliente ' || NEW.name || ' para alinhamento inicial.',
      'pending', NOW() + INTERVAL '1 day', 1
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. RPC import_client_pre_validated ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.import_client_pre_validated(
  p_payload     jsonb,
  p_target_step text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid := auth.uid();
  v_client_id       uuid;
  v_step            text := lower(coalesce(p_target_step, 'marcar_call_1'));
  v_milestone       int;
  v_milestone_col   text;
  v_completed_at    timestamptz;
  v_assigned_ads    uuid;
  v_now             timestamptz := now();
  v_task_type       text;
  v_task_title      text;
  v_task_desc       text;
  v_task_due_days   int := 3;
  v_existing_id     uuid;
  v_executed        text[] := ARRAY[]::text[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'only admins can bulk import clients' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload object required' USING ERRCODE = '22023';
  END IF;

  -- Map step -> milestone + milestone_col + completed_at + advancing task.
  CASE v_step
    WHEN 'marcar_call_1' THEN
      v_milestone := 1; v_milestone_col := 'milestone_1_started_at'; v_completed_at := NULL;
      v_task_type := 'marcar_call_1'; v_task_title := 'Marcar Call 1';
      v_task_desc := 'Agendar a primeira call com o cliente para alinhamento inicial.';
      v_task_due_days := 1;
    WHEN 'criar_estrategia', 'enviar_estrategia', 'onboarding' THEN
      v_milestone := 2; v_milestone_col := 'milestone_2_started_at'; v_completed_at := NULL;
      v_step := 'criar_estrategia';
      v_task_type := 'enviar_estrategia'; v_task_title := 'Enviar estratégia';
      v_task_desc := 'Desenvolver e enviar a estratégia de marketing personalizada para o cliente.';
      v_task_due_days := 3;
    WHEN 'brifar_criativos' THEN
      v_milestone := 3; v_milestone_col := 'milestone_3_started_at'; v_completed_at := NULL;
      v_task_type := 'brifar_criativos'; v_task_title := 'Brifar criativos';
      v_task_desc := 'Criar o briefing dos criativos para o cliente.';
      v_task_due_days := 3;
    WHEN 'elencar_otimizacoes', 'brifar_otimizacoes' THEN
      v_milestone := 4; v_milestone_col := 'milestone_4_started_at'; v_completed_at := NULL;
      v_step := 'elencar_otimizacoes';
      v_task_type := 'brifar_otimizacoes'; v_task_title := 'Brifar otimizações pendentes';
      v_task_desc := 'Elencar e brifar as otimizações pendentes para o cliente.';
      v_task_due_days := 3;
    WHEN 'configurar_conta_anuncios', 'esperando_criativos' THEN
      v_milestone := 5; v_milestone_col := 'milestone_5_started_at'; v_completed_at := NULL;
      v_step := 'configurar_conta_anuncios';
      v_task_type := 'configurar_conta_anuncios'; v_task_title := 'Configurar conta de anúncios';
      v_task_desc := 'Configurar a conta de anúncios para o cliente.';
      v_task_due_days := 2;
    WHEN 'acompanhamento', 'acompanhamento_diario', 'campanha_publicada' THEN
      -- Onboarding completo, em manutenção. Nenhuma tarefa de fluxo.
      v_milestone := 6; v_milestone_col := NULL; v_completed_at := v_now;
      v_step := 'acompanhamento';
      v_task_type := NULL;
    ELSE
      RAISE EXCEPTION 'unsupported target_step: %', p_target_step USING ERRCODE = '22023';
  END CASE;

  v_assigned_ads := NULLIF(p_payload->>'assigned_ads_manager','')::uuid;

  -- Skip trigger create_initial_onboarding_task durante este import.
  PERFORM set_config('app.skip_initial_task', 'true', true);

  -- Insert client com cx_validation_status='validado'.
  INSERT INTO public.clients (
    name, cnpj, cpf, phone, razao_social, niche, general_info,
    expected_investment, monthly_value, sales_percentage,
    group_id, squad_id,
    assigned_ads_manager, assigned_comercial, assigned_crm, assigned_rh,
    assigned_outbound_manager, assigned_mktplace, assigned_sucesso_cliente,
    entry_date, contract_duration_months, payment_due_day,
    contracted_products, torque_crm_products,
    created_by, status,
    comercial_status, comercial_entered_at,
    mktplace_status, mktplace_entered_at,
    crm_status, crm_entered_at,
    cx_validation_status, cx_validated_at, cx_validated_by, cx_validation_notes
  )
  VALUES (
    trim(p_payload->>'name'),
    NULLIF(regexp_replace(coalesce(p_payload->>'cnpj',''),'[^0-9]','','g'),''),
    NULLIF(regexp_replace(coalesce(p_payload->>'cpf',''),'[^0-9]','','g'),''),
    NULLIF(trim(coalesce(p_payload->>'phone','')),''),
    NULLIF(p_payload->>'razao_social',''),
    NULLIF(p_payload->>'niche',''),
    NULLIF(p_payload->>'general_info',''),
    NULLIF(p_payload->>'expected_investment','')::numeric,
    NULLIF(p_payload->>'monthly_value','')::numeric,
    COALESCE(NULLIF(p_payload->>'sales_percentage','')::numeric, 0),
    NULLIF(p_payload->>'group_id','')::uuid,
    NULLIF(p_payload->>'squad_id','')::uuid,
    v_assigned_ads,
    NULLIF(p_payload->>'assigned_comercial','')::uuid,
    NULLIF(p_payload->>'assigned_crm','')::uuid,
    NULLIF(p_payload->>'assigned_rh','')::uuid,
    NULLIF(p_payload->>'assigned_outbound_manager','')::uuid,
    NULLIF(p_payload->>'assigned_mktplace',''),
    NULLIF(p_payload->>'assigned_sucesso_cliente','')::uuid,
    COALESCE(NULLIF(p_payload->>'entry_date','')::date, current_date),
    NULLIF(p_payload->>'contract_duration_months','')::int,
    NULLIF(p_payload->>'payment_due_day','')::int,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(p_payload->'contracted_products')='array'
             THEN p_payload->'contracted_products' ELSE '[]'::jsonb END
      )), ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(p_payload->'torque_crm_products')='array'
             THEN p_payload->'torque_crm_products' ELSE '[]'::jsonb END
      )), ARRAY[]::text[]
    ),
    v_caller,
    'new_client',
    'novo', v_now,
    CASE WHEN NULLIF(p_payload->>'assigned_mktplace','') IS NOT NULL THEN 'novo' ELSE NULL END,
    CASE WHEN NULLIF(p_payload->>'assigned_mktplace','') IS NOT NULL THEN v_now ELSE NULL END,
    CASE WHEN NULLIF(p_payload->>'assigned_crm','')::uuid IS NOT NULL THEN 'novo' ELSE NULL END,
    CASE WHEN NULLIF(p_payload->>'assigned_crm','')::uuid IS NOT NULL THEN v_now ELSE NULL END,
    'validado', v_now, v_caller, 'Importado via planilha — pré-validado'
  )
  RETURNING id INTO v_client_id;

  v_executed := array_append(v_executed, 'insert_client');

  -- Insert client_onboarding na step indicada.
  INSERT INTO public.client_onboarding (client_id, current_milestone, current_step,
    milestone_1_started_at, milestone_2_started_at, milestone_3_started_at,
    milestone_4_started_at, milestone_5_started_at, completed_at)
  VALUES (
    v_client_id,
    v_milestone,
    v_step,
    CASE WHEN v_milestone >= 1 THEN v_now END,
    CASE WHEN v_milestone >= 2 THEN v_now END,
    CASE WHEN v_milestone >= 3 THEN v_now END,
    CASE WHEN v_milestone >= 4 THEN v_now END,
    CASE WHEN v_milestone >= 5 THEN v_now END,
    v_completed_at
  );

  v_executed := array_append(v_executed, 'insert_onboarding');

  -- Cria SOMENTE a tarefa que avança a próxima etapa (se aplicável).
  IF v_task_type IS NOT NULL AND v_assigned_ads IS NOT NULL THEN
    INSERT INTO public.onboarding_tasks (
      client_id, assigned_to, task_type, title, description, status, due_date, milestone
    ) VALUES (
      v_client_id, v_assigned_ads, v_task_type, v_task_title,
      v_task_desc || ' Cliente: ' || (p_payload->>'name'),
      'pending', (v_now + (v_task_due_days || ' days')::interval)::date, v_milestone
    );
    v_executed := array_append(v_executed, 'insert_advancing_task');
  END IF;

  RETURN jsonb_build_object(
    'client_id',  v_client_id,
    'step',       v_step,
    'milestone',  v_milestone,
    'task_type',  v_task_type,
    'executed',   to_jsonb(v_executed)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_client_pre_validated(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_client_pre_validated(jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.import_client_pre_validated(jsonb, text) IS
  'Import em massa de cliente já validado pelo Sucesso do Cliente. Cria onboarding na etapa indicada e SÓ a tarefa que avança para próxima etapa. Apenas admins.';

COMMIT;
