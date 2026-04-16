-- 20260416120000_fix_user_roles_cto_constraint.sql
-- The original CTO migration (20260415120000) added 'cto' to the user_role enum
-- but missed updating the CHECK constraint on user_roles table.
-- This prevented assigning the CTO role to any user.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY[
    'ceo'::user_role, 'cto'::user_role, 'gestor_projetos'::user_role,
    'gestor_ads'::user_role, 'outbound'::user_role, 'sucesso_cliente'::user_role,
    'design'::user_role, 'editor_video'::user_role, 'devs'::user_role,
    'atrizes_gravacao'::user_role, 'produtora'::user_role, 'gestor_crm'::user_role,
    'consultor_comercial'::user_role, 'consultor_mktplace'::user_role,
    'financeiro'::user_role, 'rh'::user_role
  ]));
