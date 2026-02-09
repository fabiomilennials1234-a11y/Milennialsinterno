-- Add archived column to ads_tasks table
ALTER TABLE ads_tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE ads_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ads_tasks_archived ON ads_tasks(archived);

-- Create function to advance client in onboarding kanbans when task is completed
CREATE OR REPLACE FUNCTION public.advance_client_onboarding_stage()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_task_type TEXT;
  v_next_column_title TEXT;
  v_board_record RECORD;
  v_target_column_id UUID;
BEGIN
  -- Only proceed if status changed to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    v_client_id := NEW.client_id;
    v_task_type := NEW.task_type;
    
    -- Map task type to the next onboarding column
    v_next_column_title := CASE v_task_type
      WHEN 'marcar_call_1' THEN 'Call 1 Marcada'
      WHEN 'realizar_call_1' THEN 'Call 1 Realizada'
      WHEN 'criar_estrategia' THEN 'Estratégia Criada'
      WHEN 'apresentar_estrategia' THEN 'Estratégia Apresentada'
      WHEN 'brifar_criativos' THEN 'Criativos Brifados'
      WHEN 'aguardar_criativos' THEN 'Criativos Prontos'
      WHEN 'publicar_campanha' THEN 'Campanha Publicada'
      ELSE NULL
    END;
    
    -- If we have a valid next column, move the client cards
    IF v_next_column_title IS NOT NULL THEN
      -- Find all boards where the client has cards and update to the next column
      FOR v_board_record IN 
        SELECT DISTINCT kc.board_id, kb.slug as board_slug
        FROM kanban_cards kc
        JOIN kanban_boards kb ON kc.board_id = kb.id
        WHERE kc.client_id = v_client_id
        AND kb.slug IN ('ads', 'comercial', 'financeiro', 'grupo-1-projetos', 'grupo-2-projetos', 'grupo-1-comercial', 'grupo-2-comercial')
      LOOP
        -- Find the target column in this board
        SELECT id INTO v_target_column_id
        FROM kanban_columns
        WHERE board_id = v_board_record.board_id
        AND title = v_next_column_title
        LIMIT 1;
        
        -- If target column exists, move all client cards to it
        IF v_target_column_id IS NOT NULL THEN
          UPDATE kanban_cards
          SET column_id = v_target_column_id,
              updated_at = NOW()
          WHERE client_id = v_client_id
          AND board_id = v_board_record.board_id;
        END IF;
      END LOOP;
      
      -- Update client_onboarding to next step
      UPDATE client_onboarding
      SET current_step = v_task_type || '_completed',
          updated_at = NOW()
      WHERE client_id = v_client_id;
    END IF;
    
    -- Set completed_at timestamp
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to advance onboarding when task is completed
DROP TRIGGER IF EXISTS trigger_advance_client_onboarding ON onboarding_tasks;
CREATE TRIGGER trigger_advance_client_onboarding
  BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_client_onboarding_stage();

-- Add onboarding columns to boards that don't have them yet
-- First, let's ensure the standard onboarding columns exist in relevant boards

-- Function to add onboarding columns to a board if they don't exist
CREATE OR REPLACE FUNCTION public.ensure_onboarding_columns(p_board_slug TEXT)
RETURNS VOID AS $$
DECLARE
  v_board_id UUID;
  v_max_position INT;
  v_columns TEXT[] := ARRAY['Call 1 Marcada', 'Call 1 Realizada', 'Estratégia Criada', 'Estratégia Apresentada', 'Criativos Brifados', 'Criativos Prontos', 'Campanha Publicada'];
  v_column_name TEXT;
  v_position INT;
BEGIN
  -- Get board ID
  SELECT id INTO v_board_id FROM kanban_boards WHERE slug = p_board_slug LIMIT 1;
  
  IF v_board_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get max position
  SELECT COALESCE(MAX(position), -1) INTO v_max_position FROM kanban_columns WHERE board_id = v_board_id;
  
  v_position := v_max_position + 1;
  
  -- Add each column if it doesn't exist
  FOREACH v_column_name IN ARRAY v_columns LOOP
    IF NOT EXISTS (
      SELECT 1 FROM kanban_columns 
      WHERE board_id = v_board_id AND title = v_column_name
    ) THEN
      INSERT INTO kanban_columns (board_id, title, position)
      VALUES (v_board_id, v_column_name, v_position);
      v_position := v_position + 1;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply to relevant boards
SELECT public.ensure_onboarding_columns('ads');
SELECT public.ensure_onboarding_columns('comercial');
SELECT public.ensure_onboarding_columns('financeiro');
SELECT public.ensure_onboarding_columns('grupo-1-projetos');
SELECT public.ensure_onboarding_columns('grupo-2-projetos');