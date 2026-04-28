-- Persistência do "CRM finalizado" pelo treinador comercial.
-- Sem essa flag, o botão "CRM FINALIZADO" no kanban Paddock voltava a aparecer
-- após click (RPC dismissava só a tag Torque, mas não havia estado persistente
-- visível ao card do treinador comercial — que pode nem ter tag Torque ainda
-- caso o cliente não tenha chegado em esperando_criativos).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS crm_finalizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_finalizado_by uuid REFERENCES auth.users(id);

-- Recria RPC para também marcar a flag no cliente, além de dismissar a tag.
CREATE OR REPLACE FUNCTION public.dismiss_client_torque_tag(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  UPDATE public.clients
     SET crm_finalizado_at = COALESCE(crm_finalizado_at, now()),
         crm_finalizado_by = COALESCE(crm_finalizado_by, v_uid)
   WHERE id = p_client_id;

  UPDATE public.client_tags
     SET dismissed_at      = now(),
         dismissed_by      = v_uid,
         dismissed_reason  = 'crm_finalizado_by_consultor_comercial'
   WHERE client_id    = p_client_id
     AND name         = 'Esperar Torque ser finalizado'
     AND dismissed_at IS NULL;
END;
$func$;

REVOKE ALL ON FUNCTION public.dismiss_client_torque_tag(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_client_torque_tag(uuid) TO authenticated;
