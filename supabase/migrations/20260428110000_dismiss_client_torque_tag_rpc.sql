-- RPC: marca dismiss da tag "Esperar Torque ser finalizado" de um cliente.
-- Usado pelo botão "CRM FINALIZADO" no kanban Paddock do treinador comercial
-- (coluna "CRM solicitado") quando o treinador confirma que o CRM acabou.
-- Cancela cobrança de justificativa do cronômetro de 10d em cascata.

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

  UPDATE public.client_tags
     SET dismissed_at = now(),
         dismissed_by = v_uid,
         dismissed_reason = 'crm_finalizado_by_consultor_comercial'
   WHERE client_id    = p_client_id
     AND name         = 'Esperar Torque ser finalizado'
     AND dismissed_at IS NULL;
END;
$func$;

REVOKE ALL ON FUNCTION public.dismiss_client_torque_tag(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_client_torque_tag(uuid) TO authenticated;

-- Garantir coluna dismissed_reason existe (defensivo — schema original
-- cria, mas vale pra ambientes inconsistentes)
ALTER TABLE public.client_tags
  ADD COLUMN IF NOT EXISTS dismissed_reason text;
