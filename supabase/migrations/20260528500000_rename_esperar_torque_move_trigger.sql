-- 20260528500000_rename_esperar_torque_move_trigger.sql
--
-- THREE changes:
--   1. Rename tag "Esperar TORQUE" -> "Torque em producao" everywhere
--   2. Move tag+task trigger from esperando_criativos (Publicar campanha)
--      to realizar_apresentacao_estrategia (Apresentar estrategia)
--   3. Move "Brifar CRM" GP auto-tasks to same earlier step
--
-- Affected objects:
--   - client_tags rows (rename active tags)
--   - trg_esperar_torque_on_publicar_campanha -> trg_torque_producao_on_apresentar_estrategia
--   - growth_on_ads_publicar_campanha RPC (tag name + source)
--   - dismiss_client_torque_tag RPC
--   - trg_dismiss_esperar_torque_on_crm_finalizado
--   - trg_dismiss_esperar_torque_on_paddock_crm
--   - growth_on_crm_finalizado RPC
--   - set_client_tag_deadline trigger function
--   - check_expired_client_tags RPC

BEGIN;

-- =============================================================================
-- 1. RENAME ACTIVE TAGS IN DB
-- =============================================================================

-- Simple "Esperar TORQUE" tags (from cross-kanban trigger)
UPDATE public.client_tags
   SET name = 'Torque em producao'
 WHERE name = 'Esperar TORQUE'
   AND dismissed_at IS NULL;

-- Pattern tags "Esperar TORQUE {name} ser finalizado" (from growth_on_ads_publicar_campanha RPC)
UPDATE public.client_tags
   SET name = REPLACE(name, 'Esperar TORQUE', 'Torque em producao')
 WHERE name LIKE 'Esperar TORQUE%'
   AND dismissed_at IS NULL;

-- Also update source for tags that used old source
UPDATE public.client_tags
   SET source = 'onboarding:apresentar_estrategia'
 WHERE source = 'onboarding:publicar_campanha'
   AND dismissed_at IS NULL;

UPDATE public.client_tags
   SET source = 'growth_ads_apresentar_estrategia'
 WHERE source = 'growth_ads_publicar'
   AND dismissed_at IS NULL;

-- =============================================================================
-- 2. REPLACE TRIGGER: now fires on realizar_apresentacao_estrategia
-- =============================================================================

-- Drop old trigger + function
DROP TRIGGER IF EXISTS trg_esperar_torque_on_publicar_campanha ON public.client_onboarding;
DROP FUNCTION IF EXISTS public.trg_esperar_torque_on_publicar_campanha() CASCADE;

-- New function: fires when client reaches "Apresentar estrategia" step
CREATE OR REPLACE FUNCTION public.trg_torque_producao_on_apresentar_estrategia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_client      record;
  v_pm_user_id  uuid;
BEGIN
  IF NEW.current_step = 'realizar_apresentacao_estrategia'
     AND (OLD.current_step IS DISTINCT FROM NEW.current_step) THEN

    -- Fetch client info for task title
    SELECT c.id, c.name, c.group_id
      INTO v_client
      FROM public.clients c
     WHERE c.id = NEW.client_id;

    -- 1a. Dismiss "TORQUE BLOQUEADO"
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_reason = 'apresentar_estrategia_reached'
     WHERE client_id = NEW.client_id
       AND name = 'TORQUE BLOQUEADO'
       AND dismissed_at IS NULL;

    -- 1b. Insert "Torque em producao" (10-day countdown via existing BEFORE INSERT trigger)
    INSERT INTO public.client_tags (client_id, name, source)
    VALUES (NEW.client_id, 'Torque em producao', 'onboarding:apresentar_estrategia')
    ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

    -- 1c. Create PM task "Brifar CRM [client name]" for gestor_projetos in client's group
    IF v_client.group_id IS NOT NULL THEN
      FOR v_pm_user_id IN
        SELECT p.user_id
          FROM public.profiles p
          JOIN public.user_roles ur ON ur.user_id = p.user_id
         WHERE p.group_id = v_client.group_id
           AND ur.role = 'gestor_projetos'
      LOOP
        INSERT INTO public.department_tasks (
          user_id, title, description, task_type, status, priority,
          department, related_client_id, due_date
        ) VALUES (
          v_pm_user_id,
          'Brifar CRM ' || COALESCE(v_client.name, 'Cliente'),
          'growth:brifar_crm',
          'daily', 'todo', 'high',
          'gestor_projetos', NEW.client_id,
          CASE EXTRACT(DOW FROM now())
            WHEN 5 THEN now() + interval '3 days'  -- Friday -> Monday
            WHEN 6 THEN now() + interval '2 days'  -- Saturday -> Monday
            ELSE now() + interval '1 day'
          END
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_torque_producao_on_apresentar_estrategia
  AFTER UPDATE OF current_step ON public.client_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_torque_producao_on_apresentar_estrategia();

-- =============================================================================
-- 3. UPDATE growth_on_ads_publicar_campanha RPC (keep name, change logic)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_on_ads_publicar_campanha(
  p_client_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_client_name text;
  v_gp_ids      uuid[];
  v_group_id    uuid;
  v_next_biz    date;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin, gestor_projetos, or gestor_ads
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
    OR public.has_role(v_caller, 'gestor_ads'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Fetch client
  SELECT name, group_id INTO v_client_name, v_group_id
    FROM public.clients
   WHERE id = p_client_id;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Dismiss TORQUE BLOQUEADO tag
  UPDATE public.client_tags
     SET dismissed_at = now(),
         dismissed_by = v_caller,
         dismissed_reason = 'ads_apresentar_estrategia'
   WHERE client_id = p_client_id
     AND name = 'TORQUE BLOQUEADO'
     AND dismissed_at IS NULL;

  -- 2. Set torque unblocked timestamp
  UPDATE public.clients
     SET growth_torque_unblocked_at = now(),
         updated_at = now()
   WHERE id = p_client_id;

  -- 3. Create "Torque em producao" tag
  INSERT INTO public.client_tags (client_id, name, source)
  VALUES (
    p_client_id,
    format('Torque em producao %s', v_client_name),
    'growth_ads_apresentar_estrategia'
  )
  ON CONFLICT (client_id, name) WHERE dismissed_at IS NULL DO NOTHING;

  -- Calculate next business day (skip Saturday=6, Sunday=0)
  v_next_biz := (CURRENT_DATE + interval '1 day')::date;
  WHILE extract(dow FROM v_next_biz) IN (0, 6) LOOP
    v_next_biz := v_next_biz + 1;
  END LOOP;

  -- Resolve GP user_ids
  SELECT array_agg(p.user_id)
    INTO v_gp_ids
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
   WHERE ur.role = 'gestor_projetos'
     AND (v_group_id IS NULL OR p.group_id = v_group_id);

  -- 4. Auto-task GP: Brifar CRM
  IF v_gp_ids IS NOT NULL THEN
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      unnest(v_gp_ids),
      'Brifar CRM ' || v_client_name,
      'growth:brifar_crm',
      'daily', 'todo', 'high',
      'gestor_projetos', p_client_id,
      v_next_biz;

    -- 5. Auto-task GP: Brifar CRM + Alinhar prazo
    INSERT INTO public.department_tasks (
      user_id, title, description, task_type, status, priority,
      department, related_client_id, due_date
    )
    SELECT
      unnest(v_gp_ids),
      'Brifar CRM + Alinhar com o cliente o prazo ' || v_client_name,
      'growth:brifar_crm_alinhar',
      'daily', 'todo', 'high',
      'gestor_projetos', p_client_id,
      v_next_biz;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.growth_on_ads_publicar_campanha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_on_ads_publicar_campanha(uuid) TO authenticated;

-- =============================================================================
-- 4. UPDATE dismiss_client_torque_tag RPC
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
     AND name         = 'Torque em producao'
     AND dismissed_at IS NULL;
END;
$func$;

REVOKE ALL ON FUNCTION public.dismiss_client_torque_tag(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_client_torque_tag(uuid) TO authenticated;

-- =============================================================================
-- 5. UPDATE trg_dismiss_esperar_torque_on_crm_finalizado
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_dismiss_esperar_torque_on_crm_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF (OLD.is_finalizado IS DISTINCT FROM true) AND NEW.is_finalizado = true THEN
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_reason = 'crm_finalizado'
     WHERE client_id = NEW.client_id
       AND name = 'Torque em producao'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

-- Trigger already exists on crm_configuracoes — function replacement is enough

-- =============================================================================
-- 6. UPDATE trg_dismiss_esperar_torque_on_paddock_crm
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_dismiss_esperar_torque_on_paddock_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF OLD.crm_finalizado_at IS NULL AND NEW.crm_finalizado_at IS NOT NULL THEN
    UPDATE public.client_tags
       SET dismissed_at = now(),
           dismissed_reason = 'crm_finalizado_paddock'
     WHERE client_id = NEW.id
       AND name = 'Torque em producao'
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$func$;

-- Trigger already exists on clients — function replacement is enough

-- =============================================================================
-- 7. UPDATE growth_on_crm_finalizado RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.growth_on_crm_finalizado(
  p_client_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count  int;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Permission: admin, gestor_projetos, gestor_crm, or consultor_comercial
  IF NOT (
    public.is_admin(v_caller)
    OR public.has_role(v_caller, 'gestor_projetos'::user_role)
    OR public.has_role(v_caller, 'gestor_crm'::user_role)
    OR public.has_role(v_caller, 'consultor_comercial'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Dismiss all "Torque em producao%" tags
  UPDATE public.client_tags
     SET dismissed_at = now(),
         dismissed_by = v_caller,
         dismissed_reason = 'crm_finalizado'
   WHERE client_id = p_client_id
     AND name LIKE 'Torque em producao%'
     AND source = 'growth_ads_apresentar_estrategia'
     AND dismissed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'tags_dismissed', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.growth_on_crm_finalizado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_on_crm_finalizado(uuid) TO authenticated;

-- =============================================================================
-- 8. UPDATE set_client_tag_deadline trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_client_tag_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.expires_at IS NULL AND NEW.name = 'Torque em producao' THEN
    NEW.expires_at := NEW.created_at + interval '10 days';
  END IF;
  RETURN NEW;
END;
$func$;

-- Trigger already exists (trg_set_client_tag_deadline on client_tags BEFORE INSERT)

-- =============================================================================
-- 9. UPDATE check_expired_client_tags RPC
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
       AND t.name = 'Torque em producao'
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
        'Torque em producao: ' || COALESCE(v_tag.client_name, 'Cliente'),
        v_tag.expires_at
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$func$;

REVOKE ALL ON FUNCTION public.check_expired_client_tags() FROM PUBLIC;

COMMENT ON FUNCTION public.check_expired_client_tags() IS
  'Cron RPC: detecta client_tags com cronometro vencido (Torque em producao, prazo 10 dias) e cobra justificativa de gestor_ads + sucesso_cliente via task_delay_notifications.';

-- Cron already scheduled — function replacement is enough

COMMIT;
