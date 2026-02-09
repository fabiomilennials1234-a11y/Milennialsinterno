-- Remove old onboarding step 'boas_vindas' and update defaults
UPDATE client_onboarding SET current_step = 'marcar_call_1' WHERE current_step = 'boas_vindas';

-- Create onboarding_tasks table for automated task tracking
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  task_type TEXT NOT NULL, -- e.g., 'marcar_call_1', 'realizar_call_1', etc.
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'done'
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  milestone INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_tasks
CREATE POLICY "Admin can manage all onboarding tasks" 
ON public.onboarding_tasks FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Assigned user can manage their tasks" 
ON public.onboarding_tasks FOR ALL 
USING (assigned_to = auth.uid());

CREATE POLICY "CEO can view all onboarding tasks" 
ON public.onboarding_tasks FOR SELECT 
USING (is_ceo(auth.uid()));

-- Create index for fast lookups
CREATE INDEX idx_onboarding_tasks_client_id ON public.onboarding_tasks(client_id);
CREATE INDEX idx_onboarding_tasks_assigned_to ON public.onboarding_tasks(assigned_to);
CREATE INDEX idx_onboarding_tasks_status ON public.onboarding_tasks(status);

-- Function to create first onboarding task when client is created
CREATE OR REPLACE FUNCTION public.create_initial_onboarding_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create task if client has an assigned ads manager
  IF NEW.assigned_ads_manager IS NOT NULL THEN
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
      NEW.id,
      NEW.assigned_ads_manager,
      'marcar_call_1',
      'Marcar Call 1',
      'Agendar a primeira call com o cliente ' || NEW.name || ' para alinhamento inicial.',
      'pending',
      NOW() + INTERVAL '1 day',
      1
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create initial task on client creation
DROP TRIGGER IF EXISTS trigger_create_initial_onboarding_task ON public.clients;
CREATE TRIGGER trigger_create_initial_onboarding_task
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_onboarding_task();

-- Function to advance client onboarding when task is completed
CREATE OR REPLACE FUNCTION public.advance_onboarding_on_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  next_task_type TEXT;
  next_task_title TEXT;
  next_task_description TEXT;
  next_due_days INTEGER;
  next_milestone INTEGER;
  client_name TEXT;
BEGIN
  -- Only proceed if status changed to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    -- Get client name
    SELECT name INTO client_name FROM public.clients WHERE id = NEW.client_id;
    
    -- Determine next task based on current task type
    CASE NEW.task_type
      WHEN 'marcar_call_1' THEN
        next_task_type := 'realizar_call_1';
        next_task_title := 'Realizar Call 1';
        next_task_description := 'Realizar a Call 1 com o cliente ' || COALESCE(client_name, '') || '. Alinhar expectativas e colher briefing.';
        next_due_days := 2;
        next_milestone := 1;
        
        -- Update client onboarding step
        UPDATE public.client_onboarding 
        SET current_step = 'call_1_marcada', updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
      WHEN 'realizar_call_1' THEN
        next_task_type := 'criar_estrategia';
        next_task_title := 'Criar Estratégia PRO+';
        next_task_description := 'Desenvolver a estratégia de marketing para o cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 3;
        next_milestone := 2;
        
        UPDATE public.client_onboarding 
        SET current_step = 'call_1_realizada', current_milestone = 2, milestone_2_started_at = NOW(), updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
      WHEN 'criar_estrategia' THEN
        next_task_type := 'apresentar_estrategia';
        next_task_title := 'Apresentar Estratégia';
        next_task_description := 'Apresentar a estratégia ao cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_milestone := 2;
        
        UPDATE public.client_onboarding 
        SET current_step = 'estrategia_criada', updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
      WHEN 'apresentar_estrategia' THEN
        next_task_type := 'brifar_criativos';
        next_task_title := 'Brifar Criativos';
        next_task_description := 'Enviar briefing de criativos para o time de design do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_milestone := 3;
        
        UPDATE public.client_onboarding 
        SET current_step = 'estrategia_apresentada', current_milestone = 3, milestone_3_started_at = NOW(), updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
      WHEN 'brifar_criativos' THEN
        next_task_type := 'aguardar_criativos';
        next_task_title := 'Aguardar Criativos';
        next_task_description := 'Acompanhar a produção dos criativos do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 5;
        next_milestone := 3;
        
        UPDATE public.client_onboarding 
        SET current_step = 'criativos_brifados', updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
      WHEN 'aguardar_criativos' THEN
        next_task_type := 'publicar_campanha';
        next_task_title := 'Publicar Campanha';
        next_task_description := 'Publicar a primeira campanha do cliente ' || COALESCE(client_name, '') || '.';
        next_due_days := 2;
        next_milestone := 4;
        
        UPDATE public.client_onboarding 
        SET current_step = 'criativos_prontos', current_milestone = 4, milestone_4_started_at = NOW(), updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
      WHEN 'publicar_campanha' THEN
        -- Final step - mark onboarding as completed
        UPDATE public.client_onboarding 
        SET current_step = 'campanha_publicada', current_milestone = 5, milestone_5_started_at = NOW(), completed_at = NOW(), updated_at = NOW()
        WHERE client_id = NEW.client_id;
        
        UPDATE public.clients 
        SET status = 'active', campaign_published_at = NOW(), updated_at = NOW()
        WHERE id = NEW.client_id;
        
        next_task_type := NULL; -- No more tasks
        
      ELSE
        next_task_type := NULL;
    END CASE;
    
    -- Create next task if applicable
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for advancing onboarding
DROP TRIGGER IF EXISTS trigger_advance_onboarding ON public.onboarding_tasks;
CREATE TRIGGER trigger_advance_onboarding
  BEFORE UPDATE ON public.onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_onboarding_on_task_completion();

-- Enable realtime for onboarding_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_tasks;