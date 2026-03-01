-- =============================================
-- FINANCEIRO PER-PRODUCT: Cada produto = 1 cliente financeiro
-- =============================================

-- 1. Add product_slug, product_name, and contract_expiration_date columns
ALTER TABLE public.financeiro_active_clients
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT;

ALTER TABLE public.financeiro_client_onboarding
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS contract_expiration_date TIMESTAMP WITH TIME ZONE;

-- 2. DROP old UNIQUE constraints FIRST (before inserting per-product rows)
ALTER TABLE public.financeiro_active_clients
  DROP CONSTRAINT IF EXISTS financeiro_active_clients_client_id_key;

ALTER TABLE public.financeiro_client_onboarding
  DROP CONSTRAINT IF EXISTS financeiro_client_onboarding_client_id_key;

-- 3. Migrate financeiro_active_clients: expand to per-product rows
-- (WHERE product_slug IS NULL = only process rows not yet migrated, safe to re-run)
DO $$
DECLARE
  rec RECORD;
  pv RECORD;
  is_first BOOLEAN;
BEGIN
  FOR rec IN
    SELECT fac.id, fac.client_id, fac.monthly_value, fac.invoice_status,
           fac.contract_expires_at, fac.activated_at, fac.created_at
    FROM public.financeiro_active_clients fac
    WHERE fac.product_slug IS NULL
  LOOP
    is_first := TRUE;

    FOR pv IN
      SELECT cpv.product_slug, cpv.product_name, cpv.monthly_value
      FROM public.client_product_values cpv
      WHERE cpv.client_id = rec.client_id
      ORDER BY cpv.created_at ASC
    LOOP
      IF is_first THEN
        UPDATE public.financeiro_active_clients
        SET product_slug = pv.product_slug,
            product_name = pv.product_name,
            monthly_value = pv.monthly_value
        WHERE id = rec.id;
        is_first := FALSE;
      ELSE
        INSERT INTO public.financeiro_active_clients (
          client_id, product_slug, product_name, monthly_value,
          invoice_status, contract_expires_at, activated_at, created_at
        ) VALUES (
          rec.client_id, pv.product_slug, pv.product_name, pv.monthly_value,
          rec.invoice_status, rec.contract_expires_at, rec.activated_at, rec.created_at
        );
      END IF;
    END LOOP;

    IF is_first THEN
      UPDATE public.financeiro_active_clients
      SET product_slug = 'unknown', product_name = 'Produto Desconhecido'
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- 4. Migrate financeiro_client_onboarding: expand to per-product rows
-- Note: contract_expiration_date is a new column (NULL for existing rows)
DO $$
DECLARE
  rec RECORD;
  pv RECORD;
  is_first BOOLEAN;
BEGIN
  FOR rec IN
    SELECT fco.id, fco.client_id, fco.current_step,
           fco.step_cadastro_asaas_at, fco.step_contrato_juridico_at,
           fco.step_contrato_enviado_at, fco.step_esperando_assinatura_at,
           fco.step_contrato_assinado_at, fco.created_at, fco.updated_at
    FROM public.financeiro_client_onboarding fco
    WHERE fco.product_slug IS NULL
  LOOP
    is_first := TRUE;

    FOR pv IN
      SELECT cpv.product_slug, cpv.product_name
      FROM public.client_product_values cpv
      WHERE cpv.client_id = rec.client_id
      ORDER BY cpv.created_at ASC
    LOOP
      IF is_first THEN
        UPDATE public.financeiro_client_onboarding
        SET product_slug = pv.product_slug,
            product_name = pv.product_name
        WHERE id = rec.id;
        is_first := FALSE;
      ELSE
        INSERT INTO public.financeiro_client_onboarding (
          client_id, product_slug, product_name, current_step,
          step_cadastro_asaas_at, step_contrato_juridico_at,
          step_contrato_enviado_at, step_esperando_assinatura_at,
          step_contrato_assinado_at, created_at, updated_at
        ) VALUES (
          rec.client_id, pv.product_slug, pv.product_name, rec.current_step,
          rec.step_cadastro_asaas_at, rec.step_contrato_juridico_at,
          rec.step_contrato_enviado_at, rec.step_esperando_assinatura_at,
          rec.step_contrato_assinado_at, rec.created_at, rec.updated_at
        );
      END IF;
    END LOOP;

    IF is_first THEN
      UPDATE public.financeiro_client_onboarding
      SET product_slug = 'unknown', product_name = 'Produto Desconhecido'
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- 5. Make product_slug NOT NULL now that all rows have values
ALTER TABLE public.financeiro_active_clients
  ALTER COLUMN product_slug SET NOT NULL;
ALTER TABLE public.financeiro_active_clients
  ALTER COLUMN product_name SET NOT NULL;

ALTER TABLE public.financeiro_client_onboarding
  ALTER COLUMN product_slug SET NOT NULL;
ALTER TABLE public.financeiro_client_onboarding
  ALTER COLUMN product_name SET NOT NULL;

-- 6. Add new composite UNIQUE constraints (IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_active_clients_client_product_key'
  ) THEN
    ALTER TABLE public.financeiro_active_clients
      ADD CONSTRAINT financeiro_active_clients_client_product_key UNIQUE (client_id, product_slug);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_client_onboarding_client_product_key'
  ) THEN
    ALTER TABLE public.financeiro_client_onboarding
      ADD CONSTRAINT financeiro_client_onboarding_client_product_key UNIQUE (client_id, product_slug);
  END IF;
END;
$$;

-- 7. Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_fac_product_slug ON public.financeiro_active_clients(product_slug);
CREATE INDEX IF NOT EXISTS idx_fco_product_slug ON public.financeiro_client_onboarding(product_slug);
CREATE INDEX IF NOT EXISTS idx_fco_client_step ON public.financeiro_client_onboarding(client_id, current_step);

-- 8. Disable the old trigger that creates ONE onboarding record per client
DROP TRIGGER IF EXISTS trigger_create_financeiro_onboarding ON public.clients;

-- 9. Update process_upsell trigger to create financeiro records per-product
CREATE OR REPLACE FUNCTION public.process_upsell()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_value NUMERIC;
  v_client_name TEXT;
  v_current_products TEXT[];
  v_board_id UUID;
  v_column_id UUID;
  v_max_position INT;
  v_entry_date DATE;
  v_contract_duration INT;
  v_contract_expiration DATE;
BEGIN
  v_commission_value := NEW.monthly_value * 0.07;

  INSERT INTO public.upsell_commissions (
    upsell_id, user_id, user_name, commission_value, commission_percentage
  ) VALUES (
    NEW.id, NEW.sold_by, NEW.sold_by_name, v_commission_value, 7
  );

  SELECT name, COALESCE(contracted_products, ARRAY[]::TEXT[]),
         COALESCE(entry_date::DATE, CURRENT_DATE), COALESCE(contract_duration_months, 12)
  INTO v_client_name, v_current_products, v_entry_date, v_contract_duration
  FROM public.clients
  WHERE id = NEW.client_id;

  IF NOT (NEW.product_slug = ANY(v_current_products)) THEN
    UPDATE public.clients
    SET
      contracted_products = array_append(COALESCE(contracted_products, ARRAY[]::TEXT[]), NEW.product_slug),
      updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  INSERT INTO public.client_product_values (client_id, product_slug, product_name, monthly_value)
  VALUES (NEW.client_id, NEW.product_slug, NEW.product_name, NEW.monthly_value)
  ON CONFLICT (client_id, product_slug)
  DO UPDATE SET monthly_value = EXCLUDED.monthly_value, updated_at = now();

  IF NEW.product_slug != 'millennials-growth' THEN
    SELECT id INTO v_board_id
    FROM kanban_boards
    WHERE slug = NEW.product_slug
    LIMIT 1;

    IF v_board_id IS NOT NULL THEN
      SELECT id INTO v_column_id
      FROM kanban_columns
      WHERE board_id = v_board_id
        AND (title ILIKE '%novo cliente%' OR title ILIKE '%novos clientes%')
      ORDER BY position ASC
      LIMIT 1;

      IF v_column_id IS NULL THEN
        SELECT id INTO v_column_id
        FROM kanban_columns
        WHERE board_id = v_board_id
        ORDER BY position ASC
        LIMIT 1;
      END IF;

      IF v_column_id IS NOT NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
        FROM kanban_cards
        WHERE column_id = v_column_id AND archived = false;

        INSERT INTO kanban_cards (
          board_id, column_id, title, description,
          client_id, card_type, created_by, priority, position
        ) VALUES (
          v_board_id, v_column_id,
          'UP Sell: ' || v_client_name,
          'Produto: ' || NEW.product_name || E'\n' ||
          'Valor Mensal: R$ ' || NEW.monthly_value::TEXT || E'\n' ||
          'Vendido por: ' || NEW.sold_by_name,
          NEW.client_id,
          'upsell',
          NEW.sold_by,
          'high',
          v_max_position
        );
      END IF;
    END IF;
  END IF;

  -- FINANCEIRO PER-PRODUCT
  v_contract_expiration := v_entry_date + (v_contract_duration || ' months')::INTERVAL;

  INSERT INTO public.financeiro_client_onboarding (
    client_id, product_slug, product_name, current_step, contract_expiration_date
  ) VALUES (
    NEW.client_id, NEW.product_slug, NEW.product_name, 'novo_cliente',
    v_contract_expiration
  )
  ON CONFLICT (client_id, product_slug) DO NOTHING;

  INSERT INTO public.financeiro_active_clients (
    client_id, product_slug, product_name, monthly_value, invoice_status,
    contract_expires_at
  ) VALUES (
    NEW.client_id, NEW.product_slug, NEW.product_name, 0, 'em_dia',
    v_contract_expiration
  )
  ON CONFLICT (client_id, product_slug) DO NOTHING;

  INSERT INTO public.financeiro_tasks (
    client_id, product_slug, product_name, title, status, due_date
  ) VALUES (
    NEW.client_id, NEW.product_slug, NEW.product_name,
    v_client_name || ' — ' || NEW.product_name || ' → Cadastrar no Asaas + Enviar 1ª Cobrança',
    'pending',
    now() + INTERVAL '3 days'
  );

  RETURN NEW;
END;
$$;
