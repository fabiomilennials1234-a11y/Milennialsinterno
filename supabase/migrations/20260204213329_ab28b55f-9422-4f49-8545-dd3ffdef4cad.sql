-- =============================================
-- NOVAS NOTIFICAÇÕES DO SISTEMA
-- =============================================

-- 1. TRIGGER: Novo Comentário no seu Card
-- Notifica o criador do card quando alguém comenta
CREATE OR REPLACE FUNCTION public.notify_card_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card RECORD;
  v_commenter_name TEXT;
BEGIN
  -- Get card info
  SELECT kc.id, kc.title, kc.created_by, kc.client_id
  INTO v_card
  FROM kanban_cards kc
  WHERE kc.id = NEW.card_id;
  
  -- Get commenter name
  SELECT name INTO v_commenter_name FROM profiles WHERE user_id = NEW.user_id;
  
  -- Only notify if commenter is different from card creator
  IF v_card.created_by IS NOT NULL AND v_card.created_by != NEW.user_id THEN
    INSERT INTO public.system_notifications (
      recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
    ) VALUES (
      v_card.created_by,
      'new_card_comment',
      '💬 Novo Comentário no seu Card',
      COALESCE(v_commenter_name, 'Alguém') || ' comentou no card "' || v_card.title || '"',
      v_card.id,
      v_card.client_id,
      'medium',
      jsonb_build_object('comment_id', NEW.id, 'commenter_id', NEW.user_id, 'commenter_name', v_commenter_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_card_comment_notify ON card_comments;
CREATE TRIGGER on_card_comment_notify
  AFTER INSERT ON card_comments
  FOR EACH ROW EXECUTE FUNCTION notify_card_comment();

-- 2. TRIGGER: Menção em Comentário (@usuario)
-- Notifica usuários mencionados em comentários
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card RECORD;
  v_commenter_name TEXT;
  v_mentioned_user RECORD;
  v_mention TEXT;
  v_mentions TEXT[];
BEGIN
  -- Get card info
  SELECT kc.id, kc.title, kc.client_id
  INTO v_card
  FROM kanban_cards kc
  WHERE kc.id = NEW.card_id;
  
  -- Get commenter name
  SELECT name INTO v_commenter_name FROM profiles WHERE user_id = NEW.user_id;
  
  -- Extract @mentions from content (pattern: @nome)
  SELECT array_agg(m[1]) INTO v_mentions
  FROM regexp_matches(NEW.content, '@([a-zA-ZÀ-ÿ\s]+)', 'g') AS m;
  
  IF v_mentions IS NOT NULL THEN
    FOREACH v_mention IN ARRAY v_mentions
    LOOP
      -- Find user by name (case insensitive, trimmed)
      FOR v_mentioned_user IN 
        SELECT user_id, name 
        FROM profiles 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_mention))
          AND user_id != NEW.user_id
      LOOP
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
        ) VALUES (
          v_mentioned_user.user_id,
          'comment_mention',
          '📢 Você foi mencionado',
          COALESCE(v_commenter_name, 'Alguém') || ' mencionou você em um comentário no card "' || v_card.title || '"',
          v_card.id,
          v_card.client_id,
          'high',
          jsonb_build_object('comment_id', NEW.id, 'commenter_name', v_commenter_name)
        );
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_mention_notify ON card_comments;
CREATE TRIGGER on_comment_mention_notify
  AFTER INSERT ON card_comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment_mention();

-- 3. TRIGGER: Novo Treinamento Disponível
-- Notifica usuários quando um novo treinamento é criado
CREATE OR REPLACE FUNCTION public.notify_new_training()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Notify all users with matching roles (or all if no roles specified)
  FOR v_user IN 
    SELECT DISTINCT p.user_id, ur.role
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE (
      array_length(NEW.allowed_roles, 1) IS NULL
      OR ur.role::text = ANY(NEW.allowed_roles)
    )
  LOOP
    INSERT INTO public.system_notifications (
      recipient_id, recipient_role, notification_type, title, message, priority, metadata
    ) VALUES (
      v_user.user_id,
      v_user.role,
      'new_training',
      '🎓 Novo Treinamento Disponível',
      'Um novo treinamento foi publicado: "' || NEW.title || '"',
      'medium',
      jsonb_build_object('training_id', NEW.id, 'training_title', NEW.title)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger only if table trainings exists (table may be added in another migration/project)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trainings') THEN
    DROP TRIGGER IF EXISTS on_new_training_notify ON public.trainings;
    EXECUTE 'CREATE TRIGGER on_new_training_notify AFTER INSERT ON public.trainings FOR EACH ROW WHEN (NEW.archived = false) EXECUTE FUNCTION notify_new_training()';
  END IF;
END $$;

-- 4. FUNCTION: Check Action Plan Deadlines (3/1/0 days)
CREATE OR REPLACE FUNCTION public.check_action_plan_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan RECORD;
  v_days_remaining INT;
  v_cs_users RECORD;
  v_client_name TEXT;
BEGIN
  -- Find action plans with deadline in 3, 1, or 0 days
  FOR v_plan IN 
    SELECT ap.id, ap.client_id, ap.problem_type, ap.deadline, ap.severity, ap.assigned_to
    FROM cs_action_plans ap
    WHERE ap.status != 'completed'
      AND ap.deadline IS NOT NULL
      AND ap.deadline >= CURRENT_DATE
      AND ap.deadline <= CURRENT_DATE + INTERVAL '3 days'
  LOOP
    v_days_remaining := (v_plan.deadline - CURRENT_DATE);
    
    -- Only notify at 3, 1, 0 days
    IF v_days_remaining NOT IN (3, 1, 0) THEN
      CONTINUE;
    END IF;
    
    SELECT name INTO v_client_name FROM clients WHERE id = v_plan.client_id;
    
    -- Notify assigned user or all CS users
    IF v_plan.assigned_to IS NOT NULL THEN
      -- Check if notification already exists today
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE recipient_id = v_plan.assigned_to 
          AND notification_type = 'action_plan_deadline'
          AND metadata->>'plan_id' = v_plan.id::text
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, client_id, priority, metadata
        ) VALUES (
          v_plan.assigned_to,
          'action_plan_deadline',
          '⚠️ Plano de Ação Vencendo',
          'O plano de ação para "' || COALESCE(v_client_name, 'Cliente') || '" (' || v_plan.problem_type || ') vence em ' || 
            CASE WHEN v_days_remaining = 0 THEN 'HOJE' ELSE v_days_remaining || ' dia(s)' END,
          v_plan.client_id,
          CASE WHEN v_days_remaining = 0 THEN 'urgent' ELSE 'high' END,
          jsonb_build_object('plan_id', v_plan.id, 'days_remaining', v_days_remaining, 'severity', v_plan.severity)
        );
      END IF;
    ELSE
      -- Notify all CS users
      FOR v_cs_users IN 
        SELECT p.user_id FROM profiles p 
        JOIN user_roles ur ON ur.user_id = p.user_id 
        WHERE ur.role = 'sucesso_cliente'
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM system_notifications 
          WHERE recipient_id = v_cs_users.user_id 
            AND notification_type = 'action_plan_deadline'
            AND metadata->>'plan_id' = v_plan.id::text
            AND DATE(created_at) = CURRENT_DATE
        ) THEN
          INSERT INTO public.system_notifications (
            recipient_id, recipient_role, notification_type, title, message, client_id, priority, metadata
          ) VALUES (
            v_cs_users.user_id,
            'sucesso_cliente',
            'action_plan_deadline',
            '⚠️ Plano de Ação Vencendo',
            'O plano de ação para "' || COALESCE(v_client_name, 'Cliente') || '" vence em ' || 
              CASE WHEN v_days_remaining = 0 THEN 'HOJE' ELSE v_days_remaining || ' dia(s)' END,
            v_plan.client_id,
            CASE WHEN v_days_remaining = 0 THEN 'urgent' ELSE 'high' END,
            jsonb_build_object('plan_id', v_plan.id, 'days_remaining', v_days_remaining)
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- 5. FUNCTION: Check Contract Renewal (60/30 days - different from expiring)
CREATE OR REPLACE FUNCTION public.check_contract_renewals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_onboarding RECORD;
  v_days_until_expiry INT;
  v_cs_users RECORD;
  v_comercial_users RECORD;
  v_client_name TEXT;
BEGIN
  -- Find contracts expiring in 60 or 30 days (renewal opportunity)
  FOR v_onboarding IN 
    SELECT fo.client_id, fo.contract_expiration_date
    FROM financeiro_client_onboarding fo
    WHERE fo.contract_expiration_date IS NOT NULL
      AND fo.contract_expiration_date >= CURRENT_DATE
      AND fo.contract_expiration_date <= CURRENT_DATE + INTERVAL '60 days'
  LOOP
    v_days_until_expiry := (v_onboarding.contract_expiration_date - CURRENT_DATE);
    
    -- Only notify at 60 or 30 days for renewal
    IF v_days_until_expiry NOT IN (60, 30) THEN
      CONTINUE;
    END IF;
    
    SELECT name INTO v_client_name FROM clients WHERE id = v_onboarding.client_id;
    
    -- Notify CS users
    FOR v_cs_users IN 
      SELECT p.user_id FROM profiles p 
      JOIN user_roles ur ON ur.user_id = p.user_id 
      WHERE ur.role = 'sucesso_cliente'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE client_id = v_onboarding.client_id 
          AND recipient_id = v_cs_users.user_id
          AND notification_type = 'contract_renewal'
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type, title, message, client_id, priority, metadata
        ) VALUES (
          v_cs_users.user_id,
          'sucesso_cliente',
          'contract_renewal',
          '🔄 Oportunidade de Renovação',
          'O contrato do cliente ' || COALESCE(v_client_name, 'Cliente') || ' vence em ' || v_days_until_expiry || ' dias. Hora de iniciar a renovação!',
          v_onboarding.client_id,
          'medium',
          jsonb_build_object('days_until_expiry', v_days_until_expiry, 'expiration_date', v_onboarding.contract_expiration_date)
        );
      END IF;
    END LOOP;
    
    -- Notify Comercial users
    FOR v_comercial_users IN 
      SELECT p.user_id FROM profiles p 
      JOIN user_roles ur ON ur.user_id = p.user_id 
      WHERE ur.role = 'consultor_comercial'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE client_id = v_onboarding.client_id 
          AND recipient_id = v_comercial_users.user_id
          AND notification_type = 'contract_renewal'
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type, title, message, client_id, priority, metadata
        ) VALUES (
          v_comercial_users.user_id,
          'consultor_comercial',
          'contract_renewal',
          '🔄 Oportunidade de Renovação',
          'O contrato do cliente ' || COALESCE(v_client_name, 'Cliente') || ' vence em ' || v_days_until_expiry || ' dias.',
          v_onboarding.client_id,
          'medium',
          jsonb_build_object('days_until_expiry', v_days_until_expiry)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;