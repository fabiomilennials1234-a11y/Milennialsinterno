-- 20260430220000_raise_devs_role_limit_to_3.sql
--
-- Aumenta limite de desenvolvedores por grupo organizacional de 1 para 3.
-- Aplica a todos os grupos existentes e ajusta o seed implicito (não há
-- seed automatico em trigger; novos grupos seguem default da tabela = 1,
-- então também ajustamos default da coluna para o novo padrão).

BEGIN;

-- Aplica imediatamente em todos os grupos existentes.
UPDATE public.group_role_limits
   SET max_count = 3, updated_at = now()
 WHERE role = 'devs'
   AND max_count < 3;

COMMIT;
