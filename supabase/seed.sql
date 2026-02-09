-- Seed de usuários para ambiente de demonstração.
-- Pré-requisito: os usuários já devem existir em auth.users (criados via Dashboard
-- Supabase Auth > Users > Add user, ou via Edge Function create-user).
-- Senhas de demonstração (usar apenas em dev/demo): ceo123, projetos123, ads123, etc.
-- Este script preenche public.profiles e public.user_roles a partir de auth.users (por email).

-- Inserir profiles (user_id, name, email) para cada email que existir em auth.users
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Ricardo Oliveira', 'ceo@millennialsb2b.com' FROM auth.users WHERE email = 'ceo@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Amanda Santos', 'projetos@millennialsb2b.com' FROM auth.users WHERE email = 'projetos@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Carlos Mendes', 'ads@millennialsb2b.com' FROM auth.users WHERE email = 'ads@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Beatriz Lima', 'sucesso@millennialsb2b.com' FROM auth.users WHERE email = 'sucesso@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Lucas Ferreira', 'design@millennialsb2b.com' FROM auth.users WHERE email = 'design@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Marina Costa', 'video@millennialsb2b.com' FROM auth.users WHERE email = 'video@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Felipe Rodrigues', 'dev@millennialsb2b.com' FROM auth.users WHERE email = 'dev@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Juliana Alves', 'atrizes@millennialsb2b.com' FROM auth.users WHERE email = 'atrizes@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Bruno Nascimento', 'produtora@millennialsb2b.com' FROM auth.users WHERE email = 'produtora@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Camila Souza', 'crm@millennialsb2b.com' FROM auth.users WHERE email = 'crm@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Diego Martins', 'comercial@millennialsb2b.com' FROM auth.users WHERE email = 'comercial@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Fernanda Gomes', 'financeiro@millennialsb2b.com' FROM auth.users WHERE email = 'financeiro@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
SELECT id, 'Gabriel Pereira', 'rh@millennialsb2b.com' FROM auth.users WHERE email = 'rh@millennialsb2b.com'
ON CONFLICT (user_id) DO NOTHING;

-- Inserir user_roles (user_id, role) para cada usuário
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'ceo'::public.user_role FROM auth.users WHERE email = 'ceo@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'gestor_projetos'::public.user_role FROM auth.users WHERE email = 'projetos@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'gestor_ads'::public.user_role FROM auth.users WHERE email = 'ads@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'sucesso_cliente'::public.user_role FROM auth.users WHERE email = 'sucesso@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'design'::public.user_role FROM auth.users WHERE email = 'design@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'editor_video'::public.user_role FROM auth.users WHERE email = 'video@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'devs'::public.user_role FROM auth.users WHERE email = 'dev@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'atrizes_gravacao'::public.user_role FROM auth.users WHERE email = 'atrizes@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'produtora'::public.user_role FROM auth.users WHERE email = 'produtora@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'gestor_crm'::public.user_role FROM auth.users WHERE email = 'crm@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'consultor_comercial'::public.user_role FROM auth.users WHERE email = 'comercial@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'financeiro'::public.user_role FROM auth.users WHERE email = 'financeiro@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'rh'::public.user_role FROM auth.users WHERE email = 'rh@millennialsb2b.com'
ON CONFLICT (user_id, role) DO NOTHING;
