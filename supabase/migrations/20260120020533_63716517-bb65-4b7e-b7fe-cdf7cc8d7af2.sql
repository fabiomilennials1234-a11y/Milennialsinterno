-- Update the function to skip creating 'aguardar_criativos' task after 'brifar_criativos'
-- Instead, 'brifar_criativos' will be the final advancing task for Milestone 3
-- and will transition to Milestone 4 directly

CREATE OR REPLACE FUNCTION public.advance_onboarding_on_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  client_name TEXT;
  client_id_val UUID;
  ads_manager_id_val UUID;
  current_step_val TEXT;
  current_milestone_val INT;
  next_task_type TEXT;
  next_task_title TEXT;
  next_task_description TEXT;
  next_due_days INT;
  next_step TEXT;
  next_milestone INT;
  is_advancing_task BOOLEAN := FALSE;
BEGIN
  -- Only proceed if status changed to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    
    -- Get client info
    SELECT c.name, c.id, c.assigned_ads_manager 
    INTO client_name, client_id_val, ads_manager_id_val
    FROM clients c
    WHERE c.id = NEW.client_id;
    
    -- Get current onboarding state
    SELECT co.current_step, co.current_milestone 
    INTO current_step_val, current_milestone_val
    FROM client_onboarding co
    WHERE co.client_id = NEW.client_id;
    
    -- Determine if this is an advancing task and what comes next
    CASE NEW.task_type
      WHEN 'marcar_call_1' THEN
        is_advancing_task := TRUE;
        next_task_type := 'realizar_call_1';
        next_task_title := 'Realizar Call 1';
        next_task_description := 'Realizar a primeira call com o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'call_1_marcada';
        next_milestone := 1;
        
      WHEN 'realizar_call_1' THEN
        is_advancing_task := TRUE;
        next_task_type := 'enviar_estrategia';
        next_task_title := 'Enviar Estratégia PRO+';
        next_task_description := 'Enviar a estratégia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 4;
        next_step := 'criar_estrategia';
        next_milestone := 2;
        
      WHEN 'enviar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;
        
      WHEN 'brifar_criativos' THEN
        is_advancing_task := TRUE;
        -- After brifar_criativos, go directly to Milestone 4 with publicar_campanha
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 6;
        next_step := 'elencar_otimizacoes';
        next_milestone := 4;
        
      WHEN 'publicar_campanha' THEN
        is_advancing_task := TRUE;
        -- Final task - complete onboarding
        next_task_type := NULL;
        next_step := 'campanha_publicada';
        next_milestone := 5;
        
      ELSE
        -- All other tasks are auxiliary and don't advance the client
        is_advancing_task := FALSE;
    END CASE;
    
    -- Only advance client and create new tasks if this is an advancing task
    IF is_advancing_task THEN
      -- Update client onboarding status
      UPDATE client_onboarding 
      SET 
        current_step = next_step,
        current_milestone = next_milestone,
        updated_at = NOW()
      WHERE client_id = NEW.client_id;
      
      -- Create next task if there is one
      IF next_task_type IS NOT NULL AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (
          client_id,
          assigned_to,
          title,
          task_type,
          description,
          status,
          milestone,
          due_date
        ) VALUES (
          NEW.client_id,
          ads_manager_id_val,
          next_task_title,
          next_task_type,
          next_task_description,
          'pending',
          next_milestone,
          NOW() + (next_due_days || ' days')::INTERVAL
        );
      END IF;
      
      -- If completing publicar_campanha, mark client as active
      IF NEW.task_type = 'publicar_campanha' THEN
        UPDATE clients 
        SET 
          status = 'active',
          campaign_published_at = NOW(),
          updated_at = NOW()
        WHERE id = NEW.client_id;
        
        UPDATE client_onboarding 
        SET completed_at = NOW()
        WHERE client_id = NEW.client_id;
      END IF;
      
      -- Create auxiliary tasks for specific milestones (only when advancing)
      IF NEW.task_type = 'enviar_estrategia' AND ads_manager_id_val IS NOT NULL THEN
        -- Milestone 3 auxiliary tasks
        INSERT INTO onboarding_tasks (client_id, assigned_to, title, task_type, description, status, milestone, due_date)
        VALUES 
          (NEW.client_id, ads_manager_id_val, 'Anexar link da consultoria', 'anexar_link_consultoria', 'Anexar o link da consultoria para o cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days'),
          (NEW.client_id, ads_manager_id_val, 'Certificar acompanhamento comercial', 'certificar_acompanhamento', 'Certificar que o acompanhamento comercial está configurado para o cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days'),
          (NEW.client_id, ads_manager_id_val, 'Enviar e anexar no grupo o link do drive', 'enviar_link_drive', 'Enviar e anexar no grupo o link do drive do cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days');
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;