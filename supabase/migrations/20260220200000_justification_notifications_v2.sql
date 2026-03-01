-- =============================================
-- JUSTIFICATION & NOTIFICATION SYSTEM V2
-- 10 new RPC functions for scheduled checks
-- + trigger for cross-module justification notification
-- =============================================

-- ===============================
-- 1. check_financeiro_clients_stalled
-- J2: Clients in financeiro_active_clients >7 days without all financeiro_tasks completed
-- ===============================
CREATE OR REPLACE FUNCTION public.check_financeiro_clients_stalled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_user RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      fac.client_id,
      c.name AS client_name,
      COUNT(ft.id) FILTER (WHERE ft.status != 'done') AS pending_count,
      fac.created_at AS active_since
    FROM public.financeiro_active_clients fac
    JOIN public.clients c ON c.id = fac.client_id AND c.archived = false
    JOIN public.financeiro_tasks ft ON ft.client_id = fac.client_id
    WHERE fac.created_at < NOW() - INTERVAL '7 days'
    GROUP BY fac.client_id, c.name, fac.created_at
    HAVING COUNT(ft.id) FILTER (WHERE ft.status != 'done') > 0
  LOOP
    FOR v_user IN
      SELECT ur.user_id, COALESCE(p.name, 'Financeiro') AS user_name
      FROM public.user_roles ur
      LEFT JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = 'financeiro'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.task_delay_notifications
        WHERE task_id = v_rec.client_id::text
        AND task_table = 'financeiro_client_stalled'
        AND created_at > NOW() - INTERVAL '2 days'
      ) THEN
        INSERT INTO public.task_delay_notifications (
          task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
          task_title, task_due_date
        ) VALUES (
          v_rec.client_id::text,
          'financeiro_client_stalled',
          v_user.user_id,
          v_user.user_name,
          'financeiro',
          'Cliente ativo >7d sem tarefas concluídas: ' || v_rec.client_name || ' (' || v_rec.pending_count || ' pendentes)',
          v_rec.active_since + INTERVAL '7 days'
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ===============================
-- 2. check_contract_no_renewal_plan
-- J3: Contract expiring ≤30 days without a renewal plan notification registered
-- ===============================
CREATE OR REPLACE FUNCTION public.check_contract_no_renewal_plan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_user RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      fco.client_id,
      c.name AS client_name,
      fco.contract_expiration_date,
      EXTRACT(DAY FROM fco.contract_expiration_date - NOW()) AS days_left
    FROM public.financeiro_client_onboarding fco
    JOIN public.clients c ON c.id = fco.client_id AND c.archived = false
    WHERE fco.contract_expiration_date IS NOT NULL
      AND fco.contract_expiration_date > NOW()
      AND fco.contract_expiration_date <= NOW() + INTERVAL '30 days'
  LOOP
    -- Create notification for financeiro + gestor_projetos
    FOR v_user IN
      SELECT ur.user_id, COALESCE(p.name, 'Usuário') AS user_name, ur.role
      FROM public.user_roles ur
      LEFT JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role IN ('financeiro', 'gestor_projetos')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.task_delay_notifications
        WHERE task_id = v_rec.client_id::text
        AND task_table = 'contract_no_renewal_plan'
        AND task_owner_id = v_user.user_id
        AND created_at > NOW() - INTERVAL '3 days'
      ) THEN
        INSERT INTO public.task_delay_notifications (
          task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
          task_title, task_due_date
        ) VALUES (
          v_rec.client_id::text,
          'contract_no_renewal_plan',
          v_user.user_id,
          v_user.user_name,
          v_user.role,
          'Contrato expirando sem plano de renovação: ' || v_rec.client_name || ' (' || FLOOR(v_rec.days_left) || 'd)',
          v_rec.contract_expiration_date
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ===============================
-- 3. check_comercial_consultoria_stalled
-- J5: Consultoria marcada >3 business days without realization
-- N6: Bell notification for gestor_projetos + CEO
-- ===============================
CREATE OR REPLACE FUNCTION public.check_comercial_consultoria_stalled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_user RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      c.comercial_onboarding_started_at,
      ct.user_id AS comercial_user_id,
      COALESCE(p.name, 'Comercial') AS comercial_user_name
    FROM public.clients c
    JOIN public.comercial_tasks ct ON ct.related_client_id = c.id
      AND ct.auto_task_type = 'realizar_consultoria'
      AND ct.status != 'done'
      AND (ct.archived IS NULL OR ct.archived = false)
    LEFT JOIN public.profiles p ON p.user_id = ct.user_id
    WHERE c.comercial_status = 'consultoria_marcada'
      AND c.archived = false
      AND c.comercial_onboarding_started_at IS NOT NULL
      AND c.comercial_onboarding_started_at < NOW() - INTERVAL '3 days'
  LOOP
    -- J5: Justification for comercial user
    IF NOT EXISTS (
      SELECT 1 FROM public.task_delay_notifications
      WHERE task_id = v_rec.client_id::text
      AND task_table = 'comercial_consultoria_stalled'
      AND created_at > NOW() - INTERVAL '2 days'
    ) THEN
      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      ) VALUES (
        v_rec.client_id::text,
        'comercial_consultoria_stalled',
        v_rec.comercial_user_id,
        v_rec.comercial_user_name,
        'consultor_comercial',
        'Consultoria não realizada >3 dias: ' || v_rec.client_name,
        v_rec.comercial_onboarding_started_at + INTERVAL '3 days'
      );
    END IF;

    -- N6: Bell notification for gestor_projetos + CEO
    FOR v_user IN
      SELECT ur.user_id, ur.role
      FROM public.user_roles ur
      WHERE ur.role IN ('gestor_projetos', 'ceo')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.system_notifications
        WHERE client_id = v_rec.client_id
        AND notification_type = 'comercial_consultoria_stalled'
        AND recipient_id = v_user.user_id
        AND created_at > NOW() - INTERVAL '2 days'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type,
          title, message, client_id, priority,
          metadata
        ) VALUES (
          v_user.user_id,
          v_user.role,
          'comercial_consultoria_stalled',
          '⚠️ Consultoria Atrasada',
          'Cliente "' || v_rec.client_name || '" com consultoria marcada há mais de 3 dias sem realização. Comercial: ' || v_rec.comercial_user_name,
          v_rec.client_id,
          'high',
          jsonb_build_object('comercial_user_name', v_rec.comercial_user_name, 'days_stalled', EXTRACT(DAY FROM NOW() - v_rec.comercial_onboarding_started_at))
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ===============================
-- 4. check_comercial_acompanhamento_stalled
-- J6: Em acompanhamento >5 business days without interaction
-- ===============================
CREATE OR REPLACE FUNCTION public.check_comercial_acompanhamento_stalled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      ct.comercial_user_id,
      ct.client_id,
      c.name AS client_name,
      COALESCE(p.name, 'Comercial') AS comercial_user_name,
      ct.updated_at AS last_interaction
    FROM public.comercial_tracking ct
    JOIN public.clients c ON c.id = ct.client_id AND c.archived = false
    LEFT JOIN public.profiles p ON p.user_id = ct.comercial_user_id
    WHERE ct.updated_at < NOW() - INTERVAL '5 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.task_delay_notifications
      WHERE task_id = v_rec.client_id::text
      AND task_table = 'comercial_acompanhamento_stalled'
      AND created_at > NOW() - INTERVAL '2 days'
    ) THEN
      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      ) VALUES (
        v_rec.client_id::text,
        'comercial_acompanhamento_stalled',
        v_rec.comercial_user_id,
        v_rec.comercial_user_name,
        'consultor_comercial',
        'Acompanhamento sem interação >5 dias: ' || v_rec.client_name,
        v_rec.last_interaction + INTERVAL '5 days'
      );
    END IF;
  END LOOP;
END;
$$;

-- ===============================
-- 5. check_onboarding_tasks_stuck
-- J9: Onboarding tasks in 'pending'/'todo' for >2 business days
-- ===============================
CREATE OR REPLACE FUNCTION public.check_onboarding_tasks_stuck()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      ot.id AS task_id,
      ot.title,
      ot.assigned_to,
      COALESCE(p.name, 'Gestor') AS owner_name,
      ot.created_at
    FROM public.onboarding_tasks ot
    LEFT JOIN public.profiles p ON p.user_id = ot.assigned_to
    WHERE ot.status IN ('pending', 'todo')
      AND (ot.archived IS NULL OR ot.archived = false)
      AND ot.created_at < NOW() - INTERVAL '2 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.task_delay_notifications
      WHERE task_id = v_rec.task_id::text
      AND task_table = 'onboarding_task_stuck'
      AND created_at > NOW() - INTERVAL '2 days'
    ) THEN
      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      ) VALUES (
        v_rec.task_id::text,
        'onboarding_task_stuck',
        v_rec.assigned_to,
        v_rec.owner_name,
        'gestor_ads',
        v_rec.title || ' (parada há mais de 2 dias)',
        v_rec.created_at + INTERVAL '2 days'
      );
    END IF;
  END LOOP;
END;
$$;

-- ===============================
-- 6. check_ads_client_stalled_14d
-- J12: Client in acompanhamento >14 days without movement
-- ===============================
CREATE OR REPLACE FUNCTION public.check_ads_client_stalled_14d()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      cdt.client_id,
      c.name AS client_name,
      cdt.ads_manager_id,
      COALESCE(p.name, 'Gestor') AS manager_name,
      cdt.last_moved_at
    FROM public.client_daily_tracking cdt
    JOIN public.clients c ON c.id = cdt.client_id AND c.archived = false AND c.status = 'active'
    LEFT JOIN public.profiles p ON p.user_id = cdt.ads_manager_id
    WHERE cdt.last_moved_at < NOW() - INTERVAL '14 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.task_delay_notifications
      WHERE task_id = v_rec.client_id::text
      AND task_table = 'ads_client_stalled_14d'
      AND created_at > NOW() - INTERVAL '3 days'
    ) THEN
      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      ) VALUES (
        v_rec.client_id::text,
        'ads_client_stalled_14d',
        v_rec.ads_manager_id,
        v_rec.manager_name,
        'gestor_ads',
        'Cliente em acompanhamento >14 dias sem movimentação: ' || v_rec.client_name,
        v_rec.last_moved_at + INTERVAL '14 days'
      );
    END IF;
  END LOOP;
END;
$$;

-- ===============================
-- 7. check_department_tasks_stalled
-- J13: Department tasks in 'todo' for >3 days
-- ===============================
CREATE OR REPLACE FUNCTION public.check_department_tasks_stalled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      dt.id AS task_id,
      dt.title,
      dt.user_id,
      COALESCE(p.name, 'Usuário') AS owner_name,
      COALESCE(ur.role, dt.department) AS owner_role,
      dt.created_at
    FROM public.department_tasks dt
    LEFT JOIN public.profiles p ON p.user_id = dt.user_id
    LEFT JOIN public.user_roles ur ON ur.user_id = dt.user_id
    WHERE dt.status = 'todo'
      AND dt.archived = false
      AND dt.created_at < NOW() - INTERVAL '3 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.task_delay_notifications
      WHERE task_id = v_rec.task_id::text
      AND task_table = 'department_task_stalled'
      AND created_at > NOW() - INTERVAL '2 days'
    ) THEN
      INSERT INTO public.task_delay_notifications (
        task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
        task_title, task_due_date
      ) VALUES (
        v_rec.task_id::text,
        'department_task_stalled',
        v_rec.user_id,
        v_rec.owner_name,
        v_rec.owner_role,
        v_rec.title || ' (parada há mais de 3 dias)',
        v_rec.created_at + INTERVAL '3 days'
      );
    END IF;
  END LOOP;
END;
$$;

-- ===============================
-- 8. check_contract_expired_alert
-- N2: Bell notification when contract has expired
-- ===============================
CREATE OR REPLACE FUNCTION public.check_contract_expired_alert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_user RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      fco.client_id,
      c.name AS client_name,
      fco.contract_expiration_date
    FROM public.financeiro_client_onboarding fco
    JOIN public.clients c ON c.id = fco.client_id AND c.archived = false
    WHERE fco.contract_expiration_date IS NOT NULL
      AND fco.contract_expiration_date < NOW()
      AND fco.contract_expiration_date > NOW() - INTERVAL '90 days'
  LOOP
    FOR v_user IN
      SELECT ur.user_id, ur.role
      FROM public.user_roles ur
      WHERE ur.role IN ('ceo', 'gestor_projetos')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.system_notifications
        WHERE client_id = v_rec.client_id
        AND notification_type = 'contract_expired'
        AND recipient_id = v_user.user_id
        AND created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type,
          title, message, client_id, priority,
          metadata
        ) VALUES (
          v_user.user_id,
          v_user.role,
          'contract_expired',
          '❌ Contrato Expirado',
          'O contrato do cliente "' || v_rec.client_name || '" expirou em ' || TO_CHAR(v_rec.contract_expiration_date, 'DD/MM/YYYY') || '.',
          v_rec.client_id,
          'urgent',
          jsonb_build_object('expiration_date', v_rec.contract_expiration_date)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ===============================
-- 9. check_ads_client_no_movement_7d
-- N11: Client without movement >7 days in tracking
-- ===============================
CREATE OR REPLACE FUNCTION public.check_ads_client_no_movement_7d()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_mgr_user RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      cdt.client_id,
      c.name AS client_name,
      cdt.ads_manager_id,
      cdt.last_moved_at,
      EXTRACT(DAY FROM NOW() - cdt.last_moved_at) AS days_stalled
    FROM public.client_daily_tracking cdt
    JOIN public.clients c ON c.id = cdt.client_id AND c.archived = false AND c.status = 'active'
    WHERE cdt.last_moved_at < NOW() - INTERVAL '7 days'
  LOOP
    -- Notify ads manager
    IF NOT EXISTS (
      SELECT 1 FROM public.system_notifications
      WHERE client_id = v_rec.client_id
      AND notification_type = 'ads_client_no_movement_7d'
      AND recipient_id = v_rec.ads_manager_id
      AND created_at > NOW() - INTERVAL '3 days'
    ) THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type,
        title, message, client_id, priority,
        metadata
      ) VALUES (
        v_rec.ads_manager_id,
        'gestor_ads',
        'ads_client_no_movement_7d',
        '⚠️ Cliente Parado',
        'Cliente "' || v_rec.client_name || '" sem movimentação há ' || FLOOR(v_rec.days_stalled) || ' dias.',
        v_rec.client_id,
        'high',
        jsonb_build_object('days_stalled', v_rec.days_stalled, 'last_moved_at', v_rec.last_moved_at)
      );
    END IF;

    -- Notify gestor_projetos
    FOR v_mgr_user IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'gestor_projetos'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.system_notifications
        WHERE client_id = v_rec.client_id
        AND notification_type = 'ads_client_no_movement_7d'
        AND recipient_id = v_mgr_user.user_id
        AND created_at > NOW() - INTERVAL '3 days'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type,
          title, message, client_id, priority,
          metadata
        ) VALUES (
          v_mgr_user.user_id,
          'gestor_projetos',
          'ads_client_no_movement_7d',
          '⚠️ Cliente Parado',
          'Cliente "' || v_rec.client_name || '" sem movimentação há ' || FLOOR(v_rec.days_stalled) || ' dias.',
          v_rec.client_id,
          'high',
          jsonb_build_object('days_stalled', v_rec.days_stalled, 'last_moved_at', v_rec.last_moved_at)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ===============================
-- 10. check_user_inactive
-- N13: User not logged in >2 business days
-- ===============================
CREATE OR REPLACE FUNCTION public.check_user_inactive()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inactive RECORD;
  v_mgr RECORD;
BEGIN
  FOR v_inactive IN
    SELECT
      p.user_id,
      p.name AS user_name,
      COALESCE(ur.role, 'unknown') AS user_role,
      p.last_sign_in_at
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.last_sign_in_at IS NOT NULL
      AND p.last_sign_in_at < NOW() - INTERVAL '2 days'
      AND ur.role IS NOT NULL
      AND ur.role != 'ceo'
  LOOP
    -- Notify gestor_projetos + CEO
    FOR v_mgr IN
      SELECT ur.user_id, ur.role
      FROM public.user_roles ur
      WHERE ur.role IN ('gestor_projetos', 'ceo')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.system_notifications
        WHERE notification_type = 'user_inactive'
        AND recipient_id = v_mgr.user_id
        AND metadata->>'inactive_user_id' = v_inactive.user_id::text
        AND created_at > NOW() - INTERVAL '2 days'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type,
          title, message, priority,
          metadata
        ) VALUES (
          v_mgr.user_id,
          v_mgr.role,
          'user_inactive',
          '👤 Usuário Inativo',
          v_inactive.user_name || ' (' || v_inactive.user_role || ') não acessa o sistema há mais de 2 dias.',
          'medium',
          jsonb_build_object('inactive_user_id', v_inactive.user_id, 'user_name', v_inactive.user_name, 'user_role', v_inactive.user_role, 'last_sign_in_at', v_inactive.last_sign_in_at)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ===============================
-- TRIGGER: Notify CEO when ANY justification is saved (N12)
-- Cross-module: system_notification on task_delay_justifications INSERT
-- ===============================
CREATE OR REPLACE FUNCTION public.notify_ceo_on_justification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ceo_id UUID;
  v_notification RECORD;
  v_justifier_name TEXT;
BEGIN
  -- Get CEO user_id
  SELECT ur.user_id INTO v_ceo_id
  FROM public.user_roles ur
  WHERE ur.role = 'ceo'
  LIMIT 1;

  IF v_ceo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify if CEO is the one justifying
  IF NEW.user_id = v_ceo_id THEN
    RETURN NEW;
  END IF;

  -- Get notification details
  SELECT * INTO v_notification
  FROM public.task_delay_notifications
  WHERE id = NEW.notification_id;

  -- Get justifier name
  SELECT COALESCE(p.name, 'Usuário') INTO v_justifier_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type,
    title, message, priority,
    metadata
  ) VALUES (
    v_ceo_id,
    'ceo',
    'justification_registered',
    '📋 Nova Justificativa',
    v_justifier_name || ' justificou: "' || LEFT(v_notification.task_title, 80) || '"',
    'medium',
    jsonb_build_object(
      'justification_id', NEW.id,
      'notification_id', NEW.notification_id,
      'justifier_id', NEW.user_id,
      'justifier_name', v_justifier_name,
      'justifier_role', NEW.user_role,
      'task_title', v_notification.task_title,
      'task_table', v_notification.task_table
    )
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_task_delay_justification_notify_ceo ON public.task_delay_justifications;
CREATE TRIGGER on_task_delay_justification_notify_ceo
  AFTER INSERT ON public.task_delay_justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ceo_on_justification();

-- Also trigger on comercial_delay_justifications
CREATE OR REPLACE FUNCTION public.notify_ceo_on_comercial_justification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ceo_id UUID;
BEGIN
  SELECT ur.user_id INTO v_ceo_id
  FROM public.user_roles ur WHERE ur.role = 'ceo' LIMIT 1;

  IF v_ceo_id IS NULL OR NEW.user_id = v_ceo_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type,
    title, message, priority,
    metadata
  ) VALUES (
    v_ceo_id,
    'ceo',
    'justification_registered',
    '📋 Nova Justificativa (Comercial)',
    NEW.user_name || ' justificou atraso: ' || COALESCE(NEW.client_name, 'Cliente'),
    'medium',
    jsonb_build_object(
      'justification_id', NEW.id,
      'justifier_name', NEW.user_name,
      'notification_type', NEW.notification_type,
      'client_name', NEW.client_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comercial_justification_notify_ceo ON public.comercial_delay_justifications;
CREATE TRIGGER on_comercial_justification_notify_ceo
  AFTER INSERT ON public.comercial_delay_justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ceo_on_comercial_justification();

-- ===============================
-- Update last_sign_in_at on profiles when user logs in
-- This is needed for N13 (user inactivity check)
-- ===============================
CREATE OR REPLACE FUNCTION public.update_last_sign_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in_at = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Add last_sign_in_at column if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMP WITH TIME ZONE;

-- Create trigger on auth.users for sign in tracking
-- Note: This trigger fires on auth.users update (Supabase updates last_sign_in_at on login)
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_sign_in();
