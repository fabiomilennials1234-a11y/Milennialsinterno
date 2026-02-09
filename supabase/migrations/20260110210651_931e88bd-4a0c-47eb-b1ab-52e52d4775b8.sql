-- 1. Drop existing foreign key constraints and recreate with CASCADE on delete for group_id and SET NULL for squad_id
-- This way, when a group is deleted, all users in that group are deleted too (via edge function)
-- When a squad is deleted, users just have their squad_id set to null

-- We need to use a different approach: create a trigger to delete auth users when their profiles are orphaned

-- First, let's update the foreign key for profiles.squad_id to SET NULL on delete
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_squad_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_squad_id_fkey 
FOREIGN KEY (squad_id) 
REFERENCES public.squads(id) 
ON DELETE SET NULL;

-- Update the foreign key for profiles.group_id to SET NULL on delete (we'll handle user deletion via edge function)
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_group_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.organization_groups(id) 
ON DELETE SET NULL;

-- Update the foreign key for clients.group_id to SET NULL
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_group_id_fkey;

ALTER TABLE public.clients
ADD CONSTRAINT clients_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.organization_groups(id) 
ON DELETE SET NULL;

-- Update the foreign key for clients.squad_id to SET NULL
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_squad_id_fkey;

ALTER TABLE public.clients
ADD CONSTRAINT clients_squad_id_fkey 
FOREIGN KEY (squad_id) 
REFERENCES public.squads(id) 
ON DELETE SET NULL;

-- Update the foreign key for kanban_boards.group_id to SET NULL
ALTER TABLE public.kanban_boards 
DROP CONSTRAINT IF EXISTS kanban_boards_group_id_fkey;

ALTER TABLE public.kanban_boards
ADD CONSTRAINT kanban_boards_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.organization_groups(id) 
ON DELETE SET NULL;

-- Update the foreign key for kanban_boards.squad_id to SET NULL
ALTER TABLE public.kanban_boards 
DROP CONSTRAINT IF EXISTS kanban_boards_squad_id_fkey;

ALTER TABLE public.kanban_boards
ADD CONSTRAINT kanban_boards_squad_id_fkey 
FOREIGN KEY (squad_id) 
REFERENCES public.squads(id) 
ON DELETE SET NULL;

-- Update squads foreign key to CASCADE (delete squads when group is deleted)
ALTER TABLE public.squads 
DROP CONSTRAINT IF EXISTS squads_group_id_fkey;

ALTER TABLE public.squads
ADD CONSTRAINT squads_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.organization_groups(id) 
ON DELETE CASCADE;

-- Update group_role_limits to CASCADE
ALTER TABLE public.group_role_limits 
DROP CONSTRAINT IF EXISTS group_role_limits_group_id_fkey;

ALTER TABLE public.group_role_limits
ADD CONSTRAINT group_role_limits_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.organization_groups(id) 
ON DELETE CASCADE;