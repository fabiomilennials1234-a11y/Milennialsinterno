-- Fix: auxiliary onboarding tasks must NOT create next tasks or update current_step
-- Only advancing tasks (marcar_call_1, realizar_call_1, etc.) should trigger automation

CREATE OR REPLACE FUNCTION public.advance_onboarding_on_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_task_type TEXT;
  next_task_title TEXT;
  next_task_description TEXT;
  next_due_days INTEGER;
  next_milestone INTEGER;
  next_step TEXT;
  client_name TEXT;
BEGIN
  -- Only proceed if status changed to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    -- Get client name
    SELECT name INTO client_name FROM public.clients WHERE id = NEW.client_id;
    
    -- Initialize defaults
    next_task_type := NULL;
    next_step := NULL;
    
    -- Determine next task based on current task type (ONLY advancing tasks)
    CASE NEW.task_type
      WHEN 'marcar_call_1' THEN
        next_task_type := 'realizar_call_1';
        next_task_title := 'Realizar Call 1';
        next_task_description := 'Realizar a Call 1 com o cliente ' || COALESCE(client_name, '') || '. Alinhar expectativas e colher briefing.';
        next_due_days := 2;
        next_milestone := 1;
        next_step := 'call_1_marcada';
        
      WHEN 'realizar_call_1' THEN
        next_task_type := 'criar_estrategia';
        next_task_title := 'Criar Estratégia PRO+';
        next_task_description := 'Desenvolver a estratégia de marketing para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_milestone := 2;
        next_step := 'call_1_realizada';
        
      WHEN 'criar_estrategia' THEN
        next_task_type := 'apresentar_estrategia';
        next_task_title := 'Apresentar Estratégia';
        next_task_description := 'Apresentar a estratégia ao cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_milestone := 2;
        next_step := 'estrategia_criada';
        
      WHEN 'apresentar_estrategia' THEN
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Enviar briefing de criativos para o time de design do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_milestone := 3;
        next_step := 'estrategia_apresentada';
        
      WHEN 'brifar_criativos' THEN
        next_task_type := 'aguardar_criativos';
        next_task_title := 'Aguardar Criativos';
        next_task_description := 'Acompanhar a produção dos criativos do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_milestone := 3;
        next_step := 'criativos_brifados';
        
      WHEN 'aguardar_criativos' THEN
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a primeira campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_milestone := 4;
        next_step := 'criativos_prontos';
        
      WHEN 'publicar_campanha' THEN
        -- Final step - mark onboarding as completed
        UPDATE public.client_onboarding 
        SET current_step = 'campanha_publicada', current_milestone = 5, milestone_5_started_at = NOW(), completed_at = NOW(), updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
        UPDATE public.clients 
        SET status = 'active', campaign_published_at = NOW(), updated_at = NOW()
        WHERE id = NEW.client_id;
        
        -- No next task for final step
        next_task_type := NULL;
        
      ELSE
        -- For auxiliary tasks (anexar_link_consultoria, certificar_consultoria, enviar_link_drive, etc.)
        -- Do NOT update current_step or create next tasks - just complete the task silently
        next_task_type := NULL;
        next_step := NULL;
    END CASE;
    
    -- Only update current_step if this is an advancing task
    IF next_step IS NOT NULL THEN
      UPDATE public.client_onboarding 
      SET current_step = next_step, updated_at = NOW()
      WHERE client_id = NEW.client_id;
      
      -- Also update milestone if needed
      IF next_milestone IS NOT NULL AND next_milestone >= 2 THEN
        DECLARE
          milestone_field TEXT;
        BEGIN
          milestone_field := 'milestone_' || next_milestone || '_started_at';
          
          EXECUTE format(
            'UPDATE public.client_onboarding SET current_milestone = %s, %I = NOW(), updated_at = NOW() WHERE client_id = %L AND (current_milestone IS NULL OR current_milestone < %s)',
            next_milestone, milestone_field, NEW.client_id, next_milestone
          );
        END;
      END IF;
    END IF;
    
    -- Create next task only if applicable
    IF next_task_type IS NOT NULL THEN
      INSERT INTO public.onboarding_tasks (
        client_id,
        assigned_to,
        task_type,
        title,
        description,
        status,
        due_date,
        milestone
      ) VALUES (
        NEW.client_id,
        NEW.assigned_to,
        next_task_type,
        next_task_title,
        next_task_description,
        'pending',
        NOW() + (next_due_days || ' days')::INTERVAL,
        next_milestone
      );
    END IF;
    
    -- Set completion timestamp
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;