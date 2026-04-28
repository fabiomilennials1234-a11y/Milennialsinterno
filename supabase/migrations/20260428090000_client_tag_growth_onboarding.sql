-- Tag "Esperar ser finalizado o Onboarding do Growth"
--
-- Regras:
--   - Criada quando cliente NOVO entra no fluxo comercial COM produto
--     'millennials-growth' contratado.
--   - NÃO se aplica se contratou apenas 'millennials-paddock' (ou qualquer
--     outro produto sem millennials-growth).
--   - Auto-dismiss quando o cliente recebe a tag "Esperar Torque ser finalizado"
--     (ou seja, quando avança pro step esperando_criativos do onboarding ADS).
--
-- Implementação:
--   1. Trigger AFTER INSERT em clients: se contracted_products inclui
--      'millennials-growth' e comercial_status = 'novo' → cria a tag.
--   2. Trigger AFTER UPDATE OF comercial_status em clients: se comercial_status
--      passou para 'novo' (transição), e produto millennials-growth presente,
--      cria a tag (cobre re-entrada).
--   3. Estende create_client_tag_on_publicar_campanha pra também marcar como
--      dismissed a tag "Esperar ser finalizado o Onboarding do Growth" do mesmo
--      cliente (auto-dismiss em cascata).

-- ── 1. Função compartilhada de criação da tag growth ─────────────────────
CREATE OR REPLACE FUNCTION public.maybe_create_growth_onboarding_tag(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_has_growth boolean;
  v_status     text;
BEGIN
  SELECT
    'millennials-growth' = ANY(contracted_products),
    comercial_status
  INTO v_has_growth, v_status
  FROM public.clients
  WHERE id = p_client_id;

  IF v_has_growth IS TRUE AND v_status = 'novo' THEN
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (p_client_id, 'Esperar ser finalizado o Onboarding do Growth', 'comercial_novo:millennials-growth')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
  END IF;
END;
$func$;

-- ── 2. Trigger AFTER INSERT em clients ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_growth_tag_on_client_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  PERFORM public.maybe_create_growth_onboarding_tag(NEW.id);
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_growth_tag_on_client_insert ON public.clients;
CREATE TRIGGER trg_growth_tag_on_client_insert
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_growth_tag_on_client_insert();

-- ── 3. Trigger AFTER UPDATE OF comercial_status (cobre re-entrada em 'novo') ─
CREATE OR REPLACE FUNCTION public.trg_growth_tag_on_status_back_to_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.comercial_status = 'novo'
     AND (OLD.comercial_status IS DISTINCT FROM NEW.comercial_status) THEN
    PERFORM public.maybe_create_growth_onboarding_tag(NEW.id);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_growth_tag_on_status_back_to_novo ON public.clients;
CREATE TRIGGER trg_growth_tag_on_status_back_to_novo
  AFTER UPDATE OF comercial_status ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_growth_tag_on_status_back_to_novo();

-- ── 4. Estende trigger de "Esperar Torque ser finalizado" pra auto-dismiss ──
CREATE OR REPLACE FUNCTION public.create_client_tag_on_publicar_campanha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.current_step = 'esperando_criativos'
     AND (OLD.current_step IS DISTINCT FROM NEW.current_step) THEN
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (NEW.client_id, 'Esperar Torque ser finalizado', 'onboarding_step:esperando_criativos')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

    -- Auto-dismiss da tag de Onboarding Growth (cliente saiu da espera comercial,
    -- agora está esperando o Torque). Mantém histórico via dismissed_at.
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_by = NULL  -- automático
     WHERE client_id = NEW.client_id
       AND name      = 'Esperar ser finalizado o Onboarding do Growth'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

-- ── 5. Backfill: clientes ativos com millennials-growth + comercial_status='novo' ──
INSERT INTO public.client_tags (client_id, name, source)
SELECT id, 'Esperar ser finalizado o Onboarding do Growth', 'comercial_novo:millennials-growth'
FROM public.clients
WHERE archived = false
  AND comercial_status = 'novo'
  AND 'millennials-growth' = ANY(contracted_products)
ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
