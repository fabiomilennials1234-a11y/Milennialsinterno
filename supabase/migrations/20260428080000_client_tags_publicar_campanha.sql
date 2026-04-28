-- Sistema de etiquetas (tags) por cliente, distinto de client_label (enum
-- de classificação CS). Tags são strings livres geradas por automações de
-- fluxo (ex: "Esperar Torque ser finalizado" quando cliente entra no step
-- 'esperando_criativos' do onboarding ADS - aka "Publicar campanha").
--
-- Escopo deste commit (mínimo viável):
--  - tabela client_tags com UNIQUE(client_id, name) WHERE dismissed_at IS NULL
--    (idempotente — não duplica enquanto ativa)
--  - trigger em client_onboarding que cria a tag ao entrar em esperando_criativos
--  - RLS simples: SELECT autorizado a qualquer authenticated; INSERT/UPDATE/DELETE
--    apenas via SECURITY DEFINER (trigger) ou is_ceo
--
-- Comportamento adicional (visibilidade UI, dismiss manual, expiração) fica
-- pra commit subsequente quando fundador especificar.

CREATE TABLE IF NOT EXISTS public.client_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name          text NOT NULL,
  source        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  dismissed_at  timestamptz,
  dismissed_by  uuid REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_tags_unique_active
  ON public.client_tags (client_id, name)
  WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS client_tags_client_idx
  ON public.client_tags (client_id)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_tags_select ON public.client_tags;
CREATE POLICY client_tags_select ON public.client_tags
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS client_tags_ceo_all ON public.client_tags;
CREATE POLICY client_tags_ceo_all ON public.client_tags
  FOR ALL TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

-- Trigger: cria tag "Esperar Torque ser finalizado" ao avançar pra esperando_criativos
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
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_create_client_tag_publicar_campanha ON public.client_onboarding;
CREATE TRIGGER trg_create_client_tag_publicar_campanha
  AFTER UPDATE OF current_step ON public.client_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.create_client_tag_on_publicar_campanha();

-- Backfill: clientes que já estão em esperando_criativos
INSERT INTO public.client_tags (client_id, name, source)
SELECT co.client_id, 'Esperar Torque ser finalizado', 'onboarding_step:esperando_criativos'
FROM public.client_onboarding co
WHERE co.current_step = 'esperando_criativos'
ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;
