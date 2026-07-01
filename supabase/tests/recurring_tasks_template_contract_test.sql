-- supabase/tests/recurring_tasks_template_contract_test.sql
-- pgTAP — Contrato do gerador recorrente ÚNICO (ADR 0016).
--
-- Prova que public._cron_generate_recurring_tasks() é a fonte data-driven de
-- tarefa recorrente, substituindo o cron bespoke create_weekly_gestor_tasks()
-- (dropado em 20260701130000). Invariantes:
--   ESTRUTURA / HARDENING
--     - função existe, SECURITY DEFINER, search_path travado;
--     - NÃO executável por authenticated nem anon (só cron/service/owner).
--   CONTRATO DE GERAÇÃO (target_role = gestor_ads)
--     (a) template ATIVO ⇒ INSERE em department_tasks carimbando
--         recurring_template_id = id do template;
--     (b) 2ª chamada consecutiva DEDUPA (não duplica o mesmo template/ciclo);
--     (c) template is_active=false ⇒ ZERO geração.
--
-- Nota de robustez: recurrence='daily' é usada de propósito. A seleção de janela
-- (weekly_*/biweekly/monthly) é dependente de DOW/semana e tornaria o teste
-- flaky conforme o dia. O ramo 'daily' exercita EXATAMENTE o mesmo INSERT +
-- carimbo de recurring_template_id + dedup; o gate de recorrência (o WHERE
-- is_active) é provado isoladamente em (c). Asserts escopados ao usuário e ao
-- template semeados — independem do estado de produção.
--
-- UUID prefix: 'd9000000'. Runner: scripts/sb-pgtap.sh supabase/tests/recurring_tasks_template_contract_test.sql
BEGIN;

SELECT plan(8);

-- =============================================================================
-- ESTRUTURA / HARDENING
-- =============================================================================
SELECT has_function('public', '_cron_generate_recurring_tasks', '{}'::text[],
  '_cron_generate_recurring_tasks() existe');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_cron_generate_recurring_tasks'),
  true, 'gerador é SECURITY DEFINER');

SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_cron_generate_recurring_tasks'),
  'gerador trava search_path');

SELECT is(
  has_function_privilege('authenticated', 'public._cron_generate_recurring_tasks()', 'EXECUTE'),
  false, 'authenticated NÃO executa o gerador (só cron/service)');

SELECT is(
  has_function_privilege('anon', 'public._cron_generate_recurring_tasks()', 'EXECUTE'),
  false, 'anon NÃO executa o gerador');

-- =============================================================================
-- SEED: 1 usuário gestor_ads + 1 template ATIVO (A) + 1 template INATIVO (B).
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('d9000000-0000-0000-0000-0000000000a1'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'rtc-gestor@test.local', crypt('t', gen_salt('bf')),
        'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES ('d9000000-0000-0000-0000-0000000000a1'::uuid, 'RTC Gestor', 'rtc-gestor@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('d9000000-0000-0000-0000-0000000000a1'::uuid, 'gestor_ads')
ON CONFLICT (user_id, role) DO NOTHING;

-- Template A: ATIVO, daily, target gestor_ads.
INSERT INTO public.recurring_task_templates
  (id, title, description, department, target_role, recurrence, task_type, priority, is_active, created_by)
VALUES ('d9000000-0000-0000-0000-00000000a001'::uuid,
        'CONTRACT gestor report TEST', 'contract seed', 'ads_contract_test',
        'gestor_ads', 'daily', 'daily', 'normal', true,
        'd9000000-0000-0000-0000-0000000000a1'::uuid);

-- Template B: INATIVO.
INSERT INTO public.recurring_task_templates
  (id, title, description, department, target_role, recurrence, task_type, priority, is_active, created_by)
VALUES ('d9000000-0000-0000-0000-00000000b001'::uuid,
        'CONTRACT inactive TEST', 'inactive seed', 'ads_contract_test',
        'gestor_ads', 'daily', 'daily', 'normal', false,
        'd9000000-0000-0000-0000-0000000000a1'::uuid);

-- =============================================================================
-- (a) ATIVO ⇒ gera 1 task carimbada com recurring_template_id = A.
-- =============================================================================
SELECT public._cron_generate_recurring_tasks();

SELECT is(
  (SELECT count(*)::int FROM public.department_tasks
     WHERE user_id = 'd9000000-0000-0000-0000-0000000000a1'::uuid
       AND recurring_template_id = 'd9000000-0000-0000-0000-00000000a001'::uuid),
  1, '(a) template ativo gera EXATAMENTE 1 task carimbada com recurring_template_id');

-- =============================================================================
-- (b) 2ª chamada DEDUPA — continua 1.
-- =============================================================================
SELECT public._cron_generate_recurring_tasks();

SELECT is(
  (SELECT count(*)::int FROM public.department_tasks
     WHERE user_id = 'd9000000-0000-0000-0000-0000000000a1'::uuid
       AND recurring_template_id = 'd9000000-0000-0000-0000-00000000a001'::uuid),
  1, '(b) 2ª chamada não duplica (dedup por recurring_template_id/ciclo)');

-- =============================================================================
-- (c) INATIVO ⇒ ZERO geração para o template B.
-- =============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.department_tasks
     WHERE recurring_template_id = 'd9000000-0000-0000-0000-00000000b001'::uuid),
  0, '(c) template is_active=false não gera nada');

SELECT * FROM finish();
ROLLBACK;
