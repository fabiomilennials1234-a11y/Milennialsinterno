
-- Adicionar coluna para vincular board a um usuário específico (gestor individual)
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Criar boards individuais para os gestores andrew e jalin
-- Board para andrew
INSERT INTO kanban_boards (name, slug, description, owner_user_id, squad_id)
SELECT 
  'Gestor de ADS (' || p.name || ')',
  'ads-' || p.user_id,
  'Kanban individual do Gestor de ADS ' || p.name,
  p.user_id,
  p.squad_id
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.user_id
WHERE ur.role = 'gestor_ads'
  AND p.user_id = '8887ee69-a18d-48a6-8467-75d537b1777b'
ON CONFLICT DO NOTHING;

-- Board para jalin
INSERT INTO kanban_boards (name, slug, description, owner_user_id, squad_id)
SELECT 
  'Gestor de ADS (' || p.name || ')',
  'ads-' || p.user_id,
  'Kanban individual do Gestor de ADS ' || p.name,
  p.user_id,
  p.squad_id
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.user_id
WHERE ur.role = 'gestor_ads'
  AND p.user_id = '96218027-ac28-4a46-a574-d6d06c95628e'
ON CONFLICT DO NOTHING;
