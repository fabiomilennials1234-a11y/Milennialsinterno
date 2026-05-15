-- 20260515300000_remove_old_tags.sql
--
-- WHY: Tag system refactored for Cat 2. Old tag names
-- ("Esperar Torque ser finalizado", "Esperar ser finalizado o Onboarding do Growth")
-- replaced by new names ("Esperar TORQUE", "TORQUE BLOQUEADO").
--
-- This migration:
--   1. Drops old triggers and functions tied to old tag names
--   2. Unschedules old cron job for expired tag detection
--   3. Dismisses all active tags with old names
--   4. Updates dismiss_client_torque_tag RPC for new tag name "Esperar TORQUE"
--   5. Updates set_client_tag_deadline for new tag name "Esperar TORQUE"
--   6. Updates check_expired_client_tags for new tag name "Esperar TORQUE"

BEGIN;

-- =============================================================================
-- 1. DROP OLD TRIGGERS
-- =============================================================================

-- Trigger on client_onboarding that created "Esperar Torque ser finalizado"
DROP TRIGGER IF EXISTS trg_create_client_tag_publicar_campanha ON public.client_onboarding;

-- Trigger on client_onboarding that dismissed "Esperar ser finalizado o Onboarding do Growth"
DROP TRIGGER IF EXISTS trg_dismiss_growth_tag_on_complete ON public.client_onboarding;

-- Triggers on clients that created "Esperar ser finalizado o Onboarding do Growth"
DROP TRIGGER IF EXISTS trg_growth_tag_on_client_insert ON public.clients;
DROP TRIGGER IF EXISTS trg_growth_tag_on_status_back_to_novo ON public.clients;

-- =============================================================================
-- 2. DROP OLD FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_client_tag_on_publicar_campanha() CASCADE;
DROP FUNCTION IF EXISTS public.dismiss_growth_onboarding_tag_on_complete() CASCADE;
DROP FUNCTION IF EXISTS public.maybe_create_growth_onboarding_tag(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.trg_growth_tag_on_client_insert() CASCADE;
DROP FUNCTION IF EXISTS public.trg_growth_tag_on_status_back_to_novo() CASCADE;

-- =============================================================================
-- 3. UNSCHEDULE OLD CRON
-- =============================================================================

SELECT cron.unschedule('check-expired-client-tags-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-expired-client-tags-hourly');

-- =============================================================================
-- 4. DISMISS ALL ACTIVE OLD TAGS
-- =============================================================================

UPDATE public.client_tags
   SET dismissed_at = now(),
       dismissed_reason = 'tag_system_refactored_cat2'
 WHERE name IN (
   'Esperar Torque ser finalizado',
   'Esperar ser finalizado o Onboarding do Growth'
 )
   AND dismissed_at IS NULL;

-- =============================================================================
-- 5. UPDATE dismiss_client_torque_tag RPC — now dismisses "Esperar TORQUE"
-- =============================================================================

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
     AND name         = 'Esperar TORQUE'
     AND dismissed_at IS NULL;
END;
$func$;

REVOKE ALL ON FUNCTION public.dismiss_client_torque_tag(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_client_torque_tag(uuid) TO authenticated;

-- =============================================================================
-- 6. UPDATE set_client_tag_deadline — now targets "Esperar TORQUE"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_client_tag_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.expires_at IS NULL AND NEW.name = 'Esperar TORQUE' THEN
    NEW.expires_at := NEW.created_at + interval '10 days';
  END IF;
  RETURN NEW;
END;
$func$;

-- Trigger already exists (trg_set_client_tag_deadline on client_tags BEFORE INSERT)

-- =============================================================================
-- 7. UPDATE check_expired_client_tags — now targets "Esperar TORQUE"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_expired_client_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_tag    record;
  v_role   record;
  v_uid    uuid;
  v_uname  text;
BEGIN
  FOR v_tag IN
    SELECT t.id, t.client_id, t.name, t.expires_at, c.name AS client_name,
           c.assigned_ads_manager, c.assigned_sucesso_cliente
      FROM public.client_tags t
      JOIN public.clients     c ON c.id = t.client_id
     WHERE t.dismissed_at IS NULL
       AND t.expired_at   IS NULL
       AND t.expires_at  <= now()
       AND t.name = 'Esperar TORQUE'
  LOOP
    UPDATE public.client_tags
       SET expired_at = now()
     WHERE id = v_tag.id;

    FOR v_role IN
      SELECT 'gestor_ads'::text AS role_name, v_tag.assigned_ads_manager AS user_id
      UNION ALL
      SELECT 'sucesso_cliente'::text, v_tag.assigned_sucesso_cliente
    LOOP
      v_uid := v_role.user_id;
      IF v_uid IS NULL THEN
        CONTINUE;
      END IF;

      SELECT name INTO v_uname FROM public.profiles WHERE user_id = v_uid;

      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      )
      VALUES (
        v_tag.id,
        'client_tag_delay__' || v_role.role_name,
        v_uid,
        COALESCE(v_uname, 'Usuario'),
        v_role.role_name,
        'Esperar TORQUE: ' || COALESCE(v_tag.client_name, 'Cliente'),
        v_tag.expires_at
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$func$;

REVOKE ALL ON FUNCTION public.check_expired_client_tags() FROM PUBLIC;

COMMENT ON FUNCTION public.check_expired_client_tags() IS
  'Cron RPC: detecta client_tags com cronômetro vencido (Esperar TORQUE, prazo 10 dias) e cobra justificativa de gestor_ads + sucesso_cliente via task_delay_notifications.';

-- Re-schedule cron with same name
SELECT cron.schedule(
  'check-expired-client-tags-hourly',
  '5 * * * *',
  $$SELECT public.check_expired_client_tags();$$
);

COMMIT;
