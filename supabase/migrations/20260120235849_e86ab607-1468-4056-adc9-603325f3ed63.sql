
CREATE OR REPLACE FUNCTION public.advance_onboarding_on_task_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  day_of_week TEXT;
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
      -- MILESTONE 1: Marcação e realização da Call 1
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
        next_task_type := 'apresentar_estrategia';
        next_task_title := 'Apresentar Estratégia PRO+';
        next_task_description := 'Apresentar a estratégia PRO+ para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 4;
        next_step := 'criar_estrategia';
        next_milestone := 2;
      
      -- MILESTONE 2: Criar e apresentar estratégia
      WHEN 'apresentar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;
      
      -- MILESTONE 3: Brifar criativos -> vai para Milestone 4
      WHEN 'brifar_criativos' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_otimizacoes_pendentes';
        next_task_title := 'Brifar otimizações pendentes do(a) ' || COALESCE(client_name, '');
        next_task_description := 'Brifar as otimizações pendentes do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'elencar_otimizacoes';
        next_milestone := 4;
      
      -- MILESTONE 4: Elencar Otimizações -> vai para Milestone 5
      WHEN 'brifar_otimizacoes_pendentes' THEN
        is_advancing_task := TRUE;
        next_task_type := 'configurar_conta_anuncios';
        next_task_title := 'Configurar conta de anúncios do(a) ' || COALESCE(client_name, '');
        next_task_description := 'Configurar a conta de anúncios do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_step := 'configurar_conta_anuncios';
        next_milestone := 5;
      
      -- MILESTONE 5: Configurações finais
      WHEN 'configurar_conta_anuncios' THEN
        is_advancing_task := TRUE;
        next_task_type := 'certificar_consultoria';
        next_task_title := 'Certificar se a consultoria do(a) ' || COALESCE(client_name, '') || ' já foi realizada';
        next_task_description := 'Certificar se a consultoria do cliente ' || COALESCE(client_name, '') || ' já foi realizada.';
        next_due_days := 2;
        next_step := 'certificando_consultoria';
        next_milestone := 5;
        
      WHEN 'certificar_consultoria' THEN
        is_advancing_task := TRUE;
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_step := 'esperando_criativos';
        next_milestone := 5;
      
      -- Finalizar onboarding
      WHEN 'publicar_campanha' THEN
        is_advancing_task := TRUE;
        next_task_type := NULL;
        next_step := 'campanha_publicada';
        next_milestone := 5;
      
      -- Suporte para task_type antigo (enviar_estrategia) para compatibilidade
      WHEN 'enviar_estrategia' THEN
        is_advancing_task := TRUE;
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Criar briefing de criativos para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_step := 'brifar_criativos';
        next_milestone := 3;
        
      ELSE
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
      
      -- If completing publicar_campanha, mark client as active AND create tracking record
      IF NEW.task_type = 'publicar_campanha' THEN
        -- Mark client as active
        UPDATE clients 
        SET 
          status = 'active',
          campaign_published_at = NOW(),
          updated_at = NOW()
        WHERE id = NEW.client_id;
        
        -- Mark onboarding as completed
        UPDATE client_onboarding 
        SET completed_at = NOW()
        WHERE client_id = NEW.client_id;
        
        -- Get day of week in Portuguese
        day_of_week := public.get_day_of_week_portuguese();
        
        -- Create tracking record for acompanhamento (only if not exists)
        INSERT INTO client_daily_tracking (
          client_id,
          ads_manager_id,
          current_day,
          last_moved_at
        ) VALUES (
          NEW.client_id,
          ads_manager_id_val,
          day_of_week,
          NOW()
        )
        ON CONFLICT (client_id) DO UPDATE SET
          current_day = EXCLUDED.current_day,
          last_moved_at = NOW(),
          updated_at = NOW();
      END IF;
      
      -- Create auxiliary tasks for Milestone 3 (when apresentar_estrategia is completed)
      IF (NEW.task_type = 'apresentar_estrategia' OR NEW.task_type = 'enviar_estrategia') AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (client_id, assigned_to, title, task_type, description, status, milestone, due_date)
        VALUES 
          (NEW.client_id, ads_manager_id_val, 'Anexar link da consultoria', 'anexar_link_consultoria', 'Anexar o link da consultoria para o cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days'),
          (NEW.client_id, ads_manager_id_val, 'Certificar acompanhamento comercial do(a) ' || COALESCE(client_name, ''), 'certificar_acompanhamento', 'Certificar que o acompanhamento comercial está configurado para o cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days'),
          (NEW.client_id, ads_manager_id_val, 'Enviar e anexar no grupo o link do drive', 'enviar_link_drive', 'Enviar e anexar no grupo o link do drive do cliente ' || COALESCE(client_name, ''), 'pending', 3, NOW() + INTERVAL '5 days');
      END IF;
      
      -- Create auxiliary task after brifar_criativos
      IF NEW.task_type = 'brifar_criativos' AND ads_manager_id_val IS NOT NULL THEN
        INSERT INTO onboarding_tasks (client_id, assigned_to, title, task_type, description, status, milestone, due_date)
        VALUES 
          (NEW.client_id, ads_manager_id_val, 'Avisar o(a) ' || COALESCE(client_name, '') || ' o prazo de entrega dos criativos', 'avisar_prazo_criativos', 'Avisar o cliente ' || COALESCE(client_name, '') || ' sobre o prazo de entrega dos criativos.', 'pending', 4, NOW() + INTERVAL '1 day');
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;
