-- pgTAP guard — zero policies em public com literal de user_role sem helper
-- is_admin/is_executive/is_ceo adjacente.
--
-- Executar:
--   set -a && source .env.scripts && set +a
--   supabase db query --linked --file supabase/tests/rls/no_literal_role_in_policy.sql
--
-- Motivo: incidente CTO 2026-04-20 mostrou que literal de role em policy
-- bloqueia silenciosamente executivos que não têm a role nomeada em
-- user_roles. A regra canônica é `is_admin(auth.uid()) OR has_role(..., 'X')`.
-- Ver docs/wiki/01-Papeis-e-Permissoes/Funções RLS.md seção "REGRA CRÍTICA".

BEGIN;

SELECT plan(1);

-- NB: o regex casa qualquer uma das roles conhecidas entre aspas simples
-- seguida de ::user_role. Se o resultado > 0, o SELECT inline exibe quais
-- policies faltam ajustar (ajuda debug iterativo — aparece no log mesmo
-- com ok() falhando).

DO $$
DECLARE
  v_count int;
  v_rec record;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role'
         OR with_check::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role')
    AND (COALESCE(qual::text, '') !~ 'is_admin|is_executive|is_ceo'
         AND COALESCE(with_check::text, '') !~ 'is_admin|is_executive|is_ceo');

  IF v_count > 0 THEN
    RAISE NOTICE '=== POLICIES REMANESCENTES COM LITERAL SEM HELPER ===';
    FOR v_rec IN
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (qual::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role'
             OR with_check::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role')
        AND (COALESCE(qual::text, '') !~ 'is_admin|is_executive|is_ceo'
             AND COALESCE(with_check::text, '') !~ 'is_admin|is_executive|is_ceo')
      ORDER BY tablename, policyname
    LOOP
      RAISE NOTICE '  %.% (%)', v_rec.tablename, v_rec.policyname, v_rec.cmd;
    END LOOP;
  END IF;
END$$;

SELECT is(
  (
    SELECT count(*)::int
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role'
           OR with_check::text ~ '''(ceo|cto|gestor_projetos|financeiro|gestor_ads|consultor_comercial|outbound|rh|design|devs|editor_video|atrizes_gravacao|produtora|gestor_crm|sucesso_cliente|consultor_mktplace)''::user_role')
      AND (COALESCE(qual::text, '') !~ 'is_admin|is_executive|is_ceo'
           AND COALESCE(with_check::text, '') !~ 'is_admin|is_executive|is_ceo')
  ),
  0,
  'zero policies em public tem literal de user_role sem helper is_admin/is_executive/is_ceo adjacente'
);

SELECT * FROM finish();

ROLLBACK;
