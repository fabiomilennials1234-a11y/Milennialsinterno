-- Cronômetro de 10 dias para tag "Esperar Torque ser finalizado".
--
-- Regras:
--   - Quando a tag é criada (cliente entra em esperando_criativos), inicia
--     contagem regressiva de 10 dias (expires_at = created_at + 10 days).
--   - Quando expira (expires_at <= now() e ainda ativa), gera obrigação de
--     justificativa para o gestor de Ads (assigned_ads_manager) e para o
--     responsável de Sucesso do Cliente (assigned_sucesso_cliente).
--   - Reusa o sistema task_delay_notifications + task_delay_justifications
--     (modal bloqueante e coluna de justificativa já existem no front).
--   - "Como o cronômetro deve sumir" será especificado depois — por enquanto,
--     o cronômetro continua contando até a tag ser dismissed manualmente OU
--     via auto-dismiss em cascata (não há cascata para Torque hoje).
--
-- Schema:
--   - ALTER TABLE client_tags adicionar expires_at, expired_at
--   - Função set_client_tag_torque_deadline (BEFORE INSERT) preenche expires_at
--   - RPC check_expired_client_tags (cron horário): marca expired_at e cria
--     task_delay_notifications para os 2 papéis responsáveis
--   - RPC get_pending_client_tag_justifications_for_user (drives modal frontend)
--   - Cron job hourly

-- ── 1. Schema ─────────────────────────────────────────────────────────────
ALTER TABLE public.client_tags
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at  timestamptz;

CREATE INDEX IF NOT EXISTS client_tags_expires_at_idx
  ON public.client_tags (expires_at)
  WHERE dismissed_at IS NULL AND expires_at IS NOT NULL AND expired_at IS NULL;

-- ── 2. BEFORE INSERT: preenche expires_at quando aplicável ────────────────
CREATE OR REPLACE FUNCTION public.set_client_tag_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.expires_at IS NULL AND NEW.name = 'Esperar Torque ser finalizado' THEN
    NEW.expires_at := NEW.created_at + interval '10 days';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_client_tag_deadline ON public.client_tags;
CREATE TRIGGER trg_set_client_tag_deadline
  BEFORE INSERT ON public.client_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_tag_deadline();

-- Backfill: preenche expires_at retroativo das tags Torque já existentes
UPDATE public.client_tags
   SET expires_at = created_at + interval '10 days'
 WHERE name = 'Esperar Torque ser finalizado'
   AND expires_at IS NULL;

-- ── 3. RPC: detecta tags expiradas e cobra justificativa dos 2 papéis ─────
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
  v_notif  uuid;
BEGIN
  FOR v_tag IN
    SELECT t.id, t.client_id, t.name, t.expires_at, c.name AS client_name,
           c.assigned_ads_manager, c.assigned_sucesso_cliente
      FROM public.client_tags t
      JOIN public.clients     c ON c.id = t.client_id
     WHERE t.dismissed_at IS NULL
       AND t.expired_at   IS NULL
       AND t.expires_at  <= now()
       AND t.name = 'Esperar Torque ser finalizado'
  LOOP
    UPDATE public.client_tags
       SET expired_at = now()
     WHERE id = v_tag.id;

    -- Para cada papel envolvido (gestor de ads + sucesso_cliente do cliente)
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
        'Esperar Torque ser finalizado: ' || COALESCE(v_tag.client_name, 'Cliente'),
        v_tag.expires_at
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$func$;

REVOKE ALL ON FUNCTION public.check_expired_client_tags() FROM PUBLIC;

COMMENT ON FUNCTION public.check_expired_client_tags() IS
  'Cron RPC: detecta client_tags com cronômetro vencido (Esperar Torque ser finalizado, prazo 10 dias) e cobra justificativa de gestor_ads + sucesso_cliente via task_delay_notifications.';

-- ── 4. RPC frontend: pendings do user logado para modal automático ────────
DROP FUNCTION IF EXISTS public.get_pending_client_tag_justifications_for_user();
CREATE OR REPLACE FUNCTION public.get_pending_client_tag_justifications_for_user()
RETURNS TABLE (
  notification_id  uuid,
  tag_id           uuid,
  client_id        uuid,
  client_name      text,
  tag_name         text,
  user_role        text,
  task_table       text,
  task_title       text,
  expires_at       timestamptz,
  detected_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT
      n.id            AS notification_id,
      t.id            AS tag_id,
      t.client_id,
      c.name          AS client_name,
      t.name          AS tag_name,
      n.task_owner_role AS user_role,
      n.task_table,
      n.task_title,
      t.expires_at,
      n.created_at    AS detected_at
    FROM public.task_delay_notifications n
    JOIN public.client_tags              t ON t.id = n.task_id
    JOIN public.clients                  c ON c.id = t.client_id
    LEFT JOIN public.task_delay_justifications j
           ON j.notification_id = n.id AND j.user_id = v_uid
   WHERE n.task_table LIKE 'client_tag_delay__%'
     AND n.task_owner_id = v_uid
     AND j.id IS NULL
     AND t.dismissed_at IS NULL
   ORDER BY n.created_at;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_pending_client_tag_justifications_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_client_tag_justifications_for_user() TO authenticated;

-- ── 5. Cron horário ───────────────────────────────────────────────────────
SELECT cron.unschedule('check-expired-client-tags-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-expired-client-tags-hourly');

SELECT cron.schedule(
  'check-expired-client-tags-hourly',
  '5 * * * *',  -- :05 de cada hora (offset do CRM check no :00)
  $$SELECT public.check_expired_client_tags();$$
);

-- ── 6. Roda imediatamente para sincronizar com backfill ───────────────────
SELECT public.check_expired_client_tags();
