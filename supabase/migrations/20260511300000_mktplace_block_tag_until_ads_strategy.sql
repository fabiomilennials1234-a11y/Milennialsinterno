-- Tag "Aguardando Estratégia de Tráfego"
--
-- Regras:
--   - Criada quando cliente entra no fluxo MKT Place (assigned_mktplace IS NOT NULL
--     e mktplace_status = 'novo').
--   - NÃO se aplica se o cliente já atingiu milestone >= 2 no onboarding ADS
--     (current_step em 'criar_estrategia' ou posterior).
--   - Auto-dismiss quando client_onboarding.current_step avança para
--     'criar_estrategia' ou qualquer step posterior (milestone >= 2).
--   - Enquanto ativa, bloqueia avanço de etapas no kanban MKT Place (frontend guard).
--
-- Implementação segue padrão de 20260428090000_client_tag_growth_onboarding.sql:
--   1. Função compartilhada de criação da tag
--   2. Trigger AFTER INSERT em clients
--   3. Trigger AFTER UPDATE OF mktplace_status em clients (re-entrada)
--   4. Trigger AFTER UPDATE em client_onboarding (auto-dismiss)
--   5. Backfill de clientes existentes

-- Steps do onboarding ADS que indicam que "Criar Estratégia" já foi atingida ou ultrapassada
-- (milestone >= 2). Qualquer step nesta lista significa que o bloqueio deve ser removido.
-- Referência: advance_client_onboarding_stage() e AdsOnboardingSection.tsx MILESTONE_CARDS.

-- ── 1. Função compartilhada de criação da tag ───────────────────────────────
CREATE OR REPLACE FUNCTION public.maybe_create_mktplace_ads_block_tag(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_assigned   text;
  v_status     text;
  v_milestone  int;
BEGIN
  -- Check MKT Place assignment and status
  SELECT assigned_mktplace, mktplace_status
  INTO v_assigned, v_status
  FROM public.clients
  WHERE id = p_client_id;

  -- Only create tag if client is assigned to MKT Place and status is 'novo'
  IF v_assigned IS NULL OR v_status IS DISTINCT FROM 'novo' THEN
    RETURN;
  END IF;

  -- Check if client already reached milestone >= 2 in ADS onboarding
  SELECT current_milestone
  INTO v_milestone
  FROM public.client_onboarding
  WHERE client_id = p_client_id;

  IF v_milestone IS NOT NULL AND v_milestone >= 2 THEN
    RETURN;
  END IF;

  -- Create the blocking tag
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (p_client_id, 'Aguardando Estratégia de Tráfego', 'mktplace_novo:aguardando_ads_estrategia')
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
END;
$func$;

-- ── 2. Trigger AFTER INSERT em clients ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_mktplace_ads_block_on_client_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  PERFORM public.maybe_create_mktplace_ads_block_tag(NEW.id);
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_mktplace_ads_block_on_client_insert ON public.clients;
CREATE TRIGGER trg_mktplace_ads_block_on_client_insert
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mktplace_ads_block_on_client_insert();

-- ── 3. Trigger AFTER UPDATE OF mktplace_status (cobre re-entrada em 'novo') ─
CREATE OR REPLACE FUNCTION public.trg_mktplace_ads_block_on_status_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.mktplace_status = 'novo'
     AND (OLD.mktplace_status IS DISTINCT FROM NEW.mktplace_status) THEN
    PERFORM public.maybe_create_mktplace_ads_block_tag(NEW.id);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_mktplace_ads_block_on_status_novo ON public.clients;
CREATE TRIGGER trg_mktplace_ads_block_on_status_novo
  AFTER UPDATE OF mktplace_status ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mktplace_ads_block_on_status_novo();

-- ── 4. Trigger AFTER UPDATE em client_onboarding (auto-dismiss) ─────────────
-- Dismiss tag when client reaches milestone >= 2 (criar_estrategia or beyond)
CREATE OR REPLACE FUNCTION public.dismiss_mktplace_ads_block_on_strategy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Only act on milestone transition to >= 2
  IF NEW.current_milestone >= 2
     AND (OLD.current_milestone IS NULL OR OLD.current_milestone < 2) THEN
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_by = NULL  -- automático
     WHERE client_id = NEW.client_id
       AND name      = 'Aguardando Estratégia de Tráfego'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_dismiss_mktplace_ads_block_on_strategy ON public.client_onboarding;
CREATE TRIGGER trg_dismiss_mktplace_ads_block_on_strategy
  AFTER UPDATE ON public.client_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.dismiss_mktplace_ads_block_on_strategy();

-- Also dismiss on INSERT into client_onboarding if already at milestone >= 2
-- (covers upsert path in advance_client_onboarding_stage)
CREATE OR REPLACE FUNCTION public.dismiss_mktplace_ads_block_on_onboarding_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.current_milestone >= 2 THEN
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_by = NULL
     WHERE client_id = NEW.client_id
       AND name      = 'Aguardando Estratégia de Tráfego'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_dismiss_mktplace_ads_block_on_onboarding_insert ON public.client_onboarding;
CREATE TRIGGER trg_dismiss_mktplace_ads_block_on_onboarding_insert
  AFTER INSERT ON public.client_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.dismiss_mktplace_ads_block_on_onboarding_insert();

-- ── 5. Backfill ─────────────────────────────────────────────────────────────
-- Insert tag for existing clients with mktplace_status = 'novo' that have NOT
-- reached milestone >= 2 in ADS onboarding.
INSERT INTO public.client_tags (client_id, name, source)
SELECT c.id, 'Aguardando Estratégia de Tráfego', 'mktplace_novo:aguardando_ads_estrategia'
FROM public.clients c
LEFT JOIN public.client_onboarding co ON co.client_id = c.id
WHERE c.archived = false
  AND c.assigned_mktplace IS NOT NULL
  AND c.mktplace_status = 'novo'
  AND (co.current_milestone IS NULL OR co.current_milestone < 2)
ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
