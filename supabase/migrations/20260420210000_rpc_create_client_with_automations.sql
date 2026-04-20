-- 20260420210000_rpc_create_client_with_automations.sql
--
-- Wave 1 / Track B.2 — RPC transacional de criação de cliente.
--
-- Substitui (atrás de feature flag) o fluxo orquestrado pelo hook
-- useCreateClient em src/hooks/useClientRegistration.ts:295-605, que hoje
-- executa 9 inserts independentes do client-side, sem atomicidade e com
-- falhas silenciosas em console.error. Em produção isso produziu clientes
-- órfãos (ex.: cliente criado sem onboarding_tasks ou sem financeiro_tasks).
--
-- A função create_client_with_automations(p_payload, p_idempotency_key)
-- move todas as automações para Postgres, num único bloco plpgsql — qualquer
-- RAISE EXCEPTION dispara rollback automático de tudo. Permissão é checada
-- dentro da função (Phase 2): is_executive() OU role in (gestor_projetos,
-- financeiro). SECURITY DEFINER + SET search_path = public.
--
-- Três artefatos são criados aqui:
--   1. public.client_idempotency_keys — tabela de chaves de idempotência
--      (TTL 24h, verificado no Phase 3 da RPC).
--   2. public.feature_flags — tabela de flags com helper is_feature_enabled()
--      (+ seed da flag 'use_rpc_client_creation' com enabled=false).
--   3. public.create_client_with_automations(jsonb, text) — a RPC.
--
-- Hook legado NÃO é alterado aqui — isso é responsabilidade do track B.4.
-- A flag começa OFF: o novo caminho só roda quando o fundador subir a flag.
--
-- Design completo: docs/superpowers/specs/2026-04-20-rpc-create-client-with-automations-design.md
--
-- Interação com triggers existentes:
--   - trigger_create_initial_onboarding_task (AFTER INSERT ON clients) HOJE
--     insere em onboarding_tasks(marcar_call_1) automaticamente quando
--     assigned_ads_manager IS NOT NULL. O hook legado ainda insere manualmente
--     (linhas 371-388), produzindo 2 rows em prod. A RPC PRESERVA a semântica
--     do hook (insere manualmente), tratando duplicata possível como dívida
--     técnica a ser resolvida na Fase 4 do rollout (remover o insert manual
--     OU desabilitar o trigger). Paridade exata > limpeza prematura.
--   - trigger_create_client_cards e create_product_kanban_cards_trigger rodam
--     automaticamente dentro da transação — isso é feature, não bug. Se um
--     card falhar, rollback desfaz o cliente também.

BEGIN;

-- =============================================================================
-- 1. TABELA client_idempotency_keys
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_idempotency_keys (
  key         text PRIMARY KEY,
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cik_created_at
  ON public.client_idempotency_keys(created_at);

CREATE INDEX IF NOT EXISTS idx_cik_client_id
  ON public.client_idempotency_keys(client_id);

ALTER TABLE public.client_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS: "no direct access" — só a RPC (SECURITY DEFINER) escreve/lê.
-- Sem policies para authenticated significa NADA passa pelo PostgREST direto.
-- Fundador/auditoria acessa via service_role apenas.
DROP POLICY IF EXISTS "cik_no_direct_access" ON public.client_idempotency_keys;
CREATE POLICY "cik_no_direct_access"
  ON public.client_idempotency_keys
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.client_idempotency_keys IS
  'Idempotency keys for create_client_with_automations RPC. TTL 24h enforced in RPC logic. No direct access — only RPC (SECURITY DEFINER) reads/writes.';

-- =============================================================================
-- 2. TABELA feature_flags (se não existir)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key                  text PRIMARY KEY,
  enabled              boolean NOT NULL DEFAULT false,
  rollout_percentage   int NOT NULL DEFAULT 0
                         CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_users        uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  description          text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer authenticated pode ler (hook do frontend consulta)
DROP POLICY IF EXISTS "feature_flags_select_authenticated" ON public.feature_flags;
CREATE POLICY "feature_flags_select_authenticated"
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: só admin (ceo/cto/gestor_projetos)
DROP POLICY IF EXISTS "feature_flags_insert_admin" ON public.feature_flags;
CREATE POLICY "feature_flags_insert_admin"
  ON public.feature_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "feature_flags_update_admin" ON public.feature_flags;
CREATE POLICY "feature_flags_update_admin"
  ON public.feature_flags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "feature_flags_delete_admin" ON public.feature_flags;
CREATE POLICY "feature_flags_delete_admin"
  ON public.feature_flags
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

COMMENT ON TABLE public.feature_flags IS
  'Feature flags for runtime rollout control. Consumed by hooks via useFeatureFlag. Only admins can mutate.';

-- Seed row — flag começa OFF
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'use_rpc_client_creation',
  false,
  'Switch client creation to atomic RPC create_client_with_automations. Rollout: founder preview → gestores → global.'
)
ON CONFLICT (key) DO NOTHING;

-- Helper pra frontend/hooks consultarem com rollout_percentage e allowed_users.
-- Caller passa user_id; retorna true se flag global enabled, OU se user está em
-- allowed_users, OU se hash(user_id) mod 100 < rollout_percentage.
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_key text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag public.feature_flags;
  v_bucket int;
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags WHERE key = _key;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_flag.enabled THEN
    RETURN true;
  END IF;

  IF _user_id IS NOT NULL AND _user_id = ANY(v_flag.allowed_users) THEN
    RETURN true;
  END IF;

  IF v_flag.rollout_percentage > 0 AND _user_id IS NOT NULL THEN
    -- hash estável: abs(hashtext(user_id)) mod 100
    v_bucket := abs(hashtext(_user_id::text)) % 100;
    IF v_bucket < v_flag.rollout_percentage THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_feature_enabled(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid) TO authenticated;

-- =============================================================================
-- 3. RPC create_client_with_automations
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
  v_group_id           uuid;
  v_squad_id           uuid;
  v_name               text;
  v_now                timestamptz := now();
BEGIN
  -- ==========================================================================
  -- PHASE 1 — Validação de shape do payload (falha rápido)
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

  -- entry_date: aceitamos NULL (hook legado aceita, DB coluna tem default
  -- CURRENT_DATE), então NÃO exigimos explicitamente — mas se vier, precisa
  -- ser parseável.
  IF (p_payload->>'entry_date') IS NOT NULL THEN
    BEGIN
      v_entry_date := (p_payload->>'entry_date')::date;
    EXCEPTION WHEN invalid_datetime_format OR invalid_text_representation THEN
      RAISE EXCEPTION 'entry_date must be ISO yyyy-mm-dd' USING ERRCODE = 'P0002';
    END;
  ELSE
    v_entry_date := CURRENT_DATE;
  END IF;

  -- CNPJ: se vier, precisa ter 14 dígitos depois de sanitize; vazio ou null → null
  v_cnpj_clean := NULLIF(regexp_replace(COALESCE(p_payload->>'cnpj',''), '[^0-9]', '', 'g'), '');
  IF v_cnpj_clean IS NOT NULL AND length(v_cnpj_clean) <> 14 THEN
    RAISE EXCEPTION 'cnpj must have 14 digits after sanitize (got %)', length(v_cnpj_clean)
      USING ERRCODE = 'P0002';
  END IF;

  -- CPF: se vier, 11 dígitos; vazio/null → null
  v_cpf_clean := NULLIF(regexp_replace(COALESCE(p_payload->>'cpf',''), '[^0-9]', '', 'g'), '');
  IF v_cpf_clean IS NOT NULL AND length(v_cpf_clean) <> 11 THEN
    RAISE EXCEPTION 'cpf must have 11 digits after sanitize (got %)', length(v_cpf_clean)
      USING ERRCODE = 'P0002';
  END IF;

  v_phone_clean := NULLIF(trim(COALESCE(p_payload->>'phone','')), '');

  -- product_values: precisa ser array (ou ausente)
  IF p_payload ? 'product_values' THEN
    IF jsonb_typeof(p_payload->'product_values') <> 'array' THEN
      RAISE EXCEPTION 'product_values must be a jsonb array' USING ERRCODE = 'P0002';
    END IF;
    -- Validar cada entry (shape + monthly_value >= 0)
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

  -- contracted_products: array ou ausente
  IF p_payload ? 'contracted_products'
     AND jsonb_typeof(p_payload->'contracted_products') <> 'array' THEN
    RAISE EXCEPTION 'contracted_products must be a jsonb array' USING ERRCODE = 'P0002';
  END IF;

  -- payment_due_day (se vier): 1..31
  IF (p_payload->>'payment_due_day') IS NOT NULL THEN
    DECLARE
      v_day int := (p_payload->>'payment_due_day')::int;
    BEGIN
      IF v_day < 1 OR v_day > 31 THEN
        RAISE EXCEPTION 'payment_due_day must be 1..31' USING ERRCODE = 'P0002';
      END IF;
    END;
  END IF;

  -- UUID parse dos assigned_*; string vazia → null
  v_assigned_ads   := NULLIF(p_payload->>'assigned_ads_manager','')::uuid;
  v_assigned_comer := NULLIF(p_payload->>'assigned_comercial','')::uuid;
  v_assigned_mktp  := NULLIF(p_payload->>'assigned_mktplace','')::uuid;
  v_assigned_crm   := NULLIF(p_payload->>'assigned_crm','')::uuid;
  v_assigned_rh    := NULLIF(p_payload->>'assigned_rh','')::uuid;
  v_assigned_outb  := NULLIF(p_payload->>'assigned_outbound_manager','')::uuid;
  v_group_id       := NULLIF(p_payload->>'group_id','')::uuid;
  v_squad_id       := NULLIF(p_payload->>'squad_id','')::uuid;

  v_duration_months := COALESCE(NULLIF(p_payload->>'contract_duration_months','')::int, 12);
  IF v_duration_months < 1 OR v_duration_months > 120 THEN
    RAISE EXCEPTION 'contract_duration_months must be 1..120' USING ERRCODE = 'P0002';
  END IF;

  v_contract_exp_date := (v_entry_date + make_interval(months => v_duration_months))::date;

  -- ==========================================================================
  -- PHASE 2 — Permissão
  -- ==========================================================================
  v_step := 'check_permission';

  IF NOT (
    public.is_executive(v_caller_id)
    OR public.has_role(v_caller_id, 'gestor_projetos')
    OR public.has_role(v_caller_id, 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient privilege to create client'
      USING ERRCODE = 'P0003';
  END IF;

  -- ==========================================================================
  -- PHASE 3 — Idempotência
  -- ==========================================================================
  v_step := 'check_idempotency';

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT client_id INTO v_existing_client_id
    FROM public.client_idempotency_keys
    WHERE key = p_idempotency_key
      AND created_at > v_now - interval '24 hours'
      AND created_by = v_caller_id;  -- previne vazamento cross-user

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
  -- PHASE 4 — Inserts (tudo ou nada; rollback implícito em RAISE EXCEPTION)
  -- ==========================================================================

  -- 4.1 INSERT clients (espelha mutationFn linhas 302-343 do hook)
  v_step := 'insert_client';
  INSERT INTO public.clients (
    name, cnpj, cpf, phone,
    razao_social, niche, general_info,
    expected_investment, monthly_value, sales_percentage,
    group_id, squad_id,
    assigned_ads_manager, assigned_comercial,
    assigned_crm, assigned_rh, assigned_outbound_manager, assigned_mktplace,
    entry_date, contract_duration_months, payment_due_day,
    contracted_products, torque_crm_products,
    created_by, status,
    comercial_status, comercial_entered_at,
    mktplace_status, mktplace_entered_at,
    crm_status, crm_entered_at,
    cx_validation_status
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
    -- assigned_mktplace é TEXT na tabela (ver 20260406220000); convertemos.
    CASE WHEN v_assigned_mktp IS NULL THEN NULL ELSE v_assigned_mktp::text END,
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
    'aguardando_validacao'
  )
  RETURNING id INTO v_client_id;

  v_executed := v_executed || 'insert_client';

  -- 4.2 Idempotency record (dentro da transação — rollback se algum passo falhar)
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    v_step := 'insert_idempotency_key';
    INSERT INTO public.client_idempotency_keys (key, client_id, created_by)
    VALUES (p_idempotency_key, v_client_id, v_caller_id);
  END IF;

  -- 4.3 Automações do Gestor de Ads (espelha linhas 348-403 do hook)
  IF v_assigned_ads IS NOT NULL THEN
    -- caller name (pra ads_new_client_notifications.created_by_name)
    SELECT name INTO v_caller_name FROM public.profiles WHERE user_id = v_caller_id;
    IF v_caller_name IS NULL THEN
      v_caller_name := 'Sistema';
    END IF;

    -- ads_tasks: "Marcar Call 1"
    v_step := 'ads_notification_task';
    INSERT INTO public.ads_tasks (
      ads_manager_id, title, description, task_type, status, priority, tags
    ) VALUES (
      v_assigned_ads,
      'Marcar Call 1: ' || v_name,
      'Marcar a primeira call com o cliente ' || v_name
        || '. Ao concluir, o cliente será movido para Call #1 Marcada.',
      'daily', 'todo', 'high',
      ARRAY[
        'client_id:' || v_client_id::text,
        'onboarding_task_type:marcar_call_1'
      ]
    );

    -- ads_new_client_notifications
    v_step := 'ads_notification_record';
    INSERT INTO public.ads_new_client_notifications (
      ads_manager_id, client_id, client_name, created_by, created_by_name
    ) VALUES (
      v_assigned_ads, v_client_id, v_name, v_caller_id, v_caller_name
    );
    v_executed := v_executed || 'ads_notification';

    -- onboarding_tasks (marcar_call_1).
    -- NOTA: trigger_create_initial_onboarding_task também insere uma row.
    -- Preservamos paridade exata com o hook legado (que também duplica hoje).
    -- Dívida técnica tratada na Fase 4 do rollout.
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
    v_executed := v_executed || 'onboarding_task';

    -- client_onboarding (milestone 1)
    v_step := 'client_onboarding';
    INSERT INTO public.client_onboarding (
      client_id, current_milestone, current_step, milestone_1_started_at
    ) VALUES (
      v_client_id, 1, 'marcar_call_1', v_now
    )
    ON CONFLICT (client_id) DO NOTHING;  -- defesa: se um trigger já criou
    v_executed := v_executed || 'client_onboarding';
  END IF;

  -- 4.4 N5: notificação comercial (linhas 406-421)
  IF v_assigned_comer IS NOT NULL THEN
    v_step := 'comercial_notification';
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority, metadata
    ) VALUES (
      v_assigned_comer, 'consultor_comercial', 'new_client_assigned_comercial',
      '🆕 Novo Cliente Atribuído',
      'O cliente "' || v_name || '" foi cadastrado e atribuído a você. '
        || 'Faça o primeiro contato dentro de 24h.',
      v_client_id, 'high',
      jsonb_build_object('created_by', v_caller_id)
    );
    v_executed := v_executed || 'comercial_notification';
  END IF;

  -- 4.5 N6: notificação mktplace (linhas 424-439)
  IF v_assigned_mktp IS NOT NULL THEN
    v_step := 'mktplace_notification';
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type,
      title, message, client_id, priority, metadata
    ) VALUES (
      v_assigned_mktp, 'consultor_mktplace', 'new_client_assigned_mktplace',
      '🆕 Novo Cliente Atribuído',
      'O cliente "' || v_name || '" foi cadastrado e atribuído a você como '
        || 'Consultor(a) de MKT Place.',
      v_client_id, 'high',
      jsonb_build_object('created_by', v_caller_id)
    );
    v_executed := v_executed || 'mktplace_notification';
  END IF;

  -- 4.6 Financeiro per-product (linhas 442-542)
  SELECT COALESCE(jsonb_array_length(p_payload->'product_values'), 0)
    INTO v_pv_count;

  IF v_pv_count > 0 THEN
    -- client_product_values
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
    v_executed := v_executed || 'product_values';

    -- financeiro_tasks (uma por produto)
    v_step := 'financeiro_tasks';
    INSERT INTO public.financeiro_tasks (
      client_id, product_slug, product_name, title, status, due_date
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      v_name || ' — ' || (pv->>'product_name')
        || ' → Cadastrar no Asaas + Enviar 1ª Cobrança',
      'pending',
      (v_now + interval '3 days')
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := v_executed || 'financeiro_tasks';

    -- department_tasks (financeiro) — NOTA: department_tasks.user_id tem
    -- policy USING (user_id = auth.uid()) e aqui o caller NÃO é
    -- necessariamente financeiro. SECURITY DEFINER bypassa RLS — OK.
    v_step := 'financeiro_department_tasks';
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      v_caller_id,
      v_name || ' — ' || (pv->>'product_name')
        || ' → Cadastrar no Asaas + Enviar 1ª Cobrança',
      (pv->>'product_slug'),
      'daily', 'todo', 'high',
      'financeiro', v_client_id,
      (v_now + interval '3 days')
    FROM jsonb_array_elements(p_payload->'product_values') pv;
    v_executed := v_executed || 'financeiro_department_tasks';

    -- financeiro_client_onboarding per-product
    -- NOTA: trigger_create_financeiro_onboarding foi DROPADO em
    -- 20260223100000_financeiro_per_product.sql linha 161. Fazemos insert
    -- direto sem conflito.
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
    v_executed := v_executed || 'financeiro_client_onboarding';

    -- financeiro_active_clients per-product
    v_step := 'financeiro_active_clients';
    INSERT INTO public.financeiro_active_clients (
      client_id, product_slug, product_name, monthly_value,
      invoice_status, contract_expires_at
    )
    SELECT
      v_client_id,
      (pv->>'product_slug'),
      (pv->>'product_name'),
      0,  -- hook legado insere 0 até conclusão das daily tasks (linha 530)
      'em_dia',
      v_contract_exp_date
    FROM jsonb_array_elements(p_payload->'product_values') pv
    ON CONFLICT (client_id, product_slug) DO NOTHING;
    v_executed := v_executed || 'financeiro_active_clients';
  END IF;

  -- 4.7 PM welcome task (Millennials Growth) — linhas 544-552 do hook
  v_is_growth := COALESCE(
    (p_payload->'contracted_products') ? 'millennials-growth',
    false
  );

  IF v_is_growth AND v_group_id IS NOT NULL THEN
    v_step := 'pm_welcome_task';

    -- replicar createWelcomeTaskForProjectManager:
    -- encontrar gestor_projetos no grupo + checar idempotência local + inserir
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
        -- Check idempotência: se já existe welcome task (qualquer status != done)
        IF NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE user_id = v_pm_user_id
            AND related_client_id = v_client_id
            AND department = 'gestor_projetos'
            AND title ILIKE 'Dar boas-vindas para %'
            AND status <> 'done'
        ) THEN
          INSERT INTO public.department_tasks (
            user_id, title, description, task_type, status, priority,
            department, related_client_id, due_date
          ) VALUES (
            v_pm_user_id,
            'Dar boas-vindas para ' || v_name,
            jsonb_build_object(
              'type', 'project_manager_welcome',
              'trigger', 'client_created'
            )::text,
            'daily', 'todo', 'high',
            'gestor_projetos', v_client_id,
            (v_now + interval '1 day')
          );
          v_inserted := true;
        END IF;
      END LOOP;

      IF v_inserted THEN
        v_executed := v_executed || 'pm_welcome_task';
      ELSE
        -- Não é erro — grupo sem PM é caso válido (warning). Hook legado
        -- faz console.warn e segue.
        v_warnings := v_warnings
          || 'pm_welcome_task_skipped: no gestor_projetos found in group (or task already exists)';
      END IF;
    END;
  END IF;

  -- ==========================================================================
  -- PHASE 5 — Retorno
  -- ==========================================================================
  RETURN jsonb_build_object(
    'client_id',            v_client_id,
    'automations_executed', v_executed,
    'warnings',             v_warnings,
    'idempotent_hit',       false,
    'schema_version',       1
  );

-- ============================================================================
-- EXCEPTION: mapeia para ERRCODE semantic-friendly e anexa v_step na mensagem
-- ============================================================================
EXCEPTION
  WHEN unique_violation THEN
    -- CNPJ duplicado tem índice único nomeado 'idx_clients_cnpj_unique'
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
    -- se bateu numa policy, sinaliza como P0003
    RAISE EXCEPTION 'insufficient privilege at step [%]: %', v_step, SQLERRM
      USING ERRCODE = 'P0003';
  WHEN raise_exception THEN
    -- re-raise nossos próprios RAISE (P0001..P0006) preservando código original
    RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_client_with_automations failed at step [%]: % (sqlstate=%)',
      v_step, SQLERRM, SQLSTATE
      USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.create_client_with_automations(jsonb, text) IS
  'Atomic client creation RPC. Replaces useCreateClient hook behind feature flag use_rpc_client_creation. See docs/superpowers/specs/2026-04-20-rpc-create-client-with-automations-design.md. Error codes: P0001 generic, P0002 invalid payload, P0003 unauthorized, P0004 cnpj duplicate, P0005 other unique, P0006 fk violation.';

REVOKE ALL ON FUNCTION public.create_client_with_automations(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_with_automations(jsonb, text) TO authenticated;

COMMIT;
