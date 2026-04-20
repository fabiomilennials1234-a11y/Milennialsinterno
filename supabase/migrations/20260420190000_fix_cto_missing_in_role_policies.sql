-- 20260420190000_fix_cto_missing_in_role_policies.sql
--
-- HOTFIX CRÍTICO — CTO bloqueado em prod.
--
-- PROBLEMA
--   Três tabelas do domínio financeiro/ads têm policies RLS que comparam o
--   literal 'ceo' sem incluir 'cto'. Isso viola a hierarquia executiva (CTO
--   deve ter o mesmo acesso funcional que CEO, conforme
--   docs/wiki/01-Papeis-e-Permissoes/Hierarquia Executiva.md) e impede o
--   usuário CTO de gravar financeiro_tasks, financeiro_client_onboarding e
--   ads_tasks.
--
--   Evidência: cliente TESTE 01 (e9f754cc-b34b-4fad-b9ad-ace7337e0a38),
--   criado por CTO em 2026-04-20 19:56 BRT, ficou com 0 linhas em
--   financeiro_tasks e 0 em financeiro_client_onboarding (trigger
--   process_upsell é SECURITY DEFINER, mas INSERT direto feito pelo hook
--   useClientRegistration bateu no RLS e falhou silencioso). Backfill
--   desse cliente via supabase/backfills/20260420_teste01_*.sql.
--
-- CIRURGIA
--   * DROP + CREATE de cada policy afetada, preservando EXATAMENTE a
--     semântica original — só troca literais por helpers já canônicos:
--       is_admin(auth.uid())     = ceo | cto | gestor_projetos
--       is_executive(auth.uid()) = ceo | cto
--   * Nenhuma outra policy, tabela, trigger ou dado é tocado.
--   * Auditoria completa (107 policies) fica para Wave 1 Track A.
--
-- ROLLBACK RÁPIDO
--   As definições originais das 11 policies estão reproduzidas como
--   comentários `-- ORIGINAL:` antes de cada CREATE. Para reverter, basta
--   recriar cada policy com o corpo documentado. Origem exata:
--     * financeiro_tasks:              20260220100000_create_financeiro_tasks.sql
--     * financeiro_client_onboarding:  20260122034402_19110700-...sql
--     * ads_tasks insert:              20260122023909_8a8d51b2-...sql
--     * ads_tasks update/delete:       20260118221923_a0f4a392-...sql

BEGIN;

-- =========================================================================
-- financeiro_tasks
-- =========================================================================
-- Original (20260220100000_create_financeiro_tasks.sql): permite
-- select/insert/update/delete quando o usuário tem role IN ('financeiro',
-- 'gestor_projetos', 'ceo'). CTO faltava na lista.

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "financeiro_tasks_select" ON public.financeiro_tasks;
CREATE POLICY "financeiro_tasks_select"
  ON public.financeiro_tasks FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "financeiro_tasks_insert" ON public.financeiro_tasks;
CREATE POLICY "financeiro_tasks_insert"
  ON public.financeiro_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "financeiro_tasks_update" ON public.financeiro_tasks;
CREATE POLICY "financeiro_tasks_update"
  ON public.financeiro_tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "financeiro_tasks_delete" ON public.financeiro_tasks;
CREATE POLICY "financeiro_tasks_delete"
  ON public.financeiro_tasks FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- =========================================================================
-- financeiro_client_onboarding
-- =========================================================================
-- Original (20260122034402_...): predicado via profiles+user_roles com
-- role IN ('financeiro', 'gestor_projetos', 'ceo'). O JOIN extra em profiles
-- é redundante (profiles.user_id=auth.uid() e depois subquery recupera
-- ur.id=profiles.id que é o próprio profile). Aqui preservamos a INTENÇÃO
-- (autorização por role) com a forma enxuta e correta — idêntica em
-- semântica, sem o JOIN redundante.

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "Financeiro can view all onboarding records" ON public.financeiro_client_onboarding;
CREATE POLICY "Financeiro can view all onboarding records"
  ON public.financeiro_client_onboarding FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "Financeiro can insert onboarding records" ON public.financeiro_client_onboarding;
CREATE POLICY "Financeiro can insert onboarding records"
  ON public.financeiro_client_onboarding FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "Financeiro can update onboarding records" ON public.financeiro_client_onboarding;
CREATE POLICY "Financeiro can update onboarding records"
  ON public.financeiro_client_onboarding FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- ORIGINAL: role IN ('financeiro', 'gestor_projetos', 'ceo')
DROP POLICY IF EXISTS "Financeiro can delete onboarding records" ON public.financeiro_client_onboarding;
CREATE POLICY "Financeiro can delete onboarding records"
  ON public.financeiro_client_onboarding FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'financeiro'
    )
  );

-- =========================================================================
-- ads_tasks
-- =========================================================================
-- Origens:
--   INSERT (20260122023909): own OR role IN ('ceo','gestor_projetos')
--   UPDATE (20260118221923): own OR role = 'ceo'
--   DELETE (20260118221923): own OR role = 'ceo'
-- Para INSERT, is_admin cobre exatamente (ceo, cto, gestor_projetos) — CTO
-- entra como extensão intencional conforme Hierarquia Executiva.
-- Para UPDATE/DELETE, is_executive cobre (ceo, cto).

-- ORIGINAL: ads_manager_id = auth.uid() OR role IN ('ceo','gestor_projetos')
DROP POLICY IF EXISTS "Users can insert own tasks or admins can insert for any" ON public.ads_tasks;
CREATE POLICY "Users can insert own tasks or admins can insert for any"
  ON public.ads_tasks
  FOR INSERT
  WITH CHECK (
    ads_manager_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- ORIGINAL: ads_manager_id = auth.uid() OR role = 'ceo'
DROP POLICY IF EXISTS "Users can update own tasks or CEO can update any" ON public.ads_tasks;
CREATE POLICY "Users can update own tasks or CEO can update any"
  ON public.ads_tasks
  FOR UPDATE
  USING (
    ads_manager_id = auth.uid()
    OR public.is_executive(auth.uid())
  );

-- ORIGINAL: ads_manager_id = auth.uid() OR role = 'ceo'
DROP POLICY IF EXISTS "Users can delete own tasks or CEO can delete any" ON public.ads_tasks;
CREATE POLICY "Users can delete own tasks or CEO can delete any"
  ON public.ads_tasks
  FOR DELETE
  USING (
    ads_manager_id = auth.uid()
    OR public.is_executive(auth.uid())
  );

COMMIT;

-- NOTA — auditoria completa (Wave 1 Track A)
-- Esta migration é cirúrgica sobre 3 tabelas / 11 policies. Um levantamento
-- das ~107 policies restantes que ainda podem conter literal 'ceo' (sem
-- passar por is_ceo/is_admin/is_executive) será entregue em migration
-- separada. Não misturar aqui pra manter o hotfix pequeno e reversível.
