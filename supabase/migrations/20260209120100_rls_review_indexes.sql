-- Revisão RLS: índices para políticas que usam user_roles (is_ceo, is_admin, has_role).
-- user_roles já possui UNIQUE (user_id, role), que fornece índice para buscas por user_id.
-- Garantir índice em user_roles.user_id para lookups por apenas user_id (usado em várias políticas).
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- profiles.user_id já é UNIQUE, logo já possui índice.
-- Comentário de documentação: políticas em profiles e user_roles restringem escrita a CEO;
-- leitura é permitida a todos autenticados para listagem de equipe.
COMMENT ON TABLE public.profiles IS 'Perfis de usuário; RLS: SELECT authenticated, INSERT/UPDATE/DELETE apenas CEO. Trigger handle_new_user insere em signup.';
COMMENT ON TABLE public.user_roles IS 'Roles por usuário; RLS: SELECT authenticated, INSERT/UPDATE/DELETE apenas CEO.';
