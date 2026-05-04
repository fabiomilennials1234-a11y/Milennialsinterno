# Justificativas na Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o modal bloqueante `TaskDelayModal` por uma área dedicada `/justificativas` com 3 tabs, badge bottom-fixed na sidebar e visão master hierárquica por escopo.

**Architecture:** Toda autoridade de escopo e ações master vivem em RPCs Postgres `SECURITY DEFINER`. Frontend é puro consumidor (TanStack Query + shadcn/ui). RLS bloqueia escrita direta em `task_delay_justifications`; leitura própria via RLS, leitura/escrita master só via RPC. Notificações master usam `system_notifications` existente com 2 tipos novos.

**Tech Stack:** React 18 + TypeScript + TanStack Query + shadcn/ui + Tailwind + react-router-dom + Supabase (Postgres) + pgTAP + Vitest + Playwright.

**Spec base:** `docs/superpowers/specs/2026-05-04-justificativas-sidebar-design.md`.

---

## Convenções

- Teste antes do código quando possível (TDD).
- Commit por task. Mensagem segue Conventional Commits.
- Toda RPC nova começa com `SET search_path = public` e usa `SECURITY DEFINER`.
- Toda RPC master valida escopo via `assert_user_in_my_scope` no início.
- Vitest: `npm test`. pgTAP: `npm run test:db`. Playwright: `npm run test:e2e`. Types: `npm run supabase:gen-types`.

---

## File Structure

**Banco (novas migrations em `supabase/migrations/`):**
- `20260504100000_justifications_extend_columns.sql` — colunas + indexes em `task_delay_justifications`
- `20260504100100_justifications_scope_helpers.sql` — `get_team_users_in_scope`, `assert_user_in_my_scope`
- `20260504100200_rpc_submit_justification.sql`
- `20260504100300_rpc_get_pending_mine.sql`
- `20260504100400_rpc_get_done_mine.sql`
- `20260504100500_rpc_get_team_grouped.sql`
- `20260504100600_rpc_master_actions.sql` — request_revision + nudge + archive/unarchive
- `20260504100700_tighten_rls_task_delay_justifications.sql`

**pgTAP (novos em `supabase/tests/`):**
- `justifications_scope_test.sql`
- `justifications_submit_test.sql`
- `justifications_pending_mine_test.sql`
- `justifications_done_mine_test.sql`
- `justifications_team_grouped_test.sql`
- `justifications_master_actions_test.sql`
- `justifications_rls_test.sql`

**Frontend novos:**
- `src/hooks/useJustificativas.ts` (todos os hooks de Justificativas)
- `src/hooks/useJustificativas.test.ts`
- `src/pages/Justificativas.tsx`
- `src/pages/Justificativas.test.tsx`
- `src/components/justificativas/SidebarBadge.tsx`
- `src/components/justificativas/SidebarBadge.test.tsx`
- `src/components/justificativas/JustificativaItem.tsx`
- `src/components/justificativas/JustificativaItem.test.tsx`
- `src/components/justificativas/JustificarForm.tsx`
- `src/components/justificativas/JustificarForm.test.tsx`
- `src/components/justificativas/PendentesTab.tsx`
- `src/components/justificativas/JustificadasTab.tsx`
- `src/components/justificativas/EquipeTab.tsx`
- `src/components/justificativas/EquipeTab.test.tsx`
- `src/components/justificativas/PessoaAccordion.tsx`
- `src/components/justificativas/ComentarioMaster.tsx`
- `src/components/justificativas/CobrarButton.tsx`

**Frontend modificados:**
- `src/App.tsx` — adicionar `<Route path="/justificativas">`
- `src/components/layout/AppSidebar.tsx` — adicionar `<SidebarBadge />` bottom-fixed
- `src/layouts/MainLayout.tsx:5` (remove import) e `:57` (remove render)
- **Deletar:** `src/components/TaskDelayModal.tsx`

**E2E:**
- `e2e/justificativas.spec.ts`

---

## Task 1: Migration — extend `task_delay_justifications`

**Files:**
- Create: `supabase/migrations/20260504100000_justifications_extend_columns.sql`

- [ ] **Step 1.1: Criar migration**

```sql
-- 20260504100000_justifications_extend_columns.sql
-- Adiciona suporte a comentário do master e flag de revisão exigida.
-- Spec: docs/superpowers/specs/2026-05-04-justificativas-sidebar-design.md

ALTER TABLE public.task_delay_justifications
  ADD COLUMN IF NOT EXISTS master_comment text,
  ADD COLUMN IF NOT EXISTS master_comment_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS master_comment_at timestamptz,
  ADD COLUMN IF NOT EXISTS requires_revision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_requested_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tdj_requires_revision
  ON public.task_delay_justifications (user_id)
  WHERE requires_revision = true;

CREATE INDEX IF NOT EXISTS idx_tdj_notification_user
  ON public.task_delay_justifications (notification_id, user_id);

COMMENT ON COLUMN public.task_delay_justifications.master_comment IS
  'Comentário do master sobre essa justificativa. Sobrescrito a cada chamada de request_justification_revision.';
COMMENT ON COLUMN public.task_delay_justifications.requires_revision IS
  'Quando true, a justificativa foi rejeitada pelo master e o devedor precisa refazer. RPC submit_justification arquiva o registro antigo e cria um novo zerando essa flag.';
```

- [ ] **Step 1.2: Aplicar migration**

```bash
supabase db push
```

Expected: migration aplicada sem erro. `\d public.task_delay_justifications` no psql mostra as 6 colunas novas.

- [ ] **Step 1.3: Commit**

```bash
git add supabase/migrations/20260504100000_justifications_extend_columns.sql
git commit -m "feat(db): extend task_delay_justifications com master_comment e requires_revision"
```

---

## Task 2: pgTAP test + RPC `get_team_users_in_scope` + `assert_user_in_my_scope`

**Files:**
- Create: `supabase/migrations/20260504100100_justifications_scope_helpers.sql`
- Create: `supabase/tests/justifications_scope_test.sql`

- [ ] **Step 2.1: Escrever pgTAP test (vai falhar)**

```sql
-- supabase/tests/justifications_scope_test.sql
BEGIN;
SELECT plan(7);

-- Setup: seed users com diferentes roles e grupos
-- Assume helpers existentes; se não, cria fixtures locais
DO $$
DECLARE
  v_group_a uuid := gen_random_uuid();
  v_group_b uuid := gen_random_uuid();
  v_ceo uuid := gen_random_uuid();
  v_gp uuid := gen_random_uuid();
  v_ads_a uuid := gen_random_uuid();
  v_sc_a uuid := gen_random_uuid();
  v_ads_b uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organization_groups (id, name, slug) VALUES
    (v_group_a, 'Group A', 'group-a'),
    (v_group_b, 'Group B', 'group-b');

  INSERT INTO auth.users (id, email) VALUES
    (v_ceo, 'ceo@x.com'),
    (v_gp, 'gp@x.com'),
    (v_ads_a, 'adsa@x.com'),
    (v_sc_a, 'sca@x.com'),
    (v_ads_b, 'adsb@x.com'),
    (v_design, 'design@x.com');

  INSERT INTO public.profiles (user_id, name, group_id) VALUES
    (v_ceo, 'CEO', NULL),
    (v_gp, 'GP', NULL),
    (v_ads_a, 'AdsA', v_group_a),
    (v_sc_a, 'ScA', v_group_a),
    (v_ads_b, 'AdsB', v_group_b),
    (v_design, 'Design', v_group_a);

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_ceo, 'ceo'),
    (v_gp, 'gestor_projetos'),
    (v_ads_a, 'gestor_ads'),
    (v_sc_a, 'sucesso_cliente'),
    (v_ads_b, 'gestor_ads'),
    (v_design, 'design');

  -- CEO vê todos
  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_team_users_in_scope()) >= 6,
    'CEO sees all users'
  );

  -- gestor_projetos vê todos
  PERFORM set_config('request.jwt.claim.sub', v_gp::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_team_users_in_scope()) >= 6,
    'gestor_projetos sees all users'
  );

  -- gestor_ads (group A) vê apenas ads+sc do mesmo grupo
  PERFORM set_config('request.jwt.claim.sub', v_ads_a::text, true);
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_sc_a),
    'gestor_ads vê sucesso_cliente do mesmo grupo'
  );
  PERFORM ok(
    NOT EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_ads_b),
    'gestor_ads NÃO vê ads_b de outro grupo'
  );
  PERFORM ok(
    NOT EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_design),
    'gestor_ads NÃO vê design do mesmo grupo (role fora do escopo)'
  );

  -- sucesso_cliente vê apenas gestor_ads do mesmo grupo
  PERFORM set_config('request.jwt.claim.sub', v_sc_a::text, true);
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_ads_a),
    'sucesso_cliente vê gestor_ads do mesmo grupo'
  );

  -- design (role sem escopo) vê conjunto vazio
  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_team_users_in_scope()) = 0,
    'design (role fora do escopo) vê 0 users'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2.2: Rodar — esperar falha**

```bash
npm run test:db -- --file supabase/tests/justifications_scope_test.sql
```

Expected: FAIL com `function public.get_team_users_in_scope() does not exist`.

- [ ] **Step 2.3: Criar migration com helpers**

```sql
-- supabase/migrations/20260504100100_justifications_scope_helpers.sql

CREATE OR REPLACE FUNCTION public.get_team_users_in_scope()
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_group_id uuid;
BEGIN
  IF caller_id IS NULL THEN RETURN; END IF;

  SELECT ur.role INTO caller_role
    FROM public.user_roles ur
    WHERE ur.user_id = caller_id
    LIMIT 1;

  SELECT p.group_id INTO caller_group_id
    FROM public.profiles p
    WHERE p.user_id = caller_id
    LIMIT 1;

  IF public.is_ceo(caller_id) OR caller_role = 'gestor_projetos' THEN
    RETURN QUERY SELECT p.user_id FROM public.profiles p;
    RETURN;
  END IF;

  IF caller_role = 'gestor_ads' THEN
    RETURN QUERY
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role IN ('gestor_ads','sucesso_cliente');
    RETURN;
  END IF;

  IF caller_role = 'sucesso_cliente' THEN
    RETURN QUERY
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role = 'gestor_ads';
    RETURN;
  END IF;

  IF caller_role = 'gestor_crm' THEN
    RETURN QUERY
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role IN ('gestor_crm','consultor_comercial');
    RETURN;
  END IF;

  RETURN;
END $$;

REVOKE ALL ON FUNCTION public.get_team_users_in_scope() FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_users_in_scope() TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_user_in_my_scope(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_team_users_in_scope() s
    WHERE s.user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'target user out of caller scope';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.assert_user_in_my_scope(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.assert_user_in_my_scope(uuid) TO authenticated;
```

- [ ] **Step 2.4: Aplicar migration**

```bash
supabase db push
```

Expected: applied OK.

- [ ] **Step 2.5: Rodar test — esperar pass**

```bash
npm run test:db -- --file supabase/tests/justifications_scope_test.sql
```

Expected: 7 testes passam.

- [ ] **Step 2.6: Commit**

```bash
git add supabase/migrations/20260504100100_justifications_scope_helpers.sql supabase/tests/justifications_scope_test.sql
git commit -m "feat(db): get_team_users_in_scope + assert_user_in_my_scope com pgTAP"
```

---

## Task 3: RPC `submit_justification` + pgTAP

**Files:**
- Create: `supabase/migrations/20260504100200_rpc_submit_justification.sql`
- Create: `supabase/tests/justifications_submit_test.sql`

- [ ] **Step 3.1: Escrever pgTAP test**

```sql
-- supabase/tests/justifications_submit_test.sql
BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_notif uuid;
  v_first_id uuid;
  v_second_id uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'Tarefa X', now() - interval '2 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  -- 1. Primeira submissão cria registro
  v_first_id := public.submit_justification(v_notif, 'porque sim');
  PERFORM ok(v_first_id IS NOT NULL, 'submit cria justificativa');

  -- 2. Re-submissão sem revision exigida é idempotente (mesmo id)
  v_second_id := public.submit_justification(v_notif, 'porque sim 2');
  PERFORM is(v_second_id, v_first_id, 're-submit sem revision retorna mesmo id (idempotente)');

  -- 3. Marcar revision -> nova submissão arquiva antiga
  UPDATE public.task_delay_justifications
    SET requires_revision = true, revision_requested_at = now()
    WHERE id = v_first_id;

  v_second_id := public.submit_justification(v_notif, 'agora vai');
  PERFORM isnt(v_second_id, v_first_id, 'apos requires_revision, nova submissão cria novo id');

  PERFORM ok(
    (SELECT archived FROM public.task_delay_justifications WHERE id = v_first_id) = true,
    'versão antiga marcada archived após nova submissão'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3.2: Rodar — esperar falha**

```bash
npm run test:db -- --file supabase/tests/justifications_submit_test.sql
```

Expected: FAIL com `function public.submit_justification(uuid, text) does not exist`.

- [ ] **Step 3.3: Criar migration**

```sql
-- supabase/migrations/20260504100200_rpc_submit_justification.sql

CREATE OR REPLACE FUNCTION public.submit_justification(
  p_notification_id uuid,
  p_text text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_existing_id uuid;
  v_existing_revision boolean;
  v_new_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_notification_id IS NULL OR p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RAISE EXCEPTION 'notification_id and non-empty text required';
  END IF;

  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;

  SELECT id, requires_revision INTO v_existing_id, v_existing_revision
    FROM public.task_delay_justifications
    WHERE notification_id = p_notification_id
      AND user_id = v_caller
      AND archived = false
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_revision = false THEN
    UPDATE public.task_delay_justifications
      SET justification = trim(p_text)
      WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  IF v_existing_id IS NOT NULL AND v_existing_revision = true THEN
    UPDATE public.task_delay_justifications
      SET archived = true,
          archived_at = now(),
          archived_by = v_caller
      WHERE id = v_existing_id;
  END IF;

  INSERT INTO public.task_delay_justifications (
    notification_id, user_id, user_role, justification, requires_revision
  ) VALUES (
    p_notification_id, v_caller, COALESCE(v_caller_role, 'unknown'), trim(p_text), false
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.submit_justification(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_justification(uuid, text) TO authenticated;
```

- [ ] **Step 3.4: Aplicar + rodar test**

```bash
supabase db push && npm run test:db -- --file supabase/tests/justifications_submit_test.sql
```

Expected: 4 testes passam.

- [ ] **Step 3.5: Commit**

```bash
git add supabase/migrations/20260504100200_rpc_submit_justification.sql supabase/tests/justifications_submit_test.sql
git commit -m "feat(db): RPC submit_justification idempotente com handle de requires_revision"
```

---

## Task 4: RPC `get_justifications_pending_mine` + pgTAP

**Files:**
- Create: `supabase/migrations/20260504100300_rpc_get_pending_mine.sql`
- Create: `supabase/tests/justifications_pending_mine_test.sql`

- [ ] **Step 4.1: pgTAP test**

```sql
-- supabase/tests/justifications_pending_mine_test.sql
BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_notif_a uuid; v_notif_b uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'A', now() - interval '2 day'
  ) RETURNING id INTO v_notif_a;

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'B', now() - interval '1 day'
  ) RETURNING id INTO v_notif_b;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  -- 1. Sem justificativas: 2 pendentes
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_pending_mine()),
    2::bigint,
    '2 pendentes quando nenhuma foi justificada'
  );

  -- 2. Justifica uma: 1 pendente
  PERFORM public.submit_justification(v_notif_a, 'ok');
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_pending_mine()),
    1::bigint,
    '1 pendente após justificar uma'
  );

  -- 3. Marca como requires_revision: volta pra pendente
  UPDATE public.task_delay_justifications
    SET requires_revision = true
    WHERE notification_id = v_notif_a;
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_pending_mine()),
    2::bigint,
    'requires_revision faz item voltar pra pendentes'
  );

  -- 4. Item retornado contém master_comment quando requires_revision
  UPDATE public.task_delay_justifications
    SET master_comment = 'refaça'
    WHERE notification_id = v_notif_a;
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.get_justifications_pending_mine() WHERE master_comment = 'refaça'),
    'pending inclui master_comment quando requires_revision'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 4.2: Rodar — esperar falha**

```bash
npm run test:db -- --file supabase/tests/justifications_pending_mine_test.sql
```

Expected: FAIL — function não existe.

- [ ] **Step 4.3: Criar migration**

```sql
-- supabase/migrations/20260504100300_rpc_get_pending_mine.sql

CREATE OR REPLACE FUNCTION public.get_justifications_pending_mine()
RETURNS TABLE(
  notification_id uuid,
  task_id uuid,
  task_table text,
  task_title text,
  task_due_date timestamptz,
  task_owner_id uuid,
  task_owner_name text,
  task_owner_role text,
  master_comment text,
  requires_revision boolean,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller IS NULL THEN RETURN; END IF;

  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;

  RETURN QUERY
  WITH valid_notifs AS (
    SELECT n.*
    FROM public.task_delay_notifications n
    WHERE
      n.task_owner_id = v_caller
      OR (
        n.task_owner_role = 'gestor_ads'
        AND v_caller_role IN ('sucesso_cliente','gestor_projetos','ceo','cto')
      )
      OR (
        n.task_owner_role <> 'gestor_ads'
        AND v_caller_role IN ('gestor_projetos','ceo','cto')
      )
  ),
  my_done AS (
    SELECT j.notification_id, j.requires_revision, j.master_comment
    FROM public.task_delay_justifications j
    WHERE j.user_id = v_caller AND j.archived = false
  )
  SELECT
    n.id AS notification_id,
    n.task_id,
    n.task_table,
    n.task_title,
    n.task_due_date,
    n.task_owner_id,
    n.task_owner_name,
    n.task_owner_role,
    md.master_comment,
    COALESCE(md.requires_revision, false) AS requires_revision,
    n.created_at
  FROM valid_notifs n
  LEFT JOIN my_done md ON md.notification_id = n.id
  WHERE md.notification_id IS NULL OR md.requires_revision = true
  ORDER BY n.task_due_date ASC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_pending_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.get_justifications_pending_mine() TO authenticated;
```

- [ ] **Step 4.4: Aplicar + rodar test**

```bash
supabase db push && npm run test:db -- --file supabase/tests/justifications_pending_mine_test.sql
```

Expected: 4 passam.

- [ ] **Step 4.5: Commit**

```bash
git add supabase/migrations/20260504100300_rpc_get_pending_mine.sql supabase/tests/justifications_pending_mine_test.sql
git commit -m "feat(db): RPC get_justifications_pending_mine"
```

---

## Task 5: RPC `get_justifications_done_mine` + pgTAP

**Files:**
- Create: `supabase/migrations/20260504100400_rpc_get_done_mine.sql`
- Create: `supabase/tests/justifications_done_mine_test.sql`

- [ ] **Step 5.1: pgTAP test**

```sql
-- supabase/tests/justifications_done_mine_test.sql
BEGIN;
SELECT plan(2);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_notif uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_user, 'U', 'design',
    'X', now() - interval '1 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM public.submit_justification(v_notif, 'ok');

  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_done_mine()),
    1::bigint,
    'justificada aparece em done_mine'
  );

  -- requires_revision: NÃO aparece em done
  UPDATE public.task_delay_justifications SET requires_revision = true;
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_done_mine()),
    0::bigint,
    'requires_revision oculta de done_mine'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 5.2: Rodar — falha**

```bash
npm run test:db -- --file supabase/tests/justifications_done_mine_test.sql
```

- [ ] **Step 5.3: Criar migration**

```sql
-- supabase/migrations/20260504100400_rpc_get_done_mine.sql

CREATE OR REPLACE FUNCTION public.get_justifications_done_mine()
RETURNS TABLE(
  justification_id uuid,
  notification_id uuid,
  task_id uuid,
  task_table text,
  task_title text,
  task_due_date timestamptz,
  justification text,
  master_comment text,
  master_comment_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    j.id AS justification_id,
    j.notification_id,
    n.task_id,
    n.task_table,
    n.task_title,
    n.task_due_date,
    j.justification,
    j.master_comment,
    j.master_comment_at,
    j.created_at
  FROM public.task_delay_justifications j
  JOIN public.task_delay_notifications n ON n.id = j.notification_id
  WHERE j.user_id = v_caller
    AND j.archived = false
    AND j.requires_revision = false
  ORDER BY j.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_done_mine() FROM public;
GRANT EXECUTE ON FUNCTION public.get_justifications_done_mine() TO authenticated;
```

- [ ] **Step 5.4: Aplicar + rodar test**

```bash
supabase db push && npm run test:db -- --file supabase/tests/justifications_done_mine_test.sql
```

Expected: 2 passam.

- [ ] **Step 5.5: Commit**

```bash
git add supabase/migrations/20260504100400_rpc_get_done_mine.sql supabase/tests/justifications_done_mine_test.sql
git commit -m "feat(db): RPC get_justifications_done_mine"
```

---

## Task 6: RPC `get_justifications_team_grouped` + pgTAP

**Files:**
- Create: `supabase/migrations/20260504100500_rpc_get_team_grouped.sql`
- Create: `supabase/tests/justifications_team_grouped_test.sql`

- [ ] **Step 6.1: pgTAP test**

```sql
-- supabase/tests/justifications_team_grouped_test.sql
BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_ceo uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
  v_n1 uuid; v_n2 uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_ceo, 'ceo@x.com'), (v_design, 'd@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_ceo, 'CEO'), (v_design, 'D');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_ceo, 'ceo'), (v_design, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_design, 'D', 'design',
    'A', now() - interval '2 day'
  ), (
    gen_random_uuid(), 'department_tasks', v_design, 'D', 'design',
    'B', now() - interval '1 day'
  )
  RETURNING id INTO v_n1;

  -- CEO chama
  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false)) >= 2,
    'CEO vê itens da equipe'
  );

  -- design (sem escopo) vê 0
  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  PERFORM is(
    (SELECT count(*) FROM public.get_justifications_team_grouped(false)),
    0::bigint,
    'role sem escopo vê conjunto vazio'
  );

  -- only_pending=true filtra justificadas
  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  -- design justifica uma das suas
  SELECT id INTO v_n2 FROM public.task_delay_notifications WHERE task_owner_id = v_design LIMIT 1;
  PERFORM public.submit_justification(v_n2, 'ok');

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM ok(
    (SELECT count(*) FROM public.get_justifications_team_grouped(true))
      < (SELECT count(*) FROM public.get_justifications_team_grouped(false)),
    'only_pending=true filtra menos itens que false'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 6.2: Rodar — falha**

```bash
npm run test:db -- --file supabase/tests/justifications_team_grouped_test.sql
```

- [ ] **Step 6.3: Criar migration**

```sql
-- supabase/migrations/20260504100500_rpc_get_team_grouped.sql

CREATE OR REPLACE FUNCTION public.get_justifications_team_grouped(
  p_only_pending boolean DEFAULT false
)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  user_role text,
  notification_id uuid,
  task_id uuid,
  task_table text,
  task_title text,
  task_due_date timestamptz,
  justification_id uuid,
  justification_text text,
  master_comment text,
  requires_revision boolean,
  archived boolean,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH scope AS (
    SELECT s.user_id FROM public.get_team_users_in_scope() s
  ),
  valid_notifs AS (
    SELECT n.*
    FROM public.task_delay_notifications n
    JOIN scope ON scope.user_id = n.task_owner_id
  )
  SELECT
    n.task_owner_id AS user_id,
    n.task_owner_name AS user_name,
    n.task_owner_role AS user_role,
    n.id AS notification_id,
    n.task_id,
    n.task_table,
    n.task_title,
    n.task_due_date,
    j.id AS justification_id,
    j.justification AS justification_text,
    j.master_comment,
    COALESCE(j.requires_revision, false) AS requires_revision,
    COALESCE(j.archived, false) AS archived,
    n.created_at
  FROM valid_notifs n
  LEFT JOIN public.task_delay_justifications j
    ON j.notification_id = n.id
   AND j.user_id = n.task_owner_id
   AND j.archived = false
  WHERE
    NOT p_only_pending
    OR j.id IS NULL
    OR j.requires_revision = true
  ORDER BY n.task_owner_name, n.task_due_date ASC;
END $$;

REVOKE ALL ON FUNCTION public.get_justifications_team_grouped(boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_justifications_team_grouped(boolean) TO authenticated;
```

- [ ] **Step 6.4: Aplicar + rodar test**

```bash
supabase db push && npm run test:db -- --file supabase/tests/justifications_team_grouped_test.sql
```

Expected: 3 passam.

- [ ] **Step 6.5: Commit**

```bash
git add supabase/migrations/20260504100500_rpc_get_team_grouped.sql supabase/tests/justifications_team_grouped_test.sql
git commit -m "feat(db): RPC get_justifications_team_grouped com filtro only_pending"
```

---

## Task 7: RPCs `request_justification_revision` + `nudge_user_for_justification` + `archive_justification`/`unarchive` + pgTAP

**Files:**
- Create: `supabase/migrations/20260504100600_rpc_master_actions.sql`
- Create: `supabase/tests/justifications_master_actions_test.sql`

- [ ] **Step 7.1: pgTAP test**

```sql
-- supabase/tests/justifications_master_actions_test.sql
BEGIN;
SELECT plan(7);

DO $$
DECLARE
  v_ceo uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_notif uuid;
  v_just uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_ceo, 'ceo@x.com'), (v_design, 'd@x.com'), (v_outsider, 'o@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES
    (v_ceo, 'CEO'), (v_design, 'D'), (v_outsider, 'O');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_ceo, 'ceo'), (v_design, 'design'), (v_outsider, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_design, 'D', 'design',
    'X', now() - interval '1 day'
  ) RETURNING id INTO v_notif;

  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  v_just := public.submit_justification(v_notif, 'minha justif');

  -- 1. CEO marca revision com sucesso
  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM public.request_justification_revision(v_just, 'refaça');
  PERFORM ok(
    (SELECT requires_revision FROM public.task_delay_justifications WHERE id = v_just) = true,
    'request_revision seta requires_revision=true'
  );
  PERFORM is(
    (SELECT master_comment FROM public.task_delay_justifications WHERE id = v_just),
    'refaça',
    'request_revision grava master_comment'
  );

  -- 2. CEO chama de novo: comentário sobrescreve
  PERFORM public.request_justification_revision(v_just, 'refaça melhor');
  PERFORM is(
    (SELECT master_comment FROM public.task_delay_justifications WHERE id = v_just),
    'refaça melhor',
    'comentário é sobrescrito (não acumula)'
  );

  -- 3. Outsider (role design, sem escopo) tenta marcar revision: deve falhar
  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM throws_ok(
    $sub$ SELECT public.request_justification_revision($sub$ || quote_literal(v_just::text) || $sub$::uuid, 'oi') $sub$,
    'target user out of caller scope',
    'role sem escopo é bloqueado'
  );

  -- 4. CEO faz nudge com sucesso
  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM public.nudge_user_for_justification(v_notif);
  PERFORM ok(
    EXISTS (SELECT 1 FROM public.system_notifications
            WHERE recipient_id = v_design
              AND notification_type = 'justification_nudge'),
    'nudge insere system_notification para o devedor'
  );

  -- 5. Nudge dentro de 1h é deduplicado (não cria segundo registro)
  PERFORM public.nudge_user_for_justification(v_notif);
  PERFORM is(
    (SELECT count(*) FROM public.system_notifications
     WHERE recipient_id = v_design
       AND notification_type = 'justification_nudge'),
    1::bigint,
    'nudge dedupe em 1h'
  );

  -- 6. archive_justification arquiva
  PERFORM public.archive_justification(v_just);
  PERFORM ok(
    (SELECT archived FROM public.task_delay_justifications WHERE id = v_just) = true,
    'archive_justification arquiva'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 7.2: Rodar — falha**

```bash
npm run test:db -- --file supabase/tests/justifications_master_actions_test.sql
```

- [ ] **Step 7.3: Criar migration**

```sql
-- supabase/migrations/20260504100600_rpc_master_actions.sql

CREATE OR REPLACE FUNCTION public.request_justification_revision(
  p_justification_id uuid,
  p_comment text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
  v_notification_id uuid;
  v_task_title text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_justification_id IS NULL OR p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
    RAISE EXCEPTION 'justification_id and non-empty comment required';
  END IF;

  SELECT j.user_id, j.notification_id INTO v_target, v_notification_id
    FROM public.task_delay_justifications j
    WHERE j.id = p_justification_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'justification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  UPDATE public.task_delay_justifications
    SET master_comment = trim(p_comment),
        master_comment_by = v_caller,
        master_comment_at = now(),
        requires_revision = true,
        revision_requested_by = v_caller,
        revision_requested_at = now()
    WHERE id = p_justification_id;

  SELECT task_title INTO v_task_title
    FROM public.task_delay_notifications WHERE id = v_notification_id;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type, title, message, priority
  )
  SELECT
    v_target,
    (SELECT role FROM public.user_roles WHERE user_id = v_target LIMIT 1),
    'justification_revision_required',
    'Refaça sua justificativa',
    format('Justificativa para "%s" precisa ser refeita: %s', COALESCE(v_task_title,'tarefa'), trim(p_comment)),
    'high';
END $$;

REVOKE ALL ON FUNCTION public.request_justification_revision(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_justification_revision(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.nudge_user_for_justification(
  p_notification_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
  v_task_title text;
  v_recent_count int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_notification_id IS NULL THEN RAISE EXCEPTION 'notification_id required'; END IF;

  SELECT n.task_owner_id, n.task_title INTO v_target, v_task_title
    FROM public.task_delay_notifications n WHERE n.id = p_notification_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'notification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  -- Dedupe: já existe nudge para essa task em 1h?
  SELECT count(*) INTO v_recent_count
    FROM public.system_notifications
    WHERE recipient_id = v_target
      AND notification_type = 'justification_nudge'
      AND message LIKE '%' || COALESCE(v_task_title, '') || '%'
      AND created_at >= now() - interval '1 hour';

  IF v_recent_count > 0 THEN RETURN; END IF;

  INSERT INTO public.system_notifications (
    recipient_id, recipient_role, notification_type, title, message, priority
  )
  SELECT
    v_target,
    (SELECT role FROM public.user_roles WHERE user_id = v_target LIMIT 1),
    'justification_nudge',
    'Você tem justificativa pendente',
    format('Tarefa atrasada sem justificativa: %s', COALESCE(v_task_title, 'tarefa')),
    'high';
END $$;

REVOKE ALL ON FUNCTION public.nudge_user_for_justification(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.nudge_user_for_justification(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.archive_justification(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT user_id INTO v_target FROM public.task_delay_justifications WHERE id = p_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'justification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  UPDATE public.task_delay_justifications
    SET archived = true, archived_at = now(), archived_by = auth.uid()
    WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.archive_justification(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.archive_justification(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.unarchive_justification(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT user_id INTO v_target FROM public.task_delay_justifications WHERE id = p_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'justification not found'; END IF;

  PERFORM public.assert_user_in_my_scope(v_target);

  UPDATE public.task_delay_justifications
    SET archived = false, archived_at = NULL, archived_by = NULL
    WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.unarchive_justification(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unarchive_justification(uuid) TO authenticated;
```

- [ ] **Step 7.4: Aplicar + rodar test**

```bash
supabase db push && npm run test:db -- --file supabase/tests/justifications_master_actions_test.sql
```

Expected: 7 passam.

- [ ] **Step 7.5: Commit**

```bash
git add supabase/migrations/20260504100600_rpc_master_actions.sql supabase/tests/justifications_master_actions_test.sql
git commit -m "feat(db): RPCs master — request_revision, nudge (1h dedupe), archive/unarchive"
```

---

## Task 8: Tighten RLS em `task_delay_justifications`

**Files:**
- Create: `supabase/migrations/20260504100700_tighten_rls_task_delay_justifications.sql`
- Create: `supabase/tests/justifications_rls_test.sql`

- [ ] **Step 8.1: pgTAP test**

```sql
-- supabase/tests/justifications_rls_test.sql
BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_notif uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'u@x.com'), (v_other, 'o@x.com');
  INSERT INTO public.profiles (user_id, name) VALUES (v_user, 'U'), (v_other, 'O');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'design'), (v_other, 'design');

  INSERT INTO public.task_delay_notifications (
    task_id, task_table, task_owner_id, task_owner_name, task_owner_role,
    task_title, task_due_date
  ) VALUES (
    gen_random_uuid(), 'department_tasks', v_other, 'O', 'design',
    'X', now() - interval '1 day'
  ) RETURNING id INTO v_notif;

  -- v_other justifica via RPC
  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM public.submit_justification(v_notif, 'mine');

  -- v_user (outro usuário, role sem escopo) NÃO vê justificativa de v_other
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM is(
    (SELECT count(*) FROM public.task_delay_justifications WHERE user_id = v_other),
    0::bigint,
    'RLS oculta justificativas de outros'
  );

  -- INSERT direto bloqueado
  PERFORM throws_ok(
    $sub$ INSERT INTO public.task_delay_justifications (notification_id, user_id, user_role, justification)
          VALUES ($sub$ || quote_literal(v_notif::text) || $sub$::uuid,
                  $sub$ || quote_literal(v_user::text) || $sub$::uuid, 'design', 'hack') $sub$,
    NULL,
    'INSERT direto bloqueado'
  );

  -- UPDATE direto bloqueado
  PERFORM throws_ok(
    $sub$ UPDATE public.task_delay_justifications SET justification = 'hack' WHERE user_id = $sub$
      || quote_literal(v_other::text) || $sub$::uuid $sub$,
    NULL,
    'UPDATE direto bloqueado'
  );
END $$;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 8.2: Rodar — esperar falha (provavelmente passa parcialmente porque RLS atual já existe)**

```bash
npm run test:db -- --file supabase/tests/justifications_rls_test.sql
```

- [ ] **Step 8.3: Migration**

```sql
-- supabase/migrations/20260504100700_tighten_rls_task_delay_justifications.sql
-- Apertar RLS: SELECT só próprias linhas; INSERT/UPDATE/DELETE bloqueado.
-- Master vê e age via RPCs SECURITY DEFINER (não passam por RLS).

ALTER TABLE public.task_delay_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own justifications" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "CEO can view all justifications" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "Users can insert their own justifications" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "Users can update their own justifications" ON public.task_delay_justifications;
DROP POLICY IF EXISTS "CEO can update justifications" ON public.task_delay_justifications;

CREATE POLICY "tdj_select_own"
  ON public.task_delay_justifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Sem INSERT/UPDATE/DELETE policies = bloqueado.
-- Toda escrita via RPCs SECURITY DEFINER.
```

- [ ] **Step 8.4: Aplicar + rodar test**

```bash
supabase db push && npm run test:db -- --file supabase/tests/justifications_rls_test.sql
```

Expected: 3 passam.

- [ ] **Step 8.5: Verificar regressão de outras features**

```bash
npm run test:db
```

Expected: TODOS os testes pgTAP passam (rodar suíte inteira pra garantir que tighten não quebrou outras).

- [ ] **Step 8.6: Commit**

```bash
git add supabase/migrations/20260504100700_tighten_rls_task_delay_justifications.sql supabase/tests/justifications_rls_test.sql
git commit -m "feat(db): RLS apertada em task_delay_justifications — tudo via RPC"
```

---

## Task 9: Regenerar types do Supabase

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 9.1: Regenerar**

```bash
npm run supabase:gen-types
```

- [ ] **Step 9.2: Verificar typecheck**

```bash
npm run typecheck
```

Expected: passa sem erro.

- [ ] **Step 9.3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): regen supabase types após RPCs de justificativas"
```

---

## Task 10: Hook `useJustificativas` + vitest

**Files:**
- Create: `src/hooks/useJustificativas.ts`
- Create: `src/hooks/useJustificativas.test.ts`

- [ ] **Step 10.1: Test (vitest)**

```ts
// src/hooks/useJustificativas.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useJustificativasCount,
  useJustificativasPendentes,
  useJustificativasDoneMine,
  useJustificativasTeam,
  useSubmitJustificativa,
} from './useJustificativas';

vi.mock('@/integrations/supabase/client', () => {
  const rpc = vi.fn();
  return { supabase: { rpc } };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'design' } }),
}));

import { supabase } from '@/integrations/supabase/client';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useJustificativas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useJustificativasCount retorna comprimento da lista pendente', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [{ notification_id: 'n1' }, { notification_id: 'n2' }], error: null });
    const { result } = renderHook(() => useJustificativasCount(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(supabase.rpc).toHaveBeenCalledWith('get_justifications_pending_mine');
  });

  it('useJustificativasPendentes retorna lista', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [{ notification_id: 'n1' }], error: null });
    const { result } = renderHook(() => useJustificativasPendentes(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('useJustificativasDoneMine chama RPC done', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useJustificativasDoneMine(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabase.rpc).toHaveBeenCalledWith('get_justifications_done_mine');
  });

  it('useJustificativasTeam passa only_pending', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useJustificativasTeam(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabase.rpc).toHaveBeenCalledWith('get_justifications_team_grouped', { p_only_pending: true });
  });

  it('useSubmitJustificativa invalida 3 queries', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: 'new-id', error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: React.ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSubmitJustificativa(), { wrapper: localWrapper });
    await result.current.mutateAsync({ notificationId: 'n1', text: 'ok' });
    const keys = spy.mock.calls.map(c => (c[0] as any)?.queryKey?.[0]);
    expect(keys).toContain('justif-pending-mine');
    expect(keys).toContain('justif-done-mine');
    expect(keys).toContain('justif-team');
  });
});
```

- [ ] **Step 10.2: Rodar test — falha**

```bash
npm test -- src/hooks/useJustificativas.test.ts
```

Expected: FAIL — module não existe.

- [ ] **Step 10.3: Implementar hook**

```ts
// src/hooks/useJustificativas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PendenteItem {
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  task_owner_id: string;
  task_owner_name: string;
  task_owner_role: string;
  master_comment: string | null;
  requires_revision: boolean;
  created_at: string;
}

export interface DoneItem {
  justification_id: string;
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  justification: string;
  master_comment: string | null;
  master_comment_at: string | null;
  created_at: string;
}

export interface TeamItem {
  user_id: string;
  user_name: string;
  user_role: string;
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  justification_id: string | null;
  justification_text: string | null;
  master_comment: string | null;
  requires_revision: boolean;
  archived: boolean;
  created_at: string;
}

const COMMON_QUERY_OPTS = {
  refetchOnWindowFocus: true,
  refetchInterval: 30_000,
  staleTime: 15_000,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['justif-pending-mine'] });
  qc.invalidateQueries({ queryKey: ['justif-done-mine'] });
  qc.invalidateQueries({ queryKey: ['justif-team'] });
}

export function useJustificativasPendentes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-pending-mine', user?.id],
    queryFn: async (): Promise<PendenteItem[]> => {
      const { data, error } = await supabase.rpc('get_justifications_pending_mine');
      if (error) throw error;
      return (data ?? []) as PendenteItem[];
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useJustificativasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-pending-mine', user?.id, 'count'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_justifications_pending_mine');
      if (error) throw error;
      return (data ?? []).length;
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useJustificativasDoneMine() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-done-mine', user?.id],
    queryFn: async (): Promise<DoneItem[]> => {
      const { data, error } = await supabase.rpc('get_justifications_done_mine');
      if (error) throw error;
      return (data ?? []) as DoneItem[];
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useJustificativasTeam(onlyPending = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-team', user?.id, onlyPending],
    queryFn: async (): Promise<TeamItem[]> => {
      const { data, error } = await supabase.rpc('get_justifications_team_grouped', {
        p_only_pending: onlyPending,
      });
      if (error) throw error;
      return (data ?? []) as TeamItem[];
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useSubmitJustificativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ notificationId, text }: { notificationId: string; text: string }) => {
      const { data, error } = await supabase.rpc('submit_justification', {
        p_notification_id: notificationId,
        p_text: text,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Justificativa enviada');
    },
    onError: (e: any) => toast.error('Erro ao enviar', { description: e.message }),
  });
}

export function useRequestRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ justificationId, comment }: { justificationId: string; comment: string }) => {
      const { error } = await supabase.rpc('request_justification_revision', {
        p_justification_id: justificationId,
        p_comment: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(qc); toast.success('Revisão solicitada'); },
    onError: (e: any) => toast.error('Erro', { description: e.message }),
  });
}

export function useNudgeUser() {
  return useMutation({
    mutationFn: async ({ notificationId }: { notificationId: string }) => {
      const { error } = await supabase.rpc('nudge_user_for_justification', {
        p_notification_id: notificationId,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Cobrança enviada'),
    onError: (e: any) => toast.error('Erro ao cobrar', { description: e.message }),
  });
}

export function useArchiveJustification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase.rpc(archive ? 'archive_justification' : 'unarchive_justification', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
    onError: (e: any) => toast.error('Erro', { description: e.message }),
  });
}
```

- [ ] **Step 10.4: Rodar test — pass**

```bash
npm test -- src/hooks/useJustificativas.test.ts
```

Expected: 5 testes passam.

- [ ] **Step 10.5: Commit**

```bash
git add src/hooks/useJustificativas.ts src/hooks/useJustificativas.test.ts
git commit -m "feat(hooks): useJustificativas (5 queries + 4 mutations)"
```

---

## Task 11: Componente `SidebarBadge` + vitest + integrar em `AppSidebar`

**Files:**
- Create: `src/components/justificativas/SidebarBadge.tsx`
- Create: `src/components/justificativas/SidebarBadge.test.tsx`
- Modify: `src/components/layout/AppSidebar.tsx` (adicionar render no rodapé)

- [ ] **Step 11.1: Test**

```tsx
// src/components/justificativas/SidebarBadge.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SidebarBadge from './SidebarBadge';

vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasCount: vi.fn(),
}));

import { useJustificativasCount } from '@/hooks/useJustificativas';

describe('SidebarBadge', () => {
  it('oculta quando count = 0', () => {
    (useJustificativasCount as any).mockReturnValue({ data: 0, isLoading: false });
    const { container } = render(<MemoryRouter><SidebarBadge /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('mostra quando count > 0', () => {
    (useJustificativasCount as any).mockReturnValue({ data: 3, isLoading: false });
    render(<MemoryRouter><SidebarBadge /></MemoryRouter>);
    expect(screen.getByText('Justificativas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('aponta para /justificativas', () => {
    (useJustificativasCount as any).mockReturnValue({ data: 1, isLoading: false });
    render(<MemoryRouter><SidebarBadge /></MemoryRouter>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/justificativas');
  });
});
```

- [ ] **Step 11.2: Rodar — falha**

```bash
npm test -- src/components/justificativas/SidebarBadge.test.tsx
```

- [ ] **Step 11.3: Implementar**

```tsx
// src/components/justificativas/SidebarBadge.tsx
import { NavLink } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJustificativasCount } from '@/hooks/useJustificativas';

export default function SidebarBadge() {
  const { data: count = 0 } = useJustificativasCount();

  if (!count || count <= 0) return null;

  return (
    <NavLink
      to="/justificativas"
      className={({ isActive }) =>
        cn(
          'sidebar-item mt-auto sticky bottom-0 bg-sidebar/95 backdrop-blur',
          'flex items-center justify-between gap-2 border-l-2 border-danger',
          isActive && 'active'
        )
      }
    >
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-danger" />
        <span className="truncate">Justificativas</span>
      </span>
      <span
        aria-label={`${count} pendentes`}
        className="bg-danger text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center"
      >
        {count}
      </span>
    </NavLink>
  );
}
```

- [ ] **Step 11.4: Adicionar em `AppSidebar.tsx`**

Localizar o JSX root do componente `AppSidebar` (procurar `<aside ` ou `<nav ` raiz) e adicionar `<SidebarBadge />` como **último filho** de forma que herde o layout `flex flex-col` permitindo `mt-auto` empurrar pra baixo.

```tsx
// no topo:
import SidebarBadge from '@/components/justificativas/SidebarBadge';

// no return — antes do fechamento da raiz sticky/scroll do sidebar:
<SidebarBadge />
```

> Se o root do AppSidebar não for flex-col, envolver o conteúdo existente em wrapper `<div className="flex flex-col h-full">` e mover `<SidebarBadge />` pra posição final. Verificar visualmente que o badge fica no rodapé e não interfere no scroll das seções.

- [ ] **Step 11.5: Rodar tests + dev server smoke**

```bash
npm test -- src/components/justificativas/SidebarBadge.test.tsx
npm run dev
```

Expected vitest: 3 passam. Manual: badge aparece no rodapé da sidebar quando há pendência (mockar via DB ou apontar pra um user com pendência).

- [ ] **Step 11.6: Commit**

```bash
git add src/components/justificativas/SidebarBadge.tsx src/components/justificativas/SidebarBadge.test.tsx src/components/layout/AppSidebar.tsx
git commit -m "feat(sidebar): SidebarBadge bottom-fixed com contador de justificativas"
```

---

## Task 12: Componentes `JustificativaItem` + `JustificarForm` + tests

**Files:**
- Create: `src/components/justificativas/JustificativaItem.tsx`
- Create: `src/components/justificativas/JustificativaItem.test.tsx`
- Create: `src/components/justificativas/JustificarForm.tsx`
- Create: `src/components/justificativas/JustificarForm.test.tsx`

- [ ] **Step 12.1: Test JustificarForm**

```tsx
// src/components/justificativas/JustificarForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JustificarForm from './JustificarForm';

const submitMock = vi.fn();
vi.mock('@/hooks/useJustificativas', () => ({
  useSubmitJustificativa: () => ({ mutateAsync: submitMock, isPending: false }),
}));

describe('JustificarForm', () => {
  it('envia texto trimmed via mutation', async () => {
    submitMock.mockResolvedValue('id-1');
    render(<JustificarForm notificationId="n1" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  meu motivo  ' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(submitMock).toHaveBeenCalledWith({ notificationId: 'n1', text: '  meu motivo  ' });
  });

  it('botão desabilitado com texto vazio', () => {
    render(<JustificarForm notificationId="n1" />);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });
});
```

- [ ] **Step 12.2: Test JustificativaItem**

```tsx
// src/components/justificativas/JustificativaItem.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import JustificativaItem from './JustificativaItem';

describe('JustificativaItem', () => {
  const baseProps = {
    title: 'Tarefa X',
    dueDate: '2026-05-01T00:00:00Z',
    state: 'pending' as const,
  };

  it('renderiza pendente com título e prazo', () => {
    render(<JustificativaItem {...baseProps} />);
    expect(screen.getByText('Tarefa X')).toBeInTheDocument();
  });

  it('renderiza banner de revisão quando state=revision', () => {
    render(<JustificativaItem {...baseProps} state="revision" masterComment="refaça" />);
    expect(screen.getByText(/refaça/i)).toBeInTheDocument();
  });

  it('renderiza texto de justificativa quando state=done', () => {
    render(<JustificativaItem {...baseProps} state="done" justificationText="motivo claro" />);
    expect(screen.getByText('motivo claro')).toBeInTheDocument();
  });
});
```

- [ ] **Step 12.3: Rodar tests — falham**

```bash
npm test -- src/components/justificativas
```

- [ ] **Step 12.4: Implementar JustificarForm**

```tsx
// src/components/justificativas/JustificarForm.tsx
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSubmitJustificativa } from '@/hooks/useJustificativas';

interface Props {
  notificationId: string;
  onSubmitted?: () => void;
}

export default function JustificarForm({ notificationId, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const { mutateAsync, isPending } = useSubmitJustificativa();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await mutateAsync({ notificationId, text });
    setText('');
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Explique o motivo do atraso..."
        className="min-h-[96px] resize-none"
        maxLength={500}
        autoFocus
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{text.length}/500</span>
        <Button type="submit" disabled={!text.trim() || isPending} className="bg-danger hover:bg-danger/90 text-white">
          {isPending ? 'Enviando...' : 'Enviar Justificativa'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 12.5: Implementar JustificativaItem**

```tsx
// src/components/justificativas/JustificativaItem.tsx
import { ReactNode } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type State = 'pending' | 'revision' | 'done' | 'archived';

interface Props {
  title: string;
  dueDate: string;
  state: State;
  daysOverdue?: number;
  justificationText?: string;
  masterComment?: string | null;
  ownerName?: string;
  children?: ReactNode;
}

const stateClass: Record<State, string> = {
  pending: 'border-danger/50',
  revision: 'border-warning',
  done: 'border-border',
  archived: 'border-border opacity-50',
};

export default function JustificativaItem({
  title, dueDate, state, justificationText, masterComment, ownerName, children,
}: Props) {
  const due = new Date(dueDate);
  const overdue = formatDistanceToNowStrict(due, { locale: ptBR });

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', stateClass[state])}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-danger/15 flex items-center justify-center flex-shrink-0">
          <Clock size={16} className="text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground">
            Prazo: {format(due, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })} · {overdue} de atraso
          </p>
          {ownerName && (
            <p className="text-xs text-muted-foreground">Responsável: <span className="text-foreground">{ownerName}</span></p>
          )}
        </div>
      </div>

      {state === 'revision' && masterComment && (
        <div className="flex items-start gap-2 p-2 rounded border border-warning/40 bg-warning/10 text-sm">
          <AlertTriangle size={14} className="text-warning mt-0.5" />
          <p className="text-foreground"><span className="font-medium">Refaça:</span> {masterComment}</p>
        </div>
      )}

      {state === 'done' && justificationText && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{justificationText}</p>
      )}

      {children}
    </div>
  );
}
```

- [ ] **Step 12.6: Rodar tests — passam**

```bash
npm test -- src/components/justificativas
```

Expected: 5 passam.

- [ ] **Step 12.7: Commit**

```bash
git add src/components/justificativas/JustificativaItem.tsx src/components/justificativas/JustificativaItem.test.tsx src/components/justificativas/JustificarForm.tsx src/components/justificativas/JustificarForm.test.tsx
git commit -m "feat(ui): JustificativaItem + JustificarForm"
```

---

## Task 13: `PendentesTab` + `JustificadasTab`

**Files:**
- Create: `src/components/justificativas/PendentesTab.tsx`
- Create: `src/components/justificativas/JustificadasTab.tsx`

(Tests integrados via Page test no Task 16. Tabs são thin wrappers — testar comportamento nelas isoladamente daria pouco sinal.)

- [ ] **Step 13.1: Implementar PendentesTab**

```tsx
// src/components/justificativas/PendentesTab.tsx
import { useState } from 'react';
import { useJustificativasPendentes } from '@/hooks/useJustificativas';
import JustificativaItem from './JustificativaItem';
import JustificarForm from './JustificarForm';
import { Loader2 } from 'lucide-react';

export default function PendentesTab() {
  const { data, isLoading } = useJustificativasPendentes();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Sem pendências por enquanto.</p>
        <p className="text-sm">Continue assim.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.notification_id}>
          <JustificativaItem
            title={item.task_title}
            dueDate={item.task_due_date}
            state={item.requires_revision ? 'revision' : 'pending'}
            masterComment={item.master_comment}
          >
            {openId === item.notification_id ? (
              <JustificarForm
                notificationId={item.notification_id}
                onSubmitted={() => setOpenId(null)}
              />
            ) : (
              <button
                onClick={() => setOpenId(item.notification_id)}
                className="text-sm text-danger hover:underline"
              >
                Justificar
              </button>
            )}
          </JustificativaItem>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 13.2: Implementar JustificadasTab**

```tsx
// src/components/justificativas/JustificadasTab.tsx
import { useJustificativasDoneMine } from '@/hooks/useJustificativas';
import JustificativaItem from './JustificativaItem';
import { Loader2 } from 'lucide-react';

export default function JustificadasTab() {
  const { data, isLoading } = useJustificativasDoneMine();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  if (!data || data.length === 0) {
    return <p className="text-center py-16 text-muted-foreground">Você ainda não justificou nada.</p>;
  }

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.justification_id}>
          <JustificativaItem
            title={item.task_title}
            dueDate={item.task_due_date}
            state="done"
            justificationText={item.justification}
          />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 13.3: Smoke**

```bash
npm run typecheck
```

Expected: passa.

- [ ] **Step 13.4: Commit**

```bash
git add src/components/justificativas/PendentesTab.tsx src/components/justificativas/JustificadasTab.tsx
git commit -m "feat(ui): PendentesTab e JustificadasTab"
```

---

## Task 14: `ComentarioMaster` + `CobrarButton`

**Files:**
- Create: `src/components/justificativas/ComentarioMaster.tsx`
- Create: `src/components/justificativas/CobrarButton.tsx`

- [ ] **Step 14.1: Implementar CobrarButton**

```tsx
// src/components/justificativas/CobrarButton.tsx
import { Button } from '@/components/ui/button';
import { BellRing } from 'lucide-react';
import { useNudgeUser } from '@/hooks/useJustificativas';

export default function CobrarButton({ notificationId }: { notificationId: string }) {
  const { mutateAsync, isPending } = useNudgeUser();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => mutateAsync({ notificationId })}
      className="gap-2"
    >
      <BellRing size={14} />
      {isPending ? 'Cobrando...' : 'Cobrar'}
    </Button>
  );
}
```

- [ ] **Step 14.2: Implementar ComentarioMaster**

```tsx
// src/components/justificativas/ComentarioMaster.tsx
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useRequestRevision, useArchiveJustification } from '@/hooks/useJustificativas';

interface Props {
  justificationId: string;
  archived: boolean;
  initialComment?: string | null;
}

export default function ComentarioMaster({ justificationId, archived, initialComment }: Props) {
  const [text, setText] = useState(initialComment ?? '');
  const [requireRevision, setRequireRevision] = useState(false);
  const revisionMut = useRequestRevision();
  const archiveMut = useArchiveJustification();

  const handleSave = async () => {
    if (!text.trim() || !requireRevision) return;
    await revisionMut.mutateAsync({ justificationId, comment: text });
  };

  return (
    <div className="space-y-2 mt-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Comentário (opcional)"
        className="min-h-[72px] resize-none"
        maxLength={500}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id={`req-${justificationId}`}
          checked={requireRevision}
          onCheckedChange={(v) => setRequireRevision(v === true)}
        />
        <label htmlFor={`req-${justificationId}`} className="text-sm cursor-pointer">
          Exigir refazer
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => archiveMut.mutate({ id: justificationId, archive: !archived })}
        >
          {archived ? 'Restaurar' : 'Arquivar'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!text.trim() || !requireRevision || revisionMut.isPending}
        >
          Solicitar revisão
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.3: Smoke**

```bash
npm run typecheck
```

- [ ] **Step 14.4: Commit**

```bash
git add src/components/justificativas/ComentarioMaster.tsx src/components/justificativas/CobrarButton.tsx
git commit -m "feat(ui): ComentarioMaster + CobrarButton (ações master per-item)"
```

---

## Task 15: `PessoaAccordion` + `EquipeTab` + test

**Files:**
- Create: `src/components/justificativas/PessoaAccordion.tsx`
- Create: `src/components/justificativas/EquipeTab.tsx`
- Create: `src/components/justificativas/EquipeTab.test.tsx`

- [ ] **Step 15.1: Test EquipeTab**

```tsx
// src/components/justificativas/EquipeTab.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EquipeTab from './EquipeTab';

const teamMock = vi.fn();
vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasTeam: (only: boolean) => teamMock(only),
  useNudgeUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRequestRevision: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveJustification: () => ({ mutate: vi.fn() }),
}));

function renderTab() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><EquipeTab /></QueryClientProvider>);
}

describe('EquipeTab', () => {
  it('agrupa itens por user_id', () => {
    teamMock.mockReturnValue({
      data: [
        { user_id: 'u1', user_name: 'Ana', user_role: 'design', notification_id: 'n1', task_title: 'A', task_due_date: '2026-04-01', justification_id: null, requires_revision: false, archived: false, created_at: '2026-04-01' },
        { user_id: 'u1', user_name: 'Ana', user_role: 'design', notification_id: 'n2', task_title: 'B', task_due_date: '2026-04-02', justification_id: null, requires_revision: false, archived: false, created_at: '2026-04-02' },
        { user_id: 'u2', user_name: 'Beto', user_role: 'devs', notification_id: 'n3', task_title: 'C', task_due_date: '2026-04-03', justification_id: 'j1', requires_revision: false, archived: false, created_at: '2026-04-03' },
      ],
      isLoading: false,
    });
    renderTab();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('toggle "só não-justificadas" passa true para o hook', () => {
    teamMock.mockReturnValue({ data: [], isLoading: false });
    renderTab();
    fireEvent.click(screen.getByRole('switch'));
    const lastCallArg = teamMock.mock.calls[teamMock.mock.calls.length - 1][0];
    expect(lastCallArg).toBe(true);
  });
});
```

- [ ] **Step 15.2: Rodar — falha**

```bash
npm test -- src/components/justificativas/EquipeTab.test.tsx
```

- [ ] **Step 15.3: Implementar PessoaAccordion**

```tsx
// src/components/justificativas/PessoaAccordion.tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import JustificativaItem from './JustificativaItem';
import ComentarioMaster from './ComentarioMaster';
import CobrarButton from './CobrarButton';
import type { TeamItem } from '@/hooks/useJustificativas';

interface Props {
  userId: string;
  userName: string;
  userRole: string;
  items: TeamItem[];
}

export default function PessoaAccordion({ userId, userName, userRole, items }: Props) {
  const pendentes = items.filter((i) => !i.justification_id || i.requires_revision);
  const justificadas = items.filter((i) => i.justification_id && !i.requires_revision);

  return (
    <Accordion type="single" collapsible className="border rounded-lg bg-card">
      <AccordionItem value={userId} className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center justify-between w-full pr-2">
            <div className="text-left">
              <p className="font-semibold">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-danger font-medium">{pendentes.length} pendentes</span>
              <span className="text-muted-foreground">{justificadas.length} justificadas</span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-3">
          {items.map((it) => (
            <JustificativaItem
              key={`${it.notification_id}-${it.justification_id ?? 'pending'}`}
              title={it.task_title}
              dueDate={it.task_due_date}
              state={
                it.archived ? 'archived'
                : it.requires_revision ? 'revision'
                : it.justification_id ? 'done'
                : 'pending'
              }
              justificationText={it.justification_text ?? undefined}
              masterComment={it.master_comment}
            >
              <div className="flex flex-wrap gap-2">
                {!it.justification_id && <CobrarButton notificationId={it.notification_id} />}
                {it.justification_id && (
                  <ComentarioMaster
                    justificationId={it.justification_id}
                    archived={it.archived}
                    initialComment={it.master_comment}
                  />
                )}
              </div>
            </JustificativaItem>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

- [ ] **Step 15.4: Implementar EquipeTab**

```tsx
// src/components/justificativas/EquipeTab.tsx
import { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useJustificativasTeam, type TeamItem } from '@/hooks/useJustificativas';
import PessoaAccordion from './PessoaAccordion';

export default function EquipeTab() {
  const [onlyPending, setOnlyPending] = useState(false);
  const { data, isLoading } = useJustificativasTeam(onlyPending);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; role: string; items: TeamItem[] }>();
    (data ?? []).forEach((item) => {
      const cur = map.get(item.user_id) ?? { name: item.user_name, role: item.user_role, items: [] };
      cur.items.push(item);
      map.set(item.user_id, cur);
    });
    return [...map.entries()].map(([userId, v]) => ({ userId, ...v }));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{grouped.length} pessoas no seu escopo</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={onlyPending} onCheckedChange={setOnlyPending} />
          Só não-justificadas
        </label>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      )}

      {!isLoading && grouped.length === 0 && (
        <p className="text-center py-16 text-muted-foreground">Nenhuma pendência na sua equipe.</p>
      )}

      <ul className="space-y-3">
        {grouped.map((g) => (
          <li key={g.userId}>
            <PessoaAccordion userId={g.userId} userName={g.name} userRole={g.role} items={g.items} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 15.5: Rodar test — pass**

```bash
npm test -- src/components/justificativas/EquipeTab.test.tsx
```

Expected: 2 passam.

- [ ] **Step 15.6: Commit**

```bash
git add src/components/justificativas/PessoaAccordion.tsx src/components/justificativas/EquipeTab.tsx src/components/justificativas/EquipeTab.test.tsx
git commit -m "feat(ui): EquipeTab agrupada por pessoa + PessoaAccordion"
```

---

## Task 16: Página `Justificativas` com tabs

**Files:**
- Create: `src/pages/Justificativas.tsx`
- Create: `src/pages/Justificativas.test.tsx`

- [ ] **Step 16.1: Test**

```tsx
// src/pages/Justificativas.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Justificativas from './Justificativas';

vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasPendentes: () => ({ data: [], isLoading: false }),
  useJustificativasDoneMine: () => ({ data: [], isLoading: false }),
  useJustificativasTeam: () => ({ data: [], isLoading: false }),
  useJustificativasCount: () => ({ data: 0 }),
}));

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Justificativas /></MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Justificativas page', () => {
  it('renderiza 2 tabs sempre + Equipe quando há escopo', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /pendentes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /justificadas/i })).toBeInTheDocument();
  });

  it('Pendentes ativa por default', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /pendentes/i })).toHaveAttribute('data-state', 'active');
  });
});
```

- [ ] **Step 16.2: Rodar — falha**

```bash
npm test -- src/pages/Justificativas.test.tsx
```

- [ ] **Step 16.3: Implementar página**

```tsx
// src/pages/Justificativas.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PendentesTab from '@/components/justificativas/PendentesTab';
import JustificadasTab from '@/components/justificativas/JustificadasTab';
import EquipeTab from '@/components/justificativas/EquipeTab';
import { useJustificativasTeam } from '@/hooks/useJustificativas';

export default function Justificativas() {
  // Tab Equipe só renderiza quando RPC retorna escopo > 0.
  const { data: teamData } = useJustificativasTeam(false);
  const showTeam = (teamData ?? []).length > 0
    || (teamData === undefined ? false : (teamData as any[]).length > 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Justificativas</h1>
        <p className="text-sm text-muted-foreground">Centralize suas pendências e ações da equipe.</p>
      </header>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="justificadas">Justificadas por mim</TabsTrigger>
          {showTeam && <TabsTrigger value="equipe">Da minha equipe</TabsTrigger>}
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <PendentesTab />
        </TabsContent>
        <TabsContent value="justificadas" className="mt-4">
          <JustificadasTab />
        </TabsContent>
        {showTeam && (
          <TabsContent value="equipe" className="mt-4">
            <EquipeTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

> Nota: a tab Equipe usa o **resultado da própria RPC** como sinal de escopo. Se voltarem 0 itens (mesmo com escopo), tab some — comportamento aceito pela spec ("vazio = sumida"). Para mostrar tab vazia em escopo válido, a RPC `get_team_users_in_scope()` poderia ser chamada separada — fica como follow-up (open question da spec).

- [ ] **Step 16.4: Rodar test**

```bash
npm test -- src/pages/Justificativas.test.tsx
```

Expected: 2 passam.

- [ ] **Step 16.5: Commit**

```bash
git add src/pages/Justificativas.tsx src/pages/Justificativas.test.tsx
git commit -m "feat(page): /justificativas com tabs Pendentes/Justificadas/Equipe"
```

---

## Task 17: Wire route `/justificativas` em `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 17.1: Inspecionar App.tsx**

```bash
grep -n "ProtectedRoute\|<Routes>\|<Route" src/App.tsx | head
```

- [ ] **Step 17.2: Adicionar rota**

Adicionar import no topo:

```tsx
import Justificativas from "./pages/Justificativas";
```

Dentro de `<Routes>` (após qualquer rota protegida existente), adicionar:

```tsx
<Route path="/justificativas" element={
  <ProtectedRoute>
    <MainLayout>
      <Justificativas />
    </MainLayout>
  </ProtectedRoute>
} />
```

> Procurar padrão usado por rotas protegidas similares (ex.: `/treinamentos`, `/upsells`) e replicar exatamente. `ProtectedRoute` + `MainLayout` é o padrão visto em `App.tsx:90-101`.

- [ ] **Step 17.3: Smoke**

```bash
npm run typecheck && npm run dev
```

Acessar `http://localhost:5173/justificativas` autenticado. Página renderiza com tabs.

- [ ] **Step 17.4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): rota /justificativas protegida + dentro de MainLayout"
```

---

## Task 18: Remover `TaskDelayModal`

**Files:**
- Modify: `src/layouts/MainLayout.tsx`
- Delete: `src/components/TaskDelayModal.tsx`

- [ ] **Step 18.1: Editar MainLayout**

Remover linha 5:

```tsx
import TaskDelayModal from '@/components/TaskDelayModal';
```

Remover linha 56-57:

```tsx
{/* Task Delay Modal - appears globally for all roles */}
<TaskDelayModal />
```

- [ ] **Step 18.2: Deletar arquivo**

```bash
rm src/components/TaskDelayModal.tsx
```

- [ ] **Step 18.3: Verificar dangling references**

```bash
grep -rn "TaskDelayModal" src/ 2>/dev/null
```

Expected: 0 resultados.

- [ ] **Step 18.4: Typecheck + tests**

```bash
npm run typecheck && npm test
```

Expected: ambos passam.

- [ ] **Step 18.5: Commit**

```bash
git add src/layouts/MainLayout.tsx
git rm src/components/TaskDelayModal.tsx
git commit -m "feat: remove TaskDelayModal — substituído pela área /justificativas"
```

---

## Task 19: Playwright e2e

**Files:**
- Create: `e2e/justificativas.spec.ts`

- [ ] **Step 19.1: Examinar smoke spec existente**

```bash
cat e2e/smoke.spec.ts
```

Identificar padrão de login (helpers, env vars). Adotar mesma abordagem.

- [ ] **Step 19.2: Implementar e2e**

```ts
// e2e/justificativas.spec.ts
import { test, expect } from '@playwright/test';

// Pré-condição: ambiente de teste com user que tem pendência seedada.
// Variáveis de ambiente esperadas (mesmas do smoke.spec.ts):
//   TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_WITH_PENDING (nome do seed que tem 1 pendência)

test.describe('Justificativas', () => {
  test('TaskDelayModal não aparece após login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(?!login)/);
    // Modal antigo: dialog com título "Urgente: Tarefa Atrasada" ou "Urgente: Onboarding Atrasado"
    await expect(page.getByText(/urgente.*tarefa atrasada/i)).toHaveCount(0);
  });

  test('badge na sidebar leva para /justificativas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(?!login)/);

    const badge = page.getByRole('link', { name: /justificativas/i });
    await badge.waitFor({ state: 'visible', timeout: 10_000 });
    await badge.click();
    await expect(page).toHaveURL(/\/justificativas$/);
    await expect(page.getByRole('heading', { name: 'Justificativas' })).toBeVisible();
  });

  test('submeter justificativa zera o badge', async ({ page }) => {
    await page.goto('/justificativas');
    // Espera ao menos um item pendente
    const justificarBtn = page.getByRole('button', { name: /^justificar$/i }).first();
    await justificarBtn.click();
    await page.getByRole('textbox').fill('motivo do atraso para teste e2e');
    await page.getByRole('button', { name: /enviar justificativa/i }).click();
    // Toast de sucesso
    await expect(page.getByText(/justificativa enviada/i)).toBeVisible({ timeout: 8_000 });
  });
});
```

- [ ] **Step 19.3: Rodar e2e**

```bash
npm run test:e2e -- justificativas.spec.ts
```

Expected: 3 testes passam (assumindo seed do test user).

- [ ] **Step 19.4: Commit**

```bash
git add e2e/justificativas.spec.ts
git commit -m "test(e2e): justificativas — modal removido, badge funcional, submit fluxo"
```

---

## Task 20: Manual QA + agentes do harness (CLAUDE.md gates)

**Files:** N/A (gates de processo)

- [ ] **Step 20.1: Rodar suíte completa**

```bash
npm run typecheck && npm test && npm run test:db && npm run test:e2e
```

Expected: tudo verde.

- [ ] **Step 20.2: Manual smoke**

```bash
npm run dev
```

Verificar como user `design`: badge aparece, página abre, submeter funciona, badge zera.
Verificar como user `ceo`: tab Equipe aparece, accordion lista pessoas, "Cobrar" gera notificação no Notification Center, "Solicitar revisão" devolve item para Pendentes do devedor.

- [ ] **Step 20.3: Invocar agentes (CLAUDE.md gates)**

Conforme `CLAUDE.md` do projeto, antes de declarar "pronto":

- `frontend-design` — rodar `hm-design` na sidebar badge, página, accordion, item card e formulários.
- `db-specialist` — revisar EXPLAIN das 4 RPCs de leitura, validar RLS final.
- `seguranca` — revisar RLS, RPCs SECURITY DEFINER, dedupe do nudge, exposição via grants.
- `qa` — rodar `hm-qa` na feature inteira.

Cada agente entrega checklist próprio. Bloqueia merge até todos aprovarem.

- [ ] **Step 20.4: Atualizar wiki**

Adicionar entrada em `docs/wiki/03-Features/Justificativas.md` (se ainda não existe) ou atualizar `Notification Center.md` listando os dois novos `notification_type`.

- [ ] **Step 20.5: Commit final + abrir PR**

```bash
git checkout -b feat/justificativas-sidebar
git push -u origin feat/justificativas-sidebar
gh pr create --title "feat: justificativas na sidebar (substitui TaskDelayModal)" --body "$(cat <<'EOF'
## Summary
- Nova rota /justificativas com 3 tabs (Pendentes / Justificadas por mim / Da minha equipe).
- Badge bottom-fixed na sidebar com contador.
- Visão master hierárquica por escopo via RPCs SECURITY DEFINER.
- Ações master per-item: arquivar, cobrar (Notification Center), comentar com flag refazer.
- TaskDelayModal removido.

Spec: docs/superpowers/specs/2026-05-04-justificativas-sidebar-design.md
Plan: docs/superpowers/plans/2026-05-04-justificativas-sidebar.md

## Test plan
- [ ] vitest: hooks + componentes
- [ ] pgTAP: scope, submit, pending_mine, done_mine, team_grouped, master_actions, RLS
- [ ] Playwright: modal removido, badge funcional, submit fluxo
- [ ] Manual: design → submete → badge zera. CEO → cobra → notification chega ao devedor.
- [ ] frontend-design (hm-design) ✅
- [ ] db-specialist (EXPLAIN + RLS) ✅
- [ ] seguranca (RLS + grants + dedupe) ✅
- [ ] qa (hm-qa) ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

Após aplicar todas as tasks:

- [ ] **Spec coverage:**
  - Q1 (action-modais preservados) ✅ Task 18 só remove TaskDelayModal.
  - Q2 (soft, sem nag) ✅ Sem auto-modal, só badge.
  - Q3 (escopo hierárquico) ✅ Task 2 + 6.
  - Q4 (3 tabs) ✅ Task 16.
  - Q5 (bottom-fixed) ✅ Task 11.
  - Q6 (página dedicada) ✅ Task 16 + 17.
  - Q7 (agrupado por pessoa + filtro) ✅ Task 15.
  - Q8 (remoção legacy) ✅ Task 18.
  - Q9 (read+arquivar+cobrar+comentar) ✅ Tasks 7, 14, 15.
  - Q9.1 (nudge in-app) ✅ Task 7.
  - Q9.2 (sobrescreve + flag refazer → Pendentes) ✅ Tasks 3, 7.

- [ ] **Sem placeholders:** todos os steps têm código completo. Nenhum "TBD"/"similar to Task N".

- [ ] **Type/símbolo consistency:** RPC names, query keys (`justif-pending-mine`/`justif-done-mine`/`justif-team`), `TeamItem`/`PendenteItem`/`DoneItem` exportados de `useJustificativas.ts` e usados sem desvio.

- [ ] **Notification Center:** Task 7 usa `system_notifications` com tipos `justification_nudge` e `justification_revision_required`. Adapter no `useNotificationCenter` pode precisar mapear esses 2 tipos para ícone/cor — anotar na Task 20.4 (docs/wiki).

- [ ] **Open questions da spec preservadas:** RH scope = vazio default (Task 2 não inclui RH); janela 1h hardcoded (Task 7) — pode virar config depois.

---

**Plan complete.** Ready for execution.
