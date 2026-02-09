-- Drop existing policies for kanban_cards
DROP POLICY IF EXISTS "Admins can delete cards" ON kanban_cards;
DROP POLICY IF EXISTS "Card owners and admins can update cards" ON kanban_cards;

-- Create new policies that include design roles
-- DELETE: admins, card creators, OR users with design-related roles
CREATE POLICY "Design roles can delete cards" ON kanban_cards
FOR DELETE
USING (
  is_admin(auth.uid()) 
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

-- UPDATE: admins, card creators, assignees, OR users with design-related roles
CREATE POLICY "Design roles can update cards" ON kanban_cards
FOR UPDATE
USING (
  is_admin(auth.uid()) 
  OR (created_by = auth.uid())
  OR (assigned_to = auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);