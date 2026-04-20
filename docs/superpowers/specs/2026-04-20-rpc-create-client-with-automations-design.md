# RPC `create_client_with_automations` — Design

> Spec Wave 1 — Track B.1. Desenho arquitetural da RPC transacional que substitui `useCreateClient` (hook legado em `src/hooks/useClientRegistration.ts:295-605`).
>
> Autor: arquiteto. Data: 2026-04-20. Revisor: conselheiro antes de B.2.

---

## TL;DR

- **Problema**: criação de cliente = 9 inserts app-side, não transacional, falhas engolidas em `console.error`, cliente órfão em prod.
- **Solução**: RPC Postgres única com `SECURITY DEFINER`, payload `jsonb`, retorno `jsonb` estruturado, rollback automático em qualquer falha.
- **Idempotência**: chave opcional `p_idempotency_key` numa tabela `client_idempotency_keys` com TTL 24h — não usa CNPJ como chave natural (CNPJ nem sempre existe, e colisão ≠ mesma intenção).
- **Permissão**: `is_executive()` OU role in `(gestor_projetos, financeiro)`. Validação explícita no início; nunca depende só de `GRANT EXECUTE`.
- **Triggers DB existentes (`trigger_create_client_cards`, `create_product_kanban_cards_trigger`, `trigger_create_initial_onboarding_task`, etc.) continuam rodando** dentro da mesma transação — a RPC NÃO duplica essa lógica.
- **Rollout**: feature flag via tabela `feature_flags` (fundador → gestores → geral → remoção do legado em 4 fases, 4-6 semanas).
- **Observabilidade**: retorno traz `automations_executed text[]` + `warnings text[]`; erro gera `RAISE EXCEPTION` com `ERRCODE` mapeado pra toast útil.
- **Código legado deprecado após fase 3**, removido após fase 4 (ninguém toca hook direto).

---

## 1. Assinatura

```sql
CREATE OR REPLACE FUNCTION public.create_client_with_automations(
  p_payload         jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
```

### 1.1 `SECURITY DEFINER` vs `INVOKER` — recomendado **DEFINER**

| Opção | Prós | Contras |
|---|---|---|
| `INVOKER` | RLS do caller aplica nos inserts internos; menor superfície de elevação | Cada tabela precisa ter RLS INSERT policy que aceite caller; hoje várias NÃO têm (ex.: `ads_new_client_notifications` exige `gestor_ads`, não o criador) → RPC falharia intermitentemente |
| `DEFINER` | Roda como `postgres`, contorna RLS para inserts auxiliares, comportamento consistente | Eleva privilégio — **obriga validação manual** de `auth.uid()` + papel logo no início; bypass acidental de RLS se mal escrita |

**Decisão**: `DEFINER`. Motivo: 9 tabelas diferentes com RLS heterogênea — mover pra `INVOKER` significaria relaxar policies (pior pra segurança) ou criar RPC-por-tabela (pior pra consistência). `DEFINER` com guard explícito (`Phase 2`) é o equilíbrio certo: uma porta única, bem auditada.

Mitigação do risco: guard no início (`IF NOT is_executive(auth.uid()) AND NOT has_role(auth.uid(), 'gestor_projetos') AND NOT has_role(auth.uid(), 'financeiro') THEN RAISE EXCEPTION ... USING ERRCODE = 'P0003'`), pgTAP cobrindo cada caminho negativo, `SET LOCAL search_path = public` obrigatório.

### 1.2 Retorno: `uuid` simples vs `jsonb` com metadados — recomendado **jsonb**

| Opção | Prós | Contras |
|---|---|---|
| `uuid` (só client_id) | Minimalista, zero boilerplate | Frontend não sabe o que foi feito; toast genérico "criado"; idempotência não retorna "já existia" sem erro; impossível listar warnings parciais |
| `jsonb` `{ client_id, automations_executed[], warnings[], idempotent_hit }` | Self-documenting, frontend mostra "9/9 automações", warnings permitem soft-fails controlados (ex.: PM não encontrado no grupo), idempotência explícita | +5 linhas de código, schema versionável |

**Decisão**: `jsonb`. Shape:

```json
{
  "client_id": "uuid",
  "automations_executed": ["insert_client", "ads_notification", "onboarding_task", "client_onboarding", "comercial_notification", "mktplace_notification", "product_values", "financeiro_tasks", "financeiro_onboarding", "financeiro_active_clients", "pm_welcome_task"],
  "warnings": ["pm_welcome_task_skipped: no gestor_projetos in group"],
  "idempotent_hit": false,
  "schema_version": 1
}
```

`warnings[]` = coisa que falhou mas NÃO justifica rollback (ex.: grupo sem gestor_projetos → não cria welcome task, mas não invalida o cliente). `schema_version: 1` → permite evolução sem breaking.

### 1.3 `p_payload jsonb` vs parâmetros posicionais — recomendado **jsonb**

Contagem de campos em `NewClientData`: 25+. Posicional seria:
```sql
create_client_with_automations(
  p_name text, p_cnpj text, p_cpf text, p_phone text, p_razao_social text,
  p_niche text, p_general_info text, p_expected_investment numeric,
  -- ... 20 linhas ...
)
```

Problemas do posicional:
- PostgREST expõe função com 25 params → JSON do client vira mapping manual → bug farm.
- Adicionar campo novo = ALTER FUNCTION (sem "DEFAULT NULL" pra novos = breaking).
- `product_values` é array de objetos → não mapeia posicional de forma ergonômica.

**Decisão**: `jsonb` único. Validação de shape no início (`Phase 1`) via `jsonb_typeof` + checks. Extensível sem DDL. PostgREST chama `POST /rpc/create_client_with_automations` com body `{ p_payload: {...}, p_idempotency_key: "..." }` naturalmente.

---

## 2. Schema do payload

Mirror exato de `NewClientData` (TS interface em `src/hooks/useClientRegistration.ts:59-84`). Documentado aqui porque RPC é contrato independente do TS.

### 2.1 Campos obrigatórios

| Campo | Tipo SQL | Validação | Notas |
|---|---|---|---|
| `name` | `text` | `length >= 2`, trim | Nome do cliente |
| `entry_date` | `date` (ISO string) | parse válido | Usado pra calcular contract_expiration_date |

### 2.2 Campos opcionais — identidade

| Campo | Tipo | Validação | Default |
|---|---|---|---|
| `cnpj` | `text` | 14 dígitos (após sanitize) ou null; **UNIQUE via `idx_clients_cnpj_unique`** | `null` |
| `cpf` | `text` | 11 dígitos ou null | `null` |
| `phone` | `text` | — | `null` |
| `razao_social` | `text` | — | `null` |
| `niche` | `text` | — | `null` |
| `general_info` | `text` | — | `null` |

### 2.3 Campos opcionais — financeiro

| Campo | Tipo | Validação | Default |
|---|---|---|---|
| `expected_investment` | `numeric` | `>= 0` | `null` |
| `monthly_value` | `numeric` | `>= 0` | `null` |
| `sales_percentage` | `numeric` | `0..100` | `null` |
| `contract_duration_months` | `int` | `>= 1, <= 120` | `12` (se ausente) |
| `payment_due_day` | `int` | `1..31` | `null` |
| `contracted_products` | `text[]` | — | `[]` |
| `torque_crm_products` | `text[]` | subset de `('v8','automation','copilot')` | `[]` |
| `product_values` | `array<{product_slug, product_name, monthly_value}>` | `monthly_value >= 0`; unique `product_slug` | `[]` |

### 2.4 Campos opcionais — assignments

| Campo | Tipo | Validação | Notas |
|---|---|---|---|
| `group_id` | `uuid` | FK `organization_groups(id)` | null permitido |
| `squad_id` | `uuid` | FK `squads(id)` | null permitido |
| `assigned_ads_manager` | `uuid` | user tem role `gestor_ads` | null → dispara menos automações |
| `assigned_comercial` | `uuid` | role `consultor_comercial` | null → não cria notificação N5 |
| `assigned_crm` | `uuid` | role `gestor_crm` | null → não seta `crm_status` |
| `assigned_rh` | `uuid` | role `rh` | null permitido |
| `assigned_outbound_manager` | `uuid` | role `outbound` | null permitido |
| `assigned_mktplace` | `uuid` | role `consultor_mktplace` | null → não cria N6 |

### 2.5 Validação de shape (Phase 1)

Lógica plpgsql:
```plpgsql
IF p_payload->>'name' IS NULL OR length(trim(p_payload->>'name')) < 2 THEN
  RAISE EXCEPTION 'name required (min 2 chars)' USING ERRCODE = 'P0002';
END IF;
-- ... campo por campo
```

Alternativa considerada: `json_schema` extension (não instalada no Supabase gerenciado) ou validação no edge function. **Rejeitado** — valida no plpgsql mesmo, centraliza, pgTAP cobre.

---

## 3. Estrutura interna (pseudocódigo)

```plpgsql
CREATE OR REPLACE FUNCTION public.create_client_with_automations(
  p_payload jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id          uuid := auth.uid();
  v_caller_name        text;
  v_client_id          uuid;
  v_step               text := 'init';
  v_executed           text[] := ARRAY[]::text[];
  v_warnings           text[] := ARRAY[]::text[];
  v_idempotent_hit     boolean := false;
  v_existing_client_id uuid;
  v_contract_exp_date  date;
  v_entry_date         date;
  v_duration           int;
  v_is_growth          boolean;
  v_pv                 jsonb; -- loop var
BEGIN
  ----------------------------------------------------------------------
  -- PHASE 1 — Validação de payload (não-transacional, falha rápido)
  ----------------------------------------------------------------------
  v_step := 'validate_payload';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = 'P0003';
  END IF;
  -- name required
  IF p_payload->>'name' IS NULL OR length(trim(p_payload->>'name')) < 2 THEN
    RAISE EXCEPTION 'name is required (min 2 chars)' USING ERRCODE = 'P0002';
  END IF;
  -- entry_date required
  IF p_payload->>'entry_date' IS NULL THEN
    RAISE EXCEPTION 'entry_date is required' USING ERRCODE = 'P0002';
  END IF;
  -- (more shape checks: product_values structure, numeric ranges, uuids valid)

  ----------------------------------------------------------------------
  -- PHASE 2 — Verificação de permissão
  ----------------------------------------------------------------------
  v_step := 'check_permission';
  IF NOT (
    public.is_executive(v_caller_id)
    OR public.has_role(v_caller_id, 'gestor_projetos')
    OR public.has_role(v_caller_id, 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient privilege to create client'
      USING ERRCODE = 'P0003';
  END IF;

  ----------------------------------------------------------------------
  -- PHASE 3 — Idempotência
  ----------------------------------------------------------------------
  v_step := 'check_idempotency';
  IF p_idempotency_key IS NOT NULL THEN
    SELECT client_id INTO v_existing_client_id
    FROM client_idempotency_keys
    WHERE key = p_idempotency_key
      AND created_at > now() - interval '24 hours';
    IF v_existing_client_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'client_id', v_existing_client_id,
        'automations_executed', ARRAY[]::text[],
        'warnings', ARRAY['idempotent_hit: returned existing client']::text[],
        'idempotent_hit', true,
        'schema_version', 1
      );
    END IF;
  END IF;

  ----------------------------------------------------------------------
  -- PHASE 4 — Inserts transacionais (tudo ou nada)
  ----------------------------------------------------------------------
  v_step := 'insert_client';
  INSERT INTO clients (...) VALUES (...) RETURNING id INTO v_client_id;
  v_executed := v_executed || 'insert_client';

  -- idempotency record (dentro da transação)
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO client_idempotency_keys (key, client_id, created_by)
    VALUES (p_idempotency_key, v_client_id, v_caller_id);
  END IF;

  -- Automation 1: ads notification + task + onboarding (se ads_manager)
  IF (p_payload->>'assigned_ads_manager') IS NOT NULL THEN
    v_step := 'ads_notification';
    SELECT name INTO v_caller_name FROM profiles WHERE user_id = v_caller_id;
    INSERT INTO ads_tasks (...) VALUES (...);
    INSERT INTO ads_new_client_notifications (...) VALUES (...);
    v_executed := v_executed || 'ads_notification';

    v_step := 'onboarding_task';
    INSERT INTO onboarding_tasks (...) VALUES (...);
    v_executed := v_executed || 'onboarding_task';

    v_step := 'client_onboarding';
    INSERT INTO client_onboarding (...) VALUES (...);
    v_executed := v_executed || 'client_onboarding';
  END IF;

  -- Automation 2: N5 comercial notification
  IF (p_payload->>'assigned_comercial') IS NOT NULL THEN
    v_step := 'comercial_notification';
    INSERT INTO system_notifications (...) VALUES (...);
    v_executed := v_executed || 'comercial_notification';
  END IF;

  -- Automation 3: N6 mktplace notification
  IF (p_payload->>'assigned_mktplace') IS NOT NULL THEN
    v_step := 'mktplace_notification';
    INSERT INTO system_notifications (...) VALUES (...);
    v_executed := v_executed || 'mktplace_notification';
  END IF;

  -- Automation 4: product values + financeiro tasks + department tasks
  IF jsonb_array_length(COALESCE(p_payload->'product_values', '[]'::jsonb)) > 0 THEN
    v_step := 'product_values';
    INSERT INTO client_product_values (...) SELECT ... FROM jsonb_array_elements(p_payload->'product_values');
    v_executed := v_executed || 'product_values';

    v_step := 'financeiro_tasks';
    INSERT INTO financeiro_tasks (...) SELECT ...;
    v_executed := v_executed || 'financeiro_tasks';

    v_step := 'financeiro_department_tasks';
    INSERT INTO department_tasks (...) SELECT ...;
    v_executed := v_executed || 'financeiro_department_tasks';

    v_entry_date := (p_payload->>'entry_date')::date;
    v_duration := COALESCE((p_payload->>'contract_duration_months')::int, 12);
    v_contract_exp_date := v_entry_date + (v_duration || ' months')::interval;

    v_step := 'financeiro_client_onboarding';
    INSERT INTO financeiro_client_onboarding (...) SELECT ...;
    v_executed := v_executed || 'financeiro_client_onboarding';

    v_step := 'financeiro_active_clients';
    INSERT INTO financeiro_active_clients (...) SELECT ...;
    v_executed := v_executed || 'financeiro_active_clients';
  END IF;

  -- Automation 5: PM welcome task (Millennials Growth only)
  v_is_growth := COALESCE(p_payload->'contracted_products', '[]'::jsonb) ? 'millennials-growth';
  IF v_is_growth AND (p_payload->>'group_id') IS NOT NULL THEN
    v_step := 'pm_welcome_task';
    -- inline lógica de createWelcomeTaskForProjectManager:
    -- encontrar gestor_projetos no grupo, verificar idempotência local, inserir
    -- Se grupo não tem PM → warning, não erro:
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = (p_payload->>'group_id')::uuid
        AND ur.role = 'gestor_projetos'
    ) THEN
      v_warnings := v_warnings || 'pm_welcome_task_skipped: no gestor_projetos in group';
    ELSE
      INSERT INTO department_tasks (...) SELECT ...;
      v_executed := v_executed || 'pm_welcome_task';
    END IF;
  END IF;

  ----------------------------------------------------------------------
  -- PHASE 5 — Return metadados
  ----------------------------------------------------------------------
  RETURN jsonb_build_object(
    'client_id',            v_client_id,
    'automations_executed', v_executed,
    'warnings',             v_warnings,
    'idempotent_hit',       v_idempotent_hit,
    'schema_version',       1
  );

EXCEPTION
  WHEN unique_violation THEN
    -- detecta CNPJ duplicado etc.
    IF SQLERRM LIKE '%idx_clients_cnpj_unique%' THEN
      RAISE EXCEPTION 'cnpj already registered: %', SQLERRM
        USING ERRCODE = 'P0004', HINT = 'cnpj_duplicate';
    ELSE
      RAISE EXCEPTION 'unique violation at step %: %', v_step, SQLERRM
        USING ERRCODE = 'P0005';
    END IF;
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'foreign key violation at step %: %', v_step, SQLERRM
      USING ERRCODE = 'P0006';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_client_with_automations failed at step [%]: %', v_step, SQLERRM
      USING ERRCODE = 'P0001';
END;
$$;
```

Observações:
- Rollback é **implícito** em plpgsql: qualquer `RAISE EXCEPTION` dentro da função desfaz todos os inserts anteriores.
- `v_step` rastreia ponto exato de falha → error message útil pro frontend e pro log.
- `warnings` é array de strings, não erro — frontend mostra como "aviso", não bloqueia.

---

## 4. Idempotência — estratégia recomendada: **Opção A**

### Comparativo

| Opção | Prós | Contras | Recomendação |
|---|---|---|---|
| **A. Tabela dedicada `client_idempotency_keys(key, client_id, created_at, created_by)`** | Explícita; TTL configurável (24h); key é `text` qualquer (UUID v4 gerado no client); protege contra double-submit (usuário clicou 2x, rede lenta) | +1 tabela + job de limpeza | **✅ Recomendado** |
| B. CNPJ como chave natural | Zero estrutura nova | CNPJ é opcional (pode ser null → duplica); mesmo CNPJ hoje = retentativa? ou cliente diferente? Semântica ambígua; **não protege a janela de race** (user cria A, depois cria B com mesmo CNPJ por erro → silenciosamente retorna A?) | ❌ Rejeitado — mistura identidade de domínio com mecanismo de retry |
| C. Sem idempotência | Zero código | Double-submit = duplicata; ops real em prod | ❌ Rejeitado |

### Schema da tabela (DDL — implementação em B.2)

```sql
CREATE TABLE public.client_idempotency_keys (
  key         text PRIMARY KEY,
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_idempotency_keys_created_at ON public.client_idempotency_keys(created_at);

-- RLS: só executivos + SECURITY DEFINER RPC podem ler/escrever
ALTER TABLE public.client_idempotency_keys ENABLE ROW LEVEL SECURITY;
-- sem policies pra authenticated → só RPC DEFINER acessa
```

Limpeza: `pg_cron` job diário `DELETE FROM client_idempotency_keys WHERE created_at < now() - interval '48 hours'` (mantém 48h pra margem).

### Geração da key no frontend

`useCreateClient` gera `crypto.randomUUID()` uma vez por submit; se mutation falha e user retenta, reutiliza a mesma key.

---

## 5. Error codes

Mapeamento `ERRCODE` → semântica frontend:

| Code | Significado | Toast/UI |
|---|---|---|
| `P0001` | Erro genérico de automação (step `v_step` embutido na mensagem) | "Erro ao cadastrar cliente. Tente novamente." + log detalhado |
| `P0002` | Payload inválido (campo obrigatório ausente, valor fora de range) | Mensagem específica — é bug de client, mostrar pra dev corrigir |
| `P0003` | Permissão negada (não autenticado OU papel insuficiente) | "Você não tem permissão pra criar clientes." |
| `P0004` | CNPJ duplicado (`idx_clients_cnpj_unique`) | "CNPJ já cadastrado" — mapeia na mesma cara do atual hook |
| `P0005` | Unique violation outra (email etc.) | "Dado duplicado: {detail}" |
| `P0006` | FK violation (squad_id inexistente, group_id inválido) | "Referência inválida: {detail}" |

Frontend lê `error.code` do supabase-js (PostgREST retorna como `error.code === 'P0004'`).

---

## 6. Permissões

### 6.1 `GRANT EXECUTE`

```sql
REVOKE ALL ON FUNCTION public.create_client_with_automations(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_with_automations(jsonb, text) TO authenticated;
```

**Justificativa de `authenticated`**: não é "todo mundo pode criar" — a checagem de papel é **dentro da função** (`Phase 2`). `GRANT` em `authenticated` só garante que PostgREST consiga chamar; o guard faz o trabalho real.

Alternativas consideradas:
- ❌ `GRANT ... TO ceo, cto, gestor_projetos, financeiro`: Postgres roles ≠ nossa coluna `user_roles.role` (são enum coluna, não pg_role). Não existe mapeamento direto. Descartado.
- ❌ Criar `security_group_create_client` pg_role: overhead operacional alto, sem ganho real.

### 6.2 Guard interno (Phase 2)

```plpgsql
IF NOT (
  public.is_executive(v_caller_id)
  OR public.has_role(v_caller_id, 'gestor_projetos')
  OR public.has_role(v_caller_id, 'financeiro')
) THEN
  RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = 'P0003';
END IF;
```

Usa `is_executive()` (canonical — cobre `ceo` + `cto`, ver `20260416130000_is_ceo_includes_cto.sql`). `has_role()` já existe no schema (helper padrão).

**Por que não ampliar pra `gestor_ads`, `consultor_comercial` etc.?** Hoje o modal `CadastroCliente` só é acessível via sidebar de Executivo / Gestor de Projetos / Financeiro. Mantém paridade. Se no futuro quisermos liberar pra mais, muda-se só o guard.

---

## 7. Feature flag — estratégia recomendada: **Opção A**

### Comparativo

| Opção | Prós | Contras | Recomendação |
|---|---|---|---|
| **A. Tabela `feature_flags(key, enabled, scope, scope_id)`** | Mudança runtime, sem deploy; granular (global, por user, por role, por group); auditável | +1 tabela | **✅ Recomendado** |
| B. Env var `VITE_USE_RPC_CLIENT_CREATION` | Zero infra | Build-time: pra mudar precisa redeploy; não granular; Vercel cache pode atrasar | ❌ Rejeitado |
| C. `profiles.experimental_features jsonb` | Granular per-user | Acopla feature flag com dado de usuário; semântica errada | ❌ Rejeitado |

### Schema feature_flags

```sql
CREATE TABLE public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  scope       text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','user','role','group')),
  scope_ids   uuid[] DEFAULT NULL,      -- quando scope != global
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)
);
```

Helper function:
```sql
CREATE FUNCTION public.is_feature_enabled(_key text, _user_id uuid) RETURNS boolean ...
```

Hook TS:
```ts
const { data: useRpc } = useFeatureFlag('use_rpc_client_creation');
// if (useRpc) → chamar RPC; else → legado
```

Rows iniciais:
```sql
INSERT INTO feature_flags (key, enabled, scope, description) VALUES
  ('use_rpc_client_creation', false, 'global', 'Switch to atomic RPC for client creation'),
  ('use_rpc_client_creation_preview', true, 'user', '[[scope_ids=[founder_uuid, gestor_uuid]]]', 'Preview rollout');
```

---

## 8. Rollout plan — 4 fases, 4-6 semanas

### Fase 1 — Deploy + gate fechado (semana 1)
- Migration cria RPC + `client_idempotency_keys` + `feature_flags` + pgTAP verde.
- `feature_flags.use_rpc_client_creation.enabled = false`.
- Hook legado 100% do tráfego.
- **Critério de saída**: pgTAP passou + smoke test manual do fundador chamando RPC via SQL editor + rollback verificado via `BEGIN; SELECT create_client_with_automations(...); ROLLBACK;` + pelo menos 1 teste de CNPJ duplicado retornando P0004.

### Fase 2 — Preview opt-in (semana 2)
- Flag `use_rpc_client_creation_preview.scope='user', scope_ids=[founder, 1 gestor_projetos]`.
- Fundador + 1 gestor criam todos clientes novos via RPC.
- Monitoring: Postgres log pra `P00*` errors; dashboard de `automations_executed` length (sempre 9-11).
- **Critério de saída**: 1 semana, ≥ 5 clientes criados via RPC, 0 `warnings` não esperados, 0 erros P0001.

### Fase 3 — Default ON + legado deprecated (semana 3-4)
- `use_rpc_client_creation.enabled = true, scope='global'`.
- Hook legado marcado `@deprecated` com `console.warn` no código (para o dev que bater em git blame).
- Kill switch: reverter flag sem deploy se algo explodir.
- **Critério de saída**: 2 semanas default ON, 0 reclamações de cliente órfão em `#ops`, taxa de erro P0001 < 0.1%.

### Fase 4 — Remoção do legado (semana 5-6)
- Deletar `useCreateClient` legado + rota antiga.
- Hook `useCreateClient` redirecionado 100% pra RPC.
- `feature_flag` removida (RPC vira default permanente).
- Migration cleanup opcional: `DROP FUNCTION` de helpers-legado se houver.

---

## 9. Observabilidade

### 9.1 Dentro da RPC

- `RAISE NOTICE 'step=%', v_step` em cada fase — Postgres log captura, aparece em Supabase Logs.
- Retorno `automations_executed[]` = auditoria runtime do que rodou.

### 9.2 Frontend

Toast após sucesso:
```ts
toast.success(`Cliente "${name}" cadastrado`, {
  description: `${result.automations_executed.length} automações executadas${result.warnings.length > 0 ? `. ${result.warnings.length} avisos.` : ''}`,
});
```

Se `warnings.length > 0`, botão "Ver detalhes" abre modal com lista de warnings — fundador/gestor decide se intervém.

### 9.3 Logging estruturado

- Erro P0001 em prod → Sentry captura com `tags: { step: v_step, code: 'P0001' }`.
- Frontend: `console.info('[RPC create_client] result:', result)` em dev.
- Backend: Supabase logs filtráveis por `function_name='create_client_with_automations'`.

### 9.4 Métrica de sucesso pós-rollout

- `SELECT count(*), avg(array_length(automations_executed, 1)) FROM client_idempotency_keys JOIN clients ... GROUP BY created_at::date` (últimos 30d).
- Alertar se `warnings` médio > 5% das execuções.

---

## 10. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | SECURITY DEFINER + bug numa policy interna → RPC inteira quebra, single point of failure | Alta | pgTAP abrangente cobrindo 9 automações independentemente; rollback via flag em < 1min; health check runtime na Fase 2 |
| R2 | DEFINER eleva privilégio, bypass acidental de RLS | Alta | Guard `is_executive OR gestor_projetos OR financeiro` logo no início; `SET search_path = public` obrigatório (evita schema hijacking); review de segurança obrigatório antes de deploy (agente `seguranca`) |
| R3 | Step 9 falha → rollback desfaz 1-8, usuário perde trabalho | Média | É feature, não bug — consistência é o ponto. Frontend guarda payload no estado local até sucesso confirmado; toast de erro traz `step=v_step` para debug; user retenta com mesmo idempotency key |
| R4 | Triggers DB (`trigger_create_client_cards`, `create_product_kanban_cards_trigger`, `trigger_create_initial_onboarding_task`) rodam DENTRO da RPC — se algum falhar, tudo rollback | Média | Mapear trigger-por-trigger em §11; garantir que cada trigger está idempotente e bem testado; pgTAP separado cobre cada trigger; não duplicar lógica em RPC |
| R5 | `p_idempotency_key` vaza entre usuários (user A sabe key do user B) → A lê cliente de B | Baixa | Key é UUID v4 (128 bits entropy); tabela tem `created_by`, RPC valida que `v_caller_id = client_idempotency_keys.created_by` antes de retornar (NÃO documentado acima — **adicionar em B.2**) |
| R6 | PostgREST expõe função pra qualquer authenticated → teste de permissão vira essencial | Alta | Guard no início; pgTAP nega explicitamente; monitoring de `P0003` |
| R7 | Migração de hook legado pra RPC introduz regressão silenciosa em automações esotéricas (ex.: `ads_tasks.tags` array) | Média | QA E2E (B.5) cobre cada automação; paridade diff'ada campo-a-campo entre hook e RPC |
| R8 | Performance — 9 inserts + triggers numa transação → lock demorado em `clients` | Baixa | Todos inserts são rápidos (<10ms cada); lock de `clients` rola só durante `INSERT RETURNING`; monitorar p95 após rollout |
| R9 | `feature_flags` consultado toda vez que hook roda → N+1 | Baixa | Cache via React Query (staleTime: 5min); flag muda raramente |
| R10 | `client_idempotency_keys` cresce sem bound | Baixa | `pg_cron` job diário de limpeza (48h TTL); alerta se tabela > 100k rows |

---

## 11. Interação com triggers existentes

Triggers `AFTER INSERT ON clients` (já mapeados pelo db-specialist nos migrations):

| Trigger | Arquivo | O que faz | Comportamento dentro da RPC |
|---|---|---|---|
| `trigger_create_client_cards` | `20260113182146` | Cria cards de kanban nos boards de produtos | Roda automaticamente dentro da transação; se falhar → rollback global |
| `create_product_kanban_cards_trigger` | `20260203021017` | Cria cards adicionais de kanban | Idem |
| `trigger_create_initial_onboarding_task` | `20260113185053` | Cria `onboarding_tasks` "Cadastrar cliente na plataforma" (milestone 0) | **CONFLITO POTENCIAL**: a RPC também insere em `onboarding_tasks` (marcar_call_1). Validar em B.2 se esse trigger existe na realidade prod e se gera row diferente — se duplicar, desabilitar trigger ou remover insert manual. |

Triggers `AFTER INSERT ON onboarding_tasks`:

| Trigger | Arquivo | O que faz |
|---|---|---|
| `create_ads_task_for_onboarding_task` | `20260217130000` | Cria `ads_tasks` a partir da onboarding_task | Roda automaticamente. **Possível duplicação** com o insert manual em `ads_tasks` (L349-369 do hook). DB specialist valida em B.2 e decide: remover insert manual ou desabilitar trigger. |

**Princípio arquitetural**: RPC NÃO duplica trigger logic. Se trigger faz X, RPC só insere a row que dispara trigger. Se hoje hook duplica trigger, durante B.2 o db-specialist remove a duplicação.

**Inventário completo dos triggers é tarefa do db-specialist em B.2** (conferir pg_trigger real do Supabase, não só migrations).

---

## 12. Migração de dados

**Nenhuma migração de dados necessária.**

- RPC é aditiva: hook legado coexiste enquanto flag OFF.
- Clientes criados antes da RPC (via hook) têm mesma estrutura de dados — nenhum backfill.
- `client_idempotency_keys` e `feature_flags` são tabelas novas, vazias na criação.
- `pgTAP` tests usam `pg_tap` rollback — zero impacto em dados reais.

---

## 13. Handoff

### B.2 — DB specialist: implementar RPC
- Criar migration única: `20260421XXXX00_create_client_with_automations.sql` contendo:
  - `CREATE TABLE client_idempotency_keys` + indices + RLS
  - `CREATE TABLE feature_flags` + helper `is_feature_enabled()` + seed rows
  - `CREATE OR REPLACE FUNCTION create_client_with_automations` completa
  - `GRANT EXECUTE ... TO authenticated`
  - `pg_cron` job de limpeza de idempotency keys
- Validar triggers em §11 antes de escrever inserts (não duplicar trigger logic).
- Rodar `supabase db reset` local + smoke test via psql.

### B.3 — DB specialist: pgTAP
- `supabase/tests/rpc_create_client_with_automations.sql` cobrindo:
  - Happy path completo (todos os 9 automations)
  - Sem `assigned_ads_manager` → 5 automations só
  - Sem `product_values` → skip financeiro
  - Millennials Growth + group sem PM → `warnings[]` preenchido
  - Permissão negada (gestor_ads tentando chamar) → P0003
  - CNPJ duplicado → P0004
  - Payload inválido (name vazio) → P0002
  - Idempotency hit → retorna client existente sem duplicar inserts
  - Rollback em falha de step 5 → 0 rows em todas as tabelas

### B.4 — Engenheiro: hook refactor
- `src/hooks/useClientRegistration.ts`:
  - `useCreateClient` checa flag → chama `supabase.rpc('create_client_with_automations', { p_payload, p_idempotency_key: crypto.randomUUID() })`
  - Legado isolado em função interna `createClientLegacy()` preservada até Fase 4
  - Mapeamento de `error.code` P00XX pra toasts específicos
  - React Query invalidations continuam iguais
- Novo hook utilitário: `src/hooks/useFeatureFlag.ts`.

### B.5 — QA E2E
- Teste Playwright: criar cliente completo, verificar 9 rows criadas
- Teste de falha: forçar CNPJ duplicado, verificar rollback (0 rows em `onboarding_tasks`)
- Teste de permissão: login como `gestor_ads`, tentar criar → 403/P0003
- Teste visual: toast com "N/M automações"
- Teste idempotência: double-submit (mesmo key) → apenas 1 cliente

### Segurança (agente `seguranca`)
- Auditoria do guard Phase 2 antes de deploy
- Validar que `client_idempotency_keys` tem `created_by` check
- Conferir `SET search_path = public` presente
- Simular ataque: user malicioso tenta chamar RPC com payload injectando SQL — `jsonb` parsing deve ser imune

---

## Decisão final

| Pergunta | Resposta |
|---|---|
| SECURITY DEFINER? | Sim (com guard Phase 2) |
| Retorno? | `jsonb` estruturado |
| Input? | `p_payload jsonb` + `p_idempotency_key text` |
| Idempotência? | Tabela dedicada, TTL 24h |
| Permissão? | `is_executive OR gestor_projetos OR financeiro` |
| Feature flag? | Tabela `feature_flags` com helper |
| Rollout? | 4 fases, flag controlado, preview primeiro |
| Observabilidade? | `automations_executed[]` + `warnings[]` retornados |
| Migração de dados? | Nenhuma |

**Próximo passo**: conselheiro revisa spec. Se aprovar → db-specialist pega B.2.
