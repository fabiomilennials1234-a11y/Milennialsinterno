-- 1. Documentação Diária Pendente (Ads Manager) - roda após 15h BRT
CREATE OR REPLACE FUNCTION public.check_pending_ads_documentation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ads_manager RECORD;
  v_brazil_hour INT;
  v_today TEXT;
  v_has_doc BOOLEAN;
BEGIN
  -- Get current hour in Brazil
  v_brazil_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  
  -- Only run after 15h (3 PM) Brazil time
  IF v_brazil_hour < 15 THEN
    RETURN;
  END IF;
  
  -- Get today's date in Brazil timezone
  v_today := to_char((NOW() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  
  -- Find all Ads Managers
  FOR v_ads_manager IN 
    SELECT DISTINCT p.user_id, p.name
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'gestor_ads'
  LOOP
    -- Check if they have any documentation for today
    SELECT EXISTS (
      SELECT 1 FROM ads_daily_documentation
      WHERE ads_manager_id = v_ads_manager.user_id
        AND documentation_date = v_today
    ) INTO v_has_doc;
    
    -- If no documentation, create notification
    IF NOT v_has_doc THEN
      -- Check if notification already exists for today
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE recipient_id = v_ads_manager.user_id 
          AND notification_type = 'pending_documentation'
          AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = v_today::date
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type, title, message, priority
        ) VALUES (
          v_ads_manager.user_id,
          'gestor_ads',
          'pending_documentation',
          '📝 Documentação Pendente',
          'Você ainda não registrou a documentação diária de hoje. Faça antes de encerrar o expediente.',
          'high'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 2. Documentação Diária Pendente (Comercial) - roda após 15h BRT
CREATE OR REPLACE FUNCTION public.check_pending_comercial_documentation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_comercial RECORD;
  v_brazil_hour INT;
  v_today TEXT;
  v_has_doc BOOLEAN;
BEGIN
  -- Get current hour in Brazil
  v_brazil_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  
  -- Only run after 15h (3 PM) Brazil time
  IF v_brazil_hour < 15 THEN
    RETURN;
  END IF;
  
  -- Get today's date in Brazil timezone
  v_today := to_char((NOW() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  
  -- Find all Comercial consultants
  FOR v_comercial IN 
    SELECT DISTINCT p.user_id, p.name
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'consultor_comercial'
  LOOP
    -- Check if they have any documentation for today
    SELECT EXISTS (
      SELECT 1 FROM comercial_client_documentation
      WHERE comercial_user_id = v_comercial.user_id
        AND documentation_date = v_today
    ) INTO v_has_doc;
    
    -- If no documentation, create notification
    IF NOT v_has_doc THEN
      -- Check if notification already exists for today
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE recipient_id = v_comercial.user_id 
          AND notification_type = 'pending_documentation'
          AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = v_today::date
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type, title, message, priority
        ) VALUES (
          v_comercial.user_id,
          'consultor_comercial',
          'pending_documentation',
          '📝 Documentação Pendente',
          'Você ainda não registrou a documentação diária de hoje. Faça antes de encerrar o expediente.',
          'high'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 3. Cliente Não Movimentado - Nenhum cliente movido hoje no acompanhamento
CREATE OR REPLACE FUNCTION public.check_no_clients_moved_today()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ads_manager RECORD;
  v_brazil_hour INT;
  v_today TEXT;
  v_moved_count INT;
  v_total_clients INT;
BEGIN
  -- Get current hour in Brazil
  v_brazil_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  
  -- Only run after 17h (5 PM) Brazil time
  IF v_brazil_hour < 17 THEN
    RETURN;
  END IF;
  
  -- Get today's date in Brazil timezone
  v_today := to_char((NOW() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  
  -- Check each Ads Manager
  FOR v_ads_manager IN 
    SELECT DISTINCT p.user_id, p.name
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'gestor_ads'
  LOOP
    -- Count total clients in tracking
    SELECT COUNT(*) INTO v_total_clients
    FROM client_daily_tracking
    WHERE ads_manager_id = v_ads_manager.user_id;
    
    -- If no clients, skip
    IF v_total_clients = 0 THEN
      CONTINUE;
    END IF;
    
    -- Count clients moved today
    SELECT COUNT(*) INTO v_moved_count
    FROM client_daily_tracking
    WHERE ads_manager_id = v_ads_manager.user_id
      AND DATE(last_moved_at AT TIME ZONE 'America/Sao_Paulo') = v_today::date;
    
    -- If NO clients were moved at all today
    IF v_moved_count = 0 THEN
      -- Check if notification already exists for today
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE recipient_id = v_ads_manager.user_id 
          AND notification_type = 'no_clients_moved'
          AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = v_today::date
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type, title, message, priority
        ) VALUES (
          v_ads_manager.user_id,
          'gestor_ads',
          'no_clients_moved',
          '⚠️ Nenhum Cliente Movimentado',
          'Você não movimentou nenhum cliente hoje no acompanhamento. Lembre-se de atualizar o status de todos os seus clientes.',
          'urgent'
        );
      END IF;
    END IF;
  END LOOP;
  
  -- Also check Comercial consultants
  FOR v_ads_manager IN 
    SELECT DISTINCT p.user_id, p.name
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'consultor_comercial'
  LOOP
    -- Count total clients in comercial tracking
    SELECT COUNT(*) INTO v_total_clients
    FROM comercial_tracking
    WHERE comercial_user_id = v_ads_manager.user_id;
    
    IF v_total_clients = 0 THEN
      CONTINUE;
    END IF;
    
    -- Count clients moved today
    SELECT COUNT(*) INTO v_moved_count
    FROM comercial_tracking
    WHERE comercial_user_id = v_ads_manager.user_id
      AND DATE(last_moved_at AT TIME ZONE 'America/Sao_Paulo') = v_today::date;
    
    IF v_moved_count = 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE recipient_id = v_ads_manager.user_id 
          AND notification_type = 'no_clients_moved'
          AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = v_today::date
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type, title, message, priority
        ) VALUES (
          v_ads_manager.user_id,
          'consultor_comercial',
          'no_clients_moved',
          '⚠️ Nenhum Cliente Movimentado',
          'Você não movimentou nenhum cliente hoje no acompanhamento. Lembre-se de atualizar o status de todos os seus clientes.',
          'urgent'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 4. Milestone de Onboarding Travado - Cliente parado no mesmo marco há X dias
CREATE OR REPLACE FUNCTION public.check_stalled_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_onboarding RECORD;
  v_days_stuck INT;
  v_client_name TEXT;
  v_ads_manager_id UUID;
BEGIN
  -- Find clients stuck in onboarding (not completed, updated more than 3 days ago)
  FOR v_onboarding IN 
    SELECT co.client_id, co.current_milestone, co.current_step, co.updated_at,
           c.name as client_name, c.assigned_ads_manager
    FROM client_onboarding co
    JOIN clients c ON c.id = co.client_id
    WHERE co.completed_at IS NULL
      AND co.updated_at < NOW() - INTERVAL '3 days'
      AND c.archived = false
  LOOP
    v_days_stuck := EXTRACT(DAY FROM NOW() - v_onboarding.updated_at);
    v_client_name := v_onboarding.client_name;
    v_ads_manager_id := v_onboarding.assigned_ads_manager;
    
    -- Skip if no ads manager assigned
    IF v_ads_manager_id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Check if notification already exists recently
    IF NOT EXISTS (
      SELECT 1 FROM system_notifications 
      WHERE client_id = v_onboarding.client_id 
        AND recipient_id = v_ads_manager_id
        AND notification_type = 'stalled_onboarding'
        AND created_at > NOW() - INTERVAL '2 days'
    ) THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type, title, message, client_id, priority, metadata
      ) VALUES (
        v_ads_manager_id,
        'gestor_ads',
        'stalled_onboarding',
        '🚨 Onboarding Travado',
        'O cliente ' || v_client_name || ' está parado no Marco ' || v_onboarding.current_milestone || 
        ' (' || COALESCE(v_onboarding.current_step, 'N/A') || ') há ' || v_days_stuck || ' dias.',
        v_onboarding.client_id,
        CASE 
          WHEN v_days_stuck >= 7 THEN 'urgent'
          WHEN v_days_stuck >= 5 THEN 'high'
          ELSE 'medium'
        END,
        jsonb_build_object('days_stuck', v_days_stuck, 'milestone', v_onboarding.current_milestone, 'step', v_onboarding.current_step)
      );
    END IF;
  END LOOP;
END;
$$;

-- 5. Aprovação Pendente Há +2 dias - Card em coluna de aprovação sem ação
CREATE OR REPLACE FUNCTION public.check_pending_approvals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card RECORD;
  v_days_pending INT;
BEGIN
  -- Find cards in approval columns for more than 2 days
  FOR v_card IN 
    SELECT kc.id, kc.title, kc.updated_at, kc.created_by, kc.assigned_to, kc.client_id,
           col.title as column_title, kb.title as board_title
    FROM kanban_cards kc
    JOIN kanban_columns col ON col.id = kc.column_id
    JOIN kanban_boards kb ON kb.id = kc.board_id
    WHERE kc.archived = false
      AND (
        col.title ILIKE '%aprovação%' 
        OR col.title ILIKE '%approval%'
        OR col.title ILIKE '%para aprovar%'
      )
      AND kc.updated_at < NOW() - INTERVAL '2 days'
  LOOP
    v_days_pending := EXTRACT(DAY FROM NOW() - v_card.updated_at);
    
    -- Notify the card creator (requester)
    IF v_card.created_by IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE card_id = v_card.id 
          AND recipient_id = v_card.created_by
          AND notification_type = 'pending_approval'
          AND created_at > NOW() - INTERVAL '1 day'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
        ) VALUES (
          v_card.created_by,
          'pending_approval',
          '⏳ Aprovação Pendente',
          'O card "' || v_card.title || '" está aguardando aprovação há ' || v_days_pending || ' dias no quadro ' || v_card.board_title || '.',
          v_card.id,
          v_card.client_id,
          CASE 
            WHEN v_days_pending >= 5 THEN 'urgent'
            WHEN v_days_pending >= 3 THEN 'high'
            ELSE 'medium'
          END,
          jsonb_build_object('days_pending', v_days_pending, 'column', v_card.column_title, 'board', v_card.board_title)
        );
      END IF;
    END IF;
    
    -- Also notify the assigned person if different
    IF v_card.assigned_to IS NOT NULL AND v_card.assigned_to != v_card.created_by THEN
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE card_id = v_card.id 
          AND recipient_id = v_card.assigned_to
          AND notification_type = 'pending_approval'
          AND created_at > NOW() - INTERVAL '1 day'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
        ) VALUES (
          v_card.assigned_to,
          'pending_approval',
          '⏳ Aprovação Pendente',
          'O card "' || v_card.title || '" está em aprovação há ' || v_days_pending || ' dias.',
          v_card.id,
          v_card.client_id,
          'medium',
          jsonb_build_object('days_pending', v_days_pending, 'column', v_card.column_title)
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 6. Criativo Aguardando Aprovação - Notifica solicitante quando criativo está pronto
CREATE OR REPLACE FUNCTION public.check_creative_awaiting_approval()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card RECORD;
  v_hours_waiting INT;
BEGIN
  -- Find cards in creative approval columns (design/video boards)
  FOR v_card IN 
    SELECT kc.id, kc.title, kc.updated_at, kc.created_by, kc.client_id,
           col.title as column_title, kb.title as board_title, kb.slug
    FROM kanban_cards kc
    JOIN kanban_columns col ON col.id = kc.column_id
    JOIN kanban_boards kb ON kb.id = kc.board_id
    WHERE kc.archived = false
      AND (kb.slug IN ('design', 'video', 'atrizes', 'produtora'))
      AND (
        col.title ILIKE '%aprovação%' 
        OR col.title ILIKE '%para aprovar%'
        OR col.title ILIKE '%gravado%'
        OR col.title ILIKE '%pronto%'
      )
      AND kc.updated_at < NOW() - INTERVAL '4 hours'
  LOOP
    v_hours_waiting := EXTRACT(EPOCH FROM NOW() - v_card.updated_at) / 3600;
    
    -- Notify the card creator (the one who requested)
    IF v_card.created_by IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE card_id = v_card.id 
          AND recipient_id = v_card.created_by
          AND notification_type = 'creative_awaiting_approval'
          AND created_at > NOW() - INTERVAL '12 hours'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
        ) VALUES (
          v_card.created_by,
          'creative_awaiting_approval',
          '🎨 Criativo Aguardando Aprovação',
          'O criativo "' || v_card.title || '" está pronto e aguardando sua aprovação há ' || 
          CASE 
            WHEN v_hours_waiting >= 24 THEN (v_hours_waiting / 24) || ' dia(s)'
            ELSE v_hours_waiting || ' hora(s)'
          END || '.',
          v_card.id,
          v_card.client_id,
          CASE 
            WHEN v_hours_waiting >= 48 THEN 'high'
            ELSE 'medium'
          END,
          jsonb_build_object('hours_waiting', v_hours_waiting, 'board', v_card.board_title)
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 7. Entrega Atrasada - Card passou do prazo sem conclusão
CREATE OR REPLACE FUNCTION public.check_overdue_deliveries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card RECORD;
  v_days_overdue INT;
BEGIN
  -- Find cards with due_date in the past that are not in done/completed columns
  FOR v_card IN 
    SELECT kc.id, kc.title, kc.due_date, kc.assigned_to, kc.created_by, kc.client_id,
           col.title as column_title, kb.title as board_title
    FROM kanban_cards kc
    JOIN kanban_columns col ON col.id = kc.column_id
    JOIN kanban_boards kb ON kb.id = kc.board_id
    WHERE kc.archived = false
      AND kc.due_date IS NOT NULL
      AND kc.due_date < CURRENT_DATE
      AND col.title NOT ILIKE '%conclu%'
      AND col.title NOT ILIKE '%done%'
      AND col.title NOT ILIKE '%arquiv%'
      AND col.title NOT ILIKE '%finaliz%'
  LOOP
    v_days_overdue := CURRENT_DATE - kc.due_date::date;
    
    -- Notify the assigned person
    IF v_card.assigned_to IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE card_id = v_card.id 
          AND recipient_id = v_card.assigned_to
          AND notification_type = 'overdue_delivery'
          AND created_at > NOW() - INTERVAL '1 day'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
        ) VALUES (
          v_card.assigned_to,
          'overdue_delivery',
          '🔴 Entrega Atrasada',
          'O card "' || v_card.title || '" está atrasado há ' || v_days_overdue || ' dia(s). Prazo era: ' || to_char(v_card.due_date, 'DD/MM/YYYY') || '.',
          v_card.id,
          v_card.client_id,
          'urgent',
          jsonb_build_object('days_overdue', v_days_overdue, 'due_date', v_card.due_date, 'board', v_card.board_title)
        );
      END IF;
    END IF;
    
    -- Also notify the requester if different
    IF v_card.created_by IS NOT NULL AND v_card.created_by != v_card.assigned_to THEN
      IF NOT EXISTS (
        SELECT 1 FROM system_notifications 
        WHERE card_id = v_card.id 
          AND recipient_id = v_card.created_by
          AND notification_type = 'overdue_delivery'
          AND created_at > NOW() - INTERVAL '1 day'
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, notification_type, title, message, card_id, client_id, priority, metadata
        ) VALUES (
          v_card.created_by,
          'overdue_delivery',
          '🔴 Entrega Atrasada',
          'Sua solicitação "' || v_card.title || '" está atrasada há ' || v_days_overdue || ' dia(s).',
          v_card.id,
          v_card.client_id,
          'high',
          jsonb_build_object('days_overdue', v_days_overdue, 'due_date', v_card.due_date)
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;