-- 20260603130200_client_members_mirror_triggers.sql
-- Slice 2 (#78) — trigger ESPELHO de transição (ADR 0005, seção 4).
--
-- Enquanto ~141 caminhos legados escrevem assigned_* / client_secondary_managers
-- direto, estes triggers refletem a mudança em cliente.client_members para a
-- fonte única não divergir. REDE DE TRANSIÇÃO — removida junto com os assigned_*
-- na slice final de deprecação. NÃO é o caminho preferido (esse é a RPC de
-- membership); é o que segura o legado sem regredir a leitura nova no dia 1.
--
-- SECURITY DEFINER: o trigger escreve em cliente.client_members, cuja escrita é
-- revogada de authenticated — roda como owner para furar o próprio REVOKE de
-- forma controlada (o trigger É um caminho do módulo, não escrita externa).

-- =============================================================================
-- 1) Espelho de public.clients (7 assigned_*). Para cada papel: se mudou de A
--    para B, remove a linha de A e insere a de B; se virou NULL, remove.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente._mirror_clients_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- (papel, novo_uuid, velho_uuid) por coluna assigned_*
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('ads_manager',      NEW.assigned_ads_manager,      CASE WHEN TG_OP='UPDATE' THEN OLD.assigned_ads_manager      ELSE NULL END),
      ('comercial',        NEW.assigned_comercial,        CASE WHEN TG_OP='UPDATE' THEN OLD.assigned_comercial        ELSE NULL END),
      ('crm',              NEW.assigned_crm,              CASE WHEN TG_OP='UPDATE' THEN OLD.assigned_crm              ELSE NULL END),
      ('rh',               NEW.assigned_rh,               CASE WHEN TG_OP='UPDATE' THEN OLD.assigned_rh               ELSE NULL END),
      ('outbound_manager', NEW.assigned_outbound_manager, CASE WHEN TG_OP='UPDATE' THEN OLD.assigned_outbound_manager ELSE NULL END),
      ('sucesso_cliente',  NEW.assigned_sucesso_cliente,  CASE WHEN TG_OP='UPDATE' THEN OLD.assigned_sucesso_cliente  ELSE NULL END)
    ) AS t(papel, novo, velho)
  LOOP
    -- removeu/trocou: apaga a linha do uuid antigo desse papel
    IF TG_OP='UPDATE' AND r.velho IS NOT NULL AND r.velho IS DISTINCT FROM r.novo THEN
      DELETE FROM cliente.client_members
       WHERE client_id = NEW.id AND user_id = r.velho AND papel_no_cliente = r.papel;
    END IF;
    -- atribuiu: insere a linha do uuid novo (idempotente)
    IF r.novo IS NOT NULL THEN
      INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
      VALUES (NEW.id, r.novo, r.papel)
      ON CONFLICT (client_id, user_id, papel_no_cliente) DO NOTHING;
    END IF;
  END LOOP;

  -- mktplace: TEXT -> UUID (só se válido). Mesma lógica de troca.
  IF TG_OP='UPDATE'
     AND OLD.assigned_mktplace IS NOT NULL AND OLD.assigned_mktplace <> ''
     AND OLD.assigned_mktplace IS DISTINCT FROM NEW.assigned_mktplace
     AND OLD.assigned_mktplace ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    DELETE FROM cliente.client_members
     WHERE client_id = NEW.id AND user_id = OLD.assigned_mktplace::uuid AND papel_no_cliente = 'mktplace';
  END IF;
  IF NEW.assigned_mktplace IS NOT NULL AND NEW.assigned_mktplace <> ''
     AND NEW.assigned_mktplace ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
    VALUES (NEW.id, NEW.assigned_mktplace::uuid, 'mktplace')
    ON CONFLICT (client_id, user_id, papel_no_cliente) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_clients_assigned ON public.clients;
CREATE TRIGGER trg_mirror_clients_assigned
  AFTER INSERT OR UPDATE OF
    assigned_ads_manager, assigned_comercial, assigned_crm, assigned_rh,
    assigned_outbound_manager, assigned_sucesso_cliente, assigned_mktplace
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION cliente._mirror_clients_assigned();

-- =============================================================================
-- 2) Espelho de public.client_secondary_managers (papel 'secondary_manager').
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente._mirror_secondary_managers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.secondary_manager_id IS NOT NULL THEN
    DELETE FROM cliente.client_members
     WHERE client_id = OLD.client_id
       AND user_id = OLD.secondary_manager_id
       AND papel_no_cliente = 'secondary_manager';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.secondary_manager_id IS NOT NULL THEN
    INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
    VALUES (NEW.client_id, NEW.secondary_manager_id, 'secondary_manager')
    ON CONFLICT (client_id, user_id, papel_no_cliente) DO NOTHING;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_secondary_managers ON public.client_secondary_managers;
CREATE TRIGGER trg_mirror_secondary_managers
  AFTER INSERT OR UPDATE OR DELETE ON public.client_secondary_managers
  FOR EACH ROW EXECUTE FUNCTION cliente._mirror_secondary_managers();
