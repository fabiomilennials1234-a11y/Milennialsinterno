-- 20260515200000_growth_task_description_backfill.sql
--
-- WHY: Growth tasks currently rely on title prefix matching to identify task type.
-- This is fragile (title format changes break automation). Adding a description
-- discriminator 'growth:{type}' makes detection reliable, matching the pattern
-- already used by CRM ('crm-config:{product}').
--
-- Artifacts:
--   1. Backfill existing Growth tasks with description = 'growth:{type}'
--   2. Update create_client_with_automations to set description on PM welcome task

BEGIN;

-- =============================================================================
-- 1. BACKFILL existing Growth tasks with description discriminator
-- =============================================================================
-- Idempotent: only updates rows where description IS NULL or doesn't already
-- have a growth: prefix.

UPDATE public.department_tasks
   SET description = 'growth:welcome'
 WHERE department = 'gestor_projetos'
   AND title ILIKE 'Dar boas-vindas%'
   AND (description IS NULL OR description NOT LIKE 'growth:%');

UPDATE public.department_tasks
   SET description = 'growth:schedule_call'
 WHERE department = 'gestor_projetos'
   AND title ILIKE 'Marcar Call #1%'
   AND (description IS NULL OR description NOT LIKE 'growth:%');

UPDATE public.department_tasks
   SET description = 'growth:do_call'
 WHERE department = 'gestor_projetos'
   AND title ILIKE 'Realizar Call 1%'
   AND (description IS NULL OR description NOT LIKE 'growth:%');

UPDATE public.department_tasks
   SET description = 'growth:align_project'
 WHERE department = 'gestor_projetos'
   AND title ILIKE 'Alinhar Projeto%'
   AND (description IS NULL OR description NOT LIKE 'growth:%');

-- =============================================================================
-- 2. UPDATE RPC: create_client_with_automations
--    Add description = 'growth:welcome' to PM welcome task (section 4.8)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_client_with_automations(
  p_payload          jsonb,
  p_idempotency_key  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id          uuid := auth.uid();
  v_caller_name        text;
  v_client_id          uuid;
  v_existing_client_id uuid;
  v_step               text := 'init';
  v_executed           text[] := ARRAY[]::text[];
  v_warnings           text[] := ARRAY[]::text[];
  v_contract_exp_date  date;
  v_entry_date         date;
  v_duration_months    int;
  v_is_growth          boolean;
  v_is_growth_no_ads   boolean;
  v_pv                 jsonb;
  v_pv_count           int;
  v_cnpj_clean         text;
  v_cpf_clean          text;
  v_phone_clean        text;
  v_assigned_ads       uuid;
  v_assigned_comer     uuid;
  v_assigned_mktp      uuid;
  v_assigned_crm       uuid;
  v_assigned_rh        uuid;
  v_assigned_outb      uuid;
  v_assigned_sucesso   uuid;
  v_group_id           uuid;
  v_squad_id           uuid;
  v_name               text;
  v_now                timestamptz := now();
BEGIN
  -- ==========================================================================
  -- PHASE 1 — Payload validation
  -- ==========================================================================
  v_step := 'validate_payload';

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = 'P0003';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload must be a jsonb object' USING ERRCODE = 'P0002';
  END IF;

  v_name := trim(COALESCE(p_payload->>'name', ''));
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'name is required (min 2 chars)' USING ERRCODE = 'P0002';
  END IF;

  IF (p_payload->>'entry_date') IS NOT NULL THEN
    BEGIN
      v_entry_date := (p_payload->>'entry_date')::date;
    EXCEPTION WHEN invalid_datetime_format OR invalid_text_representation THEN
      RAISE EXCEPTION 'entry_date must be ISO yyyy-mm-dd' USING ERRCODE = 'P0002';
    END;
  ELSE
    v_entry_date := CURRENT_DATE;
  END IF;

  v_cnpj_clean := NULLIF(regexp_replace(COALESCE(p_payload->>'cnpj',''), '[^0-9]', '', 'g'), '');
  IF v_cnpj_clean IS NOT NULL AND length(v_cnpj_clean) <> 14 THEN
    RAISE EXCEPTION 'cnpj must have 14 digits after sanitize (got %)', length(v_cnpj_clean)
      USING ERRCODE = 'P0002';
  END IF;

  v_cpf_clean := NULLIF(regexp_replace(COALESCE(p_payload->>'cpf',''), '[^0-9]', '', 'g'), '');
  IF v_cpf_clean IS NOT NULL AND length(v_cpf_clean) <> 11 THEN
    RAISE EXCEPTION 'cpf must have 11 digits after sanitize (got %)', length(v_cpf_clean)
      USING ERRCODE = 'P0002';
  END IF;

  v_phone_clean := NULLIF(trim(COALESCE(p_payload->>'phone','')), '');

  IF p_payload ? 'product_values' THEN
    IF jsonb_typeof(p_payload->'product_values') <> 'array' THEN
      RAISE EXCEPTION 'product_values must be a jsonb array' USING ERRCODE = 'P0002';
    END IF;
    FOR v_pv IN SELECT * FROM jsonb_array_elements(p_payload->'product_values')
    LOOP
      IF jsonb_typeof(v_pv) <> 'object' THEN
        RAISE EXCEPTION 'each product_values entry must be a jsonb object'
          USING ERRCODE = 'P0002';
      END IF;
      IF (v_pv->>'product_slug') IS NULL OR (v_pv->>'product_name') IS NULL THEN
        RAISE EXCEPTION 'product_values entry requires product_slug and product_name'
          USING ERRCODE = 'P0002';
      END IF;
      IF (v_pv->>'monthly_value') IS NOT NULL
         AND (v_pv->>'monthly_value')::numeric < 0 THEN
        RAISE EXCEPTION 'product_values.monthly_value must be >= 0'
          USING ERRCODE = 'P0002';
      END IF;
    END LOOP;
  END IF;

  IF p_payload ? 'contracted_products'
     AND jsonb_typeof(p_payload->'contracted_products') <> 'array' THEN
    RAISE EXCEPTION 'contracted_products must be a jsonb array' USING ERRCODE = 'P0002';
  END IF;

  IF (p_payload->>'payment_due_day') IS NOT NULL THEN
    DECLARE
      v_day int := (p_payload->>'payment_due_day')::int;
    BEGIN
      IF v_day < 1 OR v_day > 31 THEN
        RAISE EXCEPTION 'payment_due_day must be 1..31' USING ERRCODE = 'P0002';
      END IF;
    END;
  END IF;

  v_assigned_ads     := NULLIF(p_payload->>'assigned_ads_manager','')::uuid;
  v_assigned_comer   := NULLIF(p_payload->>'assigned_comercial','')::uuid;
  v_assigned_mktp    := NULLIF(p_payload->>'assigned_mktplace','')::uuid;
  v_assigned_crm     := NULLIF(p_payload->>'assigned_crm','')::uuid;
  v_assigned_rh      := NULLIF(p_payload->>'assigned_rh','')::uuid;
  v_assigned_outb    := NULLIF(p_payload->>'assigned_outbound_manager','')::uuid;
  v_assigned_sucesso := NULLIF(p_payload->>'assigned_sucesso_cliente','')::uuid;
  v_group_id         := NULLIF(p_payload->>'group_id','')::uuid;
  v_squad_id         := NULLIF(p_payload->>'squad_id','')::uuid;

  v_duration_months := COALESCE(NULLIF(p_payload->>'contract_duration_months','')::int, 12);
  IF v_duration_months < 1 OR v_duration_months > 120 THEN
    RAISE EXCEPTION 'contract_duration_months must be 1..120' USING ERRCODE = 'P0002';
  END IF;

  v_contract_exp_date := (v_entry_date + make_interval(months => v_duration_months))::date;

  -- Detect Growth path
  v_is_growth := COALESCE(
    (p_payload->'contracted_products') ? 'millennials-growth',
    false
  );
  -- Growth WITHOUT ads manager = new Growth onboarding flow
  v_is_growth_no_ads := v_is_growth AND v_assigned_ads IS NULL;

  -- ==========================================================================
  -- PHASE 2 — Permission
  -- ==========================================================================
  v_step := 'check_permission';

  IF NOT (
    public.is_executive(v_caller_id)
    OR public.has_role(v_caller_id, 'gestor_projetos')
    OR public.has_role(v_caller_id, 'financeiro')
    OR public.has_role(v_caller_id, 'sucesso_cliente')
  ) THEN
    RAISE EXCEPTION 'insufficient privilege to create client'
      USING ERRCODE = 'P0003';
  END IF;

  -- ==========================================================================
  -- PHASE 3 — Idempotency
  -- ==========================================================================
  v_step := 'check_idempotency';

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT client_id INTO v_existing_client_id
    FROM public.client_idempotency_keys
    WHERE key = p_idempotency_key
      AND created_at > v_now - interval '24 hours'
      AND created_by = v_caller_id;

    IF v_existing_client_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'client_id',            v_existing_client_id,
        'automations_executed', ARRAY[]::text[],
        'warnings',             ARRAY['idempotent_hit: returned existing client']::text[],
        'idempotent_hit',       true,
        'schema_version',       1
      );
    END IF;
  END IF;

  -- ==========================================================================
  -- PHASE 4 — Inserts (all-or-nothing)
  -- ==========================================================================

  -- 4.1 INSERT clients
  v_step := 'insert_client';
  INSERT INTO public.clients (
    name, cnpj, cpf, phone,
    razao_social, niche, general_info,
    expected_investment, monthly_value, sales_percentage,
    group_id, squad_id,
    assigned_ads_manager, assigned_comercial,
    assigned_crm, assigned_rh, assigned_outbound_manager, assigned_mktplace,
    assigned_sucesso_cliente,
    entry_date, contract_duration_months, payment_due_day,
    contracted_products, torque_crm_products,
    created_by, status,
    comercial_status, comercial_entered_at,
    mktplace_status, mktplace_entered_at,
    crm_status, crm_entered_at,
    cx_validation_status,
    growth_onboarding_step
  )
  VALUES (
    v_name,
    v_cnpj_clean,
    v_cpf_clean,
    v_phone_clean,
    NULLIF(p_payload->>'razao_social',''),
    NULLIF(p_payload->>'niche',''),
    NULLIF(p_payload->>'general_info',''),
    NULLIF(p_payload->>'expected_investment','')::numeric,
    NULLIF(p_payload->>'monthly_value','')::numeric,
    COALESCE(NULLIF(p_payload->>'sales_percentage','')::numeric, 0),
    v_group_id,
    v_squad_id,
    v_assigned_ads,
    v_assigned_comer,
    v_assigned_crm,
    v_assigned_rh,
    v_assigned_outb,
    CASE WHEN v_assigned_mktp IS NULL THEN NULL ELSE v_assigned_mktp::text END,
    v_assigned_sucesso,
    v_entry_date,
    v_duration_months,
    NULLIF(p_payload->>'payment_due_day','')::int,
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(p_payload->'contracted_products') = 'array'
               THEN p_payload->'contracted_products'
               ELSE '[]'::jsonb END
        )
      ),
      ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(p_payload->'torque_crm_products') = 'array'
               THEN p_payload->'torque_crm_products'
               ELSE '[]'::jsonb END
        )
      ),
      ARRAY[]::text[]
    ),
    v_caller_id,
    'new_client',
    'novo', v_now,
    CASE WHEN v_assigned_mktp IS NOT NULL THEN 'novo' ELSE NULL END,
    CASE WHEN v_assigned_mktp IS NOT NULL THEN v_now ELSE NULL END,
    CASE WHEN v_assigned_crm  IS NOT NULL THEN 'novo' ELSE NULL END,
    CASE WHEN v_assigned_crm  IS NOT NULL THEN v_now ELSE NULL END,
    'aguardando_validacao',
    -- Growth-without-ads enters the new flow; others get NULL
    CASE WHEN v_is_growth_no_ads THEN 'novos_clientes' ELSE NULL END
  )
  RETURNING id INTO v_client_id;

  v_executed := array_append(v_executed, 'insert_client');

  -- 4.2 Idempotency record
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    v_step := 'insert_idempotency_key';
    INSERT INTO public.client_idempotency_keys (key, client_id, created_by)
    VALUES (p_idempotency_key, v_client_id, v_caller_id);
  END IF;

  -- 4.3 Growth-without-ads: create BLOQUEADO tag, skip ADS onboarding artifacts
  IF v_is_growth_no_ads THEN
    v_step := 'growth_bloqueado_tag';
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (v_client_id, 'BLOQUEADO: ESPERAR LIGACAO CX', 'growth:novos_clientes')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
    v_executed := array_append(v_executed, 'growth_bloqueado_tag');

    -- Skip sections 4.4-4.6 (ADS onboarding, ads_tasks, onboarding_tasks, client_onboarding)
    -- NOTE: trigger_create_initial_onboarding_task won't fire either because
    -- assigned_ads_manager IS NULL. Safe.

  ELSE
    -- 4.4 ADS onboarding (existing path, unchanged)
    IF v_assigned_ads IS NOT NULL THEN
      SELECT name INTO v_caller_name FROM public.profiles WHERE user_id = v_caller_id;
      IF v_caller_name IS NULL THEN
        v_caller_name := 'Sistema';
      END IF;

      v_step := 'ads_notification_task';
      INSERT INTO public.ads_tasks (
        ads_manager_id, title, description, task_type, status, priority, tags
      ) VALUES (
        v_assigned_ads,
        'Marcar Call 1: ' || v_name,
        'Marcar a primeira call com o cliente ' || v_name
          || '. Ao concluir, o cliente sera movido para Call #1 Marcada.',
        'daily', 'todo', 'high',
        ARRAY[
          'client_id:' || v_client_id::text,
          'onboarding_task_type:marcar_call_1'
        ]
      );

      v_step := 'ads_notification_record';
      INSERT INTO public.ads_new_client_notifications (
        ads_manager_id, client_id, client_name, created_by, created_by_name
      ) VALUES (
        v_assigned_ads, v_client_id, v_name, v_caller_id, v_caller_name
      );
      v_executed := array_append(v_executed, 'ads_notification');

      v_step := 'onboarding_task';
      INSERT INTO public.onboarding_tasks (
        client_id, assigned_to, task_type, title, description,
        status, due_date, milestone
      ) VALUES (
        v_client_id, v_assigned_ads, 'marcar_call_1',
        'Marcar Call 1: ' || v_name,
        'Agendar a primeira call com o cliente para alinhamento inicial. Cliente: '
          || v_name || '.',
        'pending',
        (v_now + interval '1 day'),
        1
      );
      v_executed := array_append(v_executed, 'onboarding_task');

      v_step := 'client_onboarding';
      INSERT INTO public.client_onboarding (
        client_id, current_milestone, current_step, milestone_1_started_at
      ) VALUES (
        v_client_id, 1, 'marcar_call_1', v_now
      )
      ON CONFLICT (client_id) DO NOTHING;
      v_executed := array_append(v_executed, 'client_onboarding');
    END IF;
  END IF;

  -- 4.5 N5: comercial notification (runs for ALL paths including Growth)
  IF v_assigned_comer IS NOT NULL THEN
    v_step := 'comercial_notification';
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority, metadata
    ) VALUES (
      v_assigned_comer, 'consultor_comercial', 'new_client_assigned_comercial',
      'Novo Cliente Atribuido',
      'O cliente "' || v_name || '" foi cadastrado e atribuido a voce. '
        || 'Faca o primeiro contato dentro de 24h.',
      v_client_id, 'high',
      jsonb_build_object('created_by', v_caller_id)
    );
    v_executed := array_append(v_executed, 'comercial_notification');
  END IF;

  -- 4.6 N6: mktplace notification (runs for ALL paths including Growth)
  IF v_assigned_mktp IS NOT NULL THEN
    v_step := 'mktplace_notification';
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority, metadata
    ) VALUES (
      v_assigned_mktp, 'consultor_mktplace', 'new_client_assigned_mktplace',
      'Novo Cliente Atribuido',
      'O cliente "' || v_name || '" foi cadastrado e atribuido a voce como '
        || 'Consultor(a) de MKT Place.',
      v_client_id, 'high',
      jsonb_build_object('created_by', v_caller_id)
    );
    v_executed := array_append(v_executed, 'mktplace_notification');
  END IF;

  -- 4.7 Financeiro per-product (runs for ALL paths)
  SELECT COALESCE(jsonb_array_length(p_payload->'product_values'), 0)
    INTO v_pv_count;

  IF v_pv_count > 0 THEN
    v_step := 'product_values';
    INSERT INTO public.client_product_values (
      client_id, product_slug, product_name, monthly_value
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      COALESCE((pv->>'monthly_value')::numeric, 0)
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := array_append(v_executed, 'product_values');

    v_step := 'financeiro_tasks';
    INSERT INTO public.financeiro_tasks (
      client_id, product_slug, product_name, title, status, due_date
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      v_name || ' — ' || (pv->>'product_name')
        || ' → Cadastrar no Asaas + Enviar 1a Cobranca',
      'pending',
      (v_now + interval '3 days')
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := array_append(v_executed, 'financeiro_tasks');

    v_step := 'financeiro_department_tasks';
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      v_caller_id,
      v_name || ' — ' || (pv->>'product_name')
        || ' → Cadastrar no Asaas + Enviar 1a Cobranca',
      (pv->>'product_slug'),
      'daily', 'todo', 'high',
      'financeiro', v_client_id,
      (v_now + interval '3 days')
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := array_append(v_executed, 'financeiro_department_tasks');

    v_step := 'financeiro_client_onboarding';
    INSERT INTO public.financeiro_client_onboarding (
      client_id, product_slug, product_name, current_step,
      contract_expiration_date
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      'novo_cliente',
      v_contract_exp_date
    FROM jsonb_array_elements(p_payload->'product_values') pv
    ON CONFLICT (client_id, product_slug) DO NOTHING;
    v_executed := array_append(v_executed, 'financeiro_client_onboarding');

    v_step := 'financeiro_active_clients';
    INSERT INTO public.financeiro_active_clients (
      client_id, product_slug, product_name, monthly_value,
      invoice_status, contract_expires_at
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      0,
      'em_dia',
      v_contract_exp_date
    FROM jsonb_array_elements(p_payload->'product_values') pv
    ON CONFLICT (client_id, product_slug) DO NOTHING;
    v_executed := array_append(v_executed, 'financeiro_active_clients');
  END IF;

  -- 4.8 PM welcome task (Millennials Growth — both paths)
  -- NOW with description = 'growth:welcome' discriminator
  IF v_is_growth AND v_group_id IS NOT NULL THEN
    v_step := 'pm_welcome_task';

    DECLARE
      v_pm_user_id uuid;
      v_inserted   boolean := false;
    BEGIN
      FOR v_pm_user_id IN
        SELECT p.user_id
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE p.group_id = v_group_id
          AND ur.role = 'gestor_projetos'
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE user_id = v_pm_user_id
            AND related_client_id = v_client_id
            AND department = 'gestor_projetos'
            AND description = 'growth:welcome'
            AND status <> 'done'
        ) THEN
          INSERT INTO public.department_tasks (
            user_id, title, description, task_type, status, priority,
            department, related_client_id, due_date
          ) VALUES (
            v_pm_user_id,
            'Dar boas-vindas para ' || v_name,
            'growth:welcome',
            'daily', 'todo', 'high',
            'gestor_projetos', v_client_id,
            (v_now + interval '1 day')
          );
          v_inserted := true;
        END IF;
      END LOOP;

      IF v_inserted THEN
        v_executed := array_append(v_executed, 'pm_welcome_task');
      ELSE
        v_warnings := array_append(
          v_warnings,
          'pm_welcome_task_skipped: no gestor_projetos found in group (or task already exists)'
        );
      END IF;
    END;
  END IF;

  -- ==========================================================================
  -- PHASE 5 — Return
  -- ==========================================================================
  RETURN jsonb_build_object(
    'client_id',            v_client_id,
    'automations_executed', v_executed,
    'warnings',             v_warnings,
    'idempotent_hit',       false,
    'schema_version',       1
  );

EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM ILIKE '%idx_clients_cnpj_unique%' THEN
      RAISE EXCEPTION 'cnpj already registered (step=%): %', v_step, SQLERRM
        USING ERRCODE = 'P0004';
    ELSE
      RAISE EXCEPTION 'unique violation at step [%]: %', v_step, SQLERRM
        USING ERRCODE = 'P0005';
    END IF;
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'foreign key violation at step [%]: %', v_step, SQLERRM
      USING ERRCODE = 'P0006';
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'insufficient privilege at step [%]: %', v_step, SQLERRM
      USING ERRCODE = 'P0003';
  WHEN raise_exception THEN
    RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_client_with_automations failed at step [%]: % (sqlstate=%)',
      v_step, SQLERRM, SQLSTATE
      USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.create_client_with_automations(jsonb, text) IS
  'Atomic client creation RPC. Roles: executive, gestor_projetos, financeiro, sucesso_cliente. Growth-without-ads path: sets growth_onboarding_step=novos_clientes, creates BLOQUEADO tag, skips ADS onboarding. PM welcome task now uses description=growth:welcome discriminator. Error codes: P0001 generic, P0002 invalid payload, P0003 unauthorized, P0004 cnpj duplicate, P0005 other unique, P0006 fk violation.';

REVOKE ALL ON FUNCTION public.create_client_with_automations(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_client_with_automations(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_client_with_automations(jsonb, text) TO authenticated;

-- Also update the "Esperar Briefing" trigger to detect via description
-- (with title fallback for backward compat)
CREATE OR REPLACE FUNCTION public.trg_dismiss_esperar_briefing_on_alinhar_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status transitions to 'done'
  IF NEW.status = 'done'
     AND (OLD.status IS DISTINCT FROM 'done')
     AND NEW.related_client_id IS NOT NULL
     AND (
       NEW.description = 'growth:align_project'
       OR NEW.title ILIKE 'Alinhar Projeto%'
     ) THEN

    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_by = NULL,
           dismissed_reason = 'alinhar_projeto_completed'
     WHERE client_id = NEW.related_client_id
       AND name = 'Esperar Briefing'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
