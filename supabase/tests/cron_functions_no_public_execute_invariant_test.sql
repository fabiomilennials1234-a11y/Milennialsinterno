-- supabase/tests/cron_functions_no_public_execute_invariant_test.sql
-- pgTAP — INVARIANTE de segurança: nenhuma função `_cron_*` no schema public é
-- executável por anon, authenticated, nem PUBLIC.
--
-- CONTEXTO / CAUSA-RAIZ
--   Funções `_cron_*` são SECURITY DEFINER chamadas SÓ por pg_cron. Se expostas a
--   anon/authenticated/PUBLIC via EXECUTE, viram superfície de escrita não
--   autorizada (bypass de RLS, geração de tarefas, resets etc.). O default
--   privilege do Postgres concede EXECUTE a PUBLIC em toda função nova; cada
--   `CREATE OR REPLACE` sem REVOKE explícito REABRE a brecha silenciosamente. Este
--   teste é o gate de CI que trava a regressão.
--
-- ROBUSTEZ (não hardcodar a lista)
--   O teste VARRE todas as funções com proname LIKE '\_cron\_%' (underscore
--   escapado) em pg_proc join pg_namespace (nspname='public'), prokind='f'. Pega
--   funções `_cron_*` FUTURAS sem edição. Um único assert agregado lista os nomes
--   violadores — o CI mostra exatamente qual função regrediu.
--
-- DETECÇÃO DE PUBLIC (caveat crítico do proacl)
--   `has_function_privilege(role, ...)` de um role específico JÁ herda PUBLIC, mas
--   NÃO cobre o caso do default privilege quando proacl IS NULL. Semântica do
--   Postgres:
--     - proacl IS NULL  => privilégios DEFAULT, que para função INCLUEM EXECUTE a
--                          PUBLIC. Logo NULL conta como VIOLAÇÃO, não como safe.
--     - proacl populado => PUBLIC tem EXECUTE só se existir aclitem com grantee
--                          vazio, renderizado como '=X/owner' (texto começa com '=').
--   Cobrimos os dois caminhos + os checks diretos de anon/authenticated (defesa em
--   profundidade — se qualquer role futuro herdar, um deles acusa).
--
-- Runner: SUPABASE_ACCESS_TOKEN=... supabase db query --linked -f <este arquivo>
BEGIN;

SELECT plan(2);

-- =============================================================================
-- SANIDADE: garante que a varredura de fato encontra as funções. Sem isto, ZERO
-- funções `_cron_*` faria o assert de invariante passar VACUAMENTE (array vazio).
-- Baseline atual: 6 funções endurecidas; piso em 5 tolera futura remoção pontual
-- sem falso-negativo silencioso.
-- =============================================================================
SELECT cmp_ok(
  (SELECT count(*)::int
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname LIKE '\_cron\_%'),
  '>=', 5,
  'varredura encontra >=5 funcoes _cron_* (nao passa vacuamente)'
);

-- =============================================================================
-- INVARIANTE: conjunto de violadores é VAZIO.
-- Violação de uma `_cron_*` se QUALQUER:
--   (1) proacl IS NULL            -> default privs concedem EXECUTE a PUBLIC;
--   (2) anon tem EXECUTE          -> direto ou herdado de PUBLIC;
--   (3) authenticated tem EXECUTE -> direto ou herdado de PUBLIC;
--   (4) aclitem com grantee PUBLIC (texto '=%') concede algo -> PUBLIC explícito.
-- =============================================================================
SELECT is(
  COALESCE(
    (SELECT array_agg(p.proname::text ORDER BY p.proname)
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.proname LIKE '\_cron\_%'
        AND (
              p.proacl IS NULL
           OR has_function_privilege('anon', p.oid, 'EXECUTE')
           OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
           OR EXISTS (
                SELECT 1 FROM unnest(p.proacl) a
                 WHERE a::text LIKE '=%'
              )
        )),
    '{}'::text[]
  ),
  '{}'::text[],
  'nenhuma _cron_* expoe EXECUTE a anon/authenticated/PUBLIC'
);

SELECT * FROM finish();
ROLLBACK;
