# Auditoria RLS — Literal Role sem Helper (2026-04-20)

> [!danger] Wave 1 Track A.1 — Inventário completo
> Escopo: todas policies do schema `public` em prod (projeto `semhnpwxptfgqxhkoqsk`) que usam literal de role (`'ceo'`, `'gestor_projetos'`, etc.) **sem** helper `is_admin`/`is_executive`/`is_ceo` na mesma expressão — ou seja, policies que **bloqueiam silenciosamente admins** que não possuam a role nomeada.
>
> Este documento é **inventário + plano**. **Nenhuma migration de fix foi escrita aqui** — isso é Track A.3.

## TL;DR

- **456** policies em `public`, **134** com literal role, **114** flaggadas (literal sem helper admin).
- **35 CRÍTICAS** — bloqueiam criação/edição/leitura de entidades principais (clients, client_invoices, client_sales, briefings, comercial_tasks, cs_action_plans).
- **51 ALTAS** — bloqueiam operação cotidiana (justificativas, notificações de atraso, comentários, card_attachments).
- **28 MÉDIAS** — profiles (10), dashboards financeiros, nps, CS auxiliar.
- Role literal mais comum: `ceo` (94 ocorrências) — vetor direto do incidente CTO. `gestor_projetos` 84, `sucesso_cliente` 56, `gestor_ads` 42, `financeiro` 17.
- 11 policies já corrigidas pelo hotfix Wave 0 (financeiro_tasks, financeiro_client_onboarding, ads_tasks parcial) — **excluídas** da lista de fix.
- Padrão dominante: `has_role(auth.uid(), 'X'::user_role)` isolado (67 policies) — precisa virar `is_admin(auth.uid()) OR has_role(auth.uid(), 'X'::user_role)`.

---

## Seção 1. Metodologia

### Comando CLI

```bash
set -a
source /Volumes/Untitled/refine-dash-main/.env.scripts
set +a

supabase db query --linked --file /tmp/rls_audit.sql > /tmp/rls_all_policies.json
```

### Query SQL (exata)

```sql
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  pol.polname AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS cmd,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, pol.polname;
```

### Query de inventário de helpers (validação)

```sql
SELECT p.proname, pg_get_function_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS ret, p.prosecdef AS secdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'is\_%' OR p.proname LIKE 'has\_%');
```

**Helpers existentes em prod** (confirmado):

| helper | assinatura | secdef |
|---|---|---|
| `is_admin` | `(_user_id uuid) → bool` | sim |
| `is_ceo` | `(_user_id uuid) → bool` | sim |
| `is_executive` | `(_user_id uuid) → bool` | sim |
| `has_role` | `(_user_id uuid, _role user_role) → bool` | sim |
| `has_page_access` | `(_user uuid, _page text) → bool` | sim |

> [!note] `has_role` **não** é helper "protetor"
> `has_role(uid, 'ceo')` tem exatamente a mesma falha do literal: se o CTO não tiver `ceo` em `user_roles`, falha. Por isso policies com `has_role(..., 'X'::user_role)` solitário foram flaggadas. A correção é prefixar com `is_admin(auth.uid()) OR ...`.

### Critério de flag

Policy é flaggada se:
1. Expressão `USING` ou `WITH CHECK` contém literal role (`'ceo'`, `'gestor_projetos'`, etc.) OU chama `has_role(..., '<role>'::user_role)`,
2. **E** a mesma expressão **não** chama `is_admin(...)`, `is_ceo(...)` ou `is_executive(...)`.

Tabelas já corrigidas pelo hotfix Wave 0 (`financeiro_tasks`, `financeiro_client_onboarding`, `ads_tasks` parcial) foram excluídas do alvo de fix — mas policies dessas tabelas **ainda não corrigidas** aparecem no inventário (ex.: `ads_tasks / Authorized roles can view all ads tasks for monitoring` é SELECT, não foi tocado pelo hotfix).

### Execução

- Hora UTC: **2026-04-20 23:38:06 UTC**
- Projeto linked: `semhnpwxptfgqxhkoqsk`
- Output bruto salvo em `/tmp/rls_all_policies.json` (não commitado)

---

## Seção 2. Resultado bruto

- **Total policies no schema public**: 456
- **Policies com literal role (qualquer contexto)**: 134
- **Policies flaggadas (literal role SEM `is_admin`/`is_executive`/`is_ceo`)**: 114
- **Tabelas impactadas**: 55

### Por risco

| risco | count |
|---|---|
| CRITICO | 35 |
| ALTO | 51 |
| MEDIO | 28 |
| BAIXO | 0 |

### Por comando

| cmd | count |
|---|---|
| SELECT | 48 |
| INSERT | 21 |
| UPDATE | 18 |
| DELETE | 16 |
| ALL | 11 |

### Top 15 tabelas impactadas

| tabela | risco | policies flaggadas |
|---|---|---|
| `profiles` | MEDIO | 10 |
| `clients` | CRITICO | 8 |
| `client_invoices` | CRITICO | 4 |
| `ads_task_delay_justifications` | ALTO | 3 |
| `ads_task_delay_notifications` | ALTO | 3 |
| `atrizes_briefings` | CRITICO | 3 |
| `comercial_delay_notifications` | ALTO | 3 |
| `cs_action_plans` | CRITICO | 3 |
| `design_briefings` | CRITICO | 3 |
| `design_delay_notifications` | ALTO | 3 |
| `dev_briefings` | CRITICO | 3 |
| `dev_delay_notifications` | ALTO | 3 |
| `outbound_task_delay_notifications` | ALTO | 3 |
| `produtora_briefings` | CRITICO | 3 |
| `produtora_delay_notifications` | ALTO | 3 |

### Frequência role literal (nas policies flaggadas)

| role | ocorrências |
|---|---|
| `ceo` | 94 |
| `gestor_projetos` | 84 |
| `sucesso_cliente` | 56 |
| `gestor_ads` | 42 |
| `financeiro` | 17 |
| `editor_video` | 11 |
| `devs` | 10 |
| `design` | 8 |
| `consultor_comercial` | 7 |
| `produtora` | 6 |
| `outbound` | 4 |
| `atrizes_gravacao` | 3 |
| `gestor_crm` | 1 |
| `rh` | 1 |

> `ceo` em 94 policies é a confirmação do vetor. O incidente do CTO não foi isolado — é sistêmico. Toda policy com `'ceo'::user_role` literal sem `is_executive`/`is_admin` é uma landmine pro próximo executivo que não tiver `ceo` na tabela `user_roles`.

---

## Seção 3. Tabela por policy (114 linhas)

> Ordenada por risco (CRITICO → ALTO → MEDIO), depois por tabela.

| # | tabela | policy | cmd | roles | helper proposto | risco | fluxo |
|---|---|---|---|---|---|---|---|
| 1 | `ads_tasks` | Authorized roles can view all ads tasks for monitoring | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_projetos'::user_role) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)` | **CRITICO** | Kanban ADS |
| 2 | `atrizes_briefings` | atrizes_briefings_delete | DELETE | atrizes_gravacao,ceo,gestor_ads,gestor_projetos | `is_admin(auth.uid()) OR has_role(auth.uid(), 'atrizes_gravacao'::user_role) OR has_role(auth.uid(), 'gestor_ads'::user_role) OR has_role(auth.uid(), 'gestor_projetos'::user_role)` | **CRITICO** | Briefings departamento |
| 3 | `atrizes_briefings` | atrizes_briefings_insert | INSERT | atrizes_gravacao,ceo,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(auth.uid()) OR has_role(auth.uid(), 'atrizes_gravacao'::user_role) OR has_role(auth.uid(), 'gestor_ads'::user_role) OR has_role(auth.uid(), 'gestor_projetos'::user_role) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)` | **CRITICO** | Briefings departamento |
| 4 | `atrizes_briefings` | atrizes_briefings_update | UPDATE | atrizes_gravacao,ceo,gestor_ads,gestor_projetos,sucesso_cliente | idem #3 | **CRITICO** | Briefings departamento |
| 5 | `client_invoices` | Financeiro pode atualizar faturamentos | UPDATE | ceo,financeiro,gestor_projetos | `is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role) OR has_role(auth.uid(), 'gestor_projetos'::user_role)` | **CRITICO** | Faturamento / NF |
| 6 | `client_invoices` | Financeiro pode criar faturamentos | INSERT | ceo,financeiro,gestor_projetos | idem #5 | **CRITICO** | Faturamento / NF |
| 7 | `client_invoices` | Financeiro pode deletar faturamentos | DELETE | ceo,financeiro,gestor_projetos | idem #5 | **CRITICO** | Faturamento / NF |
| 8 | `client_invoices` | Financeiro pode ver faturamentos | SELECT | ceo,financeiro,gestor_projetos | idem #5 | **CRITICO** | Faturamento / NF |
| 9 | `client_sales` | Authorized roles can insert sales | INSERT | ceo,consultor_comercial,financeiro,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role) OR has_role(auth.uid(), 'financeiro'::user_role) OR has_role(auth.uid(), 'gestor_ads'::user_role) OR has_role(auth.uid(), 'gestor_projetos'::user_role) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)` | **CRITICO** | Vendas registradas |
| 10 | `client_sales` | Authorized roles can view all sales | SELECT | idem | idem | **CRITICO** | Vendas registradas |
| 11 | `clients` | Ads Manager can update assigned clients | UPDATE | gestor_ads | `is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role)` + `AND (assigned_ads_manager = auth.uid())` **preservar clause específica** | **CRITICO** | CRUD clientes |
| 12 | `clients` | Consultor Comercial can view all clients | SELECT | consultor_comercial | `is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role)` | **CRITICO** | CRUD clientes |
| 13 | `clients` | Financeiro can update clients for churn workflow | UPDATE | financeiro | `is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role)` | **CRITICO** | CRUD clientes |
| 14 | `clients` | Financeiro can view all clients | SELECT | financeiro | idem #13 | **CRITICO** | CRUD clientes |
| 15 | `clients` | Gestor de Projetos can view clients in their group | SELECT | gestor_projetos | `is_admin(auth.uid()) OR (has_role(auth.uid(), 'gestor_projetos'::user_role) AND group_id = get_user_group_id(auth.uid()))` **preservar group scope** | **CRITICO** | CRUD clientes |
| 16 | `clients` | Outbound can view all clients | SELECT | outbound | `is_admin(auth.uid()) OR has_role(auth.uid(), 'outbound'::user_role)` | **CRITICO** | CRUD clientes |
| 17 | `clients` | Sucesso do Cliente can update clients for CX validation | UPDATE | sucesso_cliente | `is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)` | **CRITICO** | CRUD clientes |
| 18 | `clients` | Sucesso do Cliente can view all clients | SELECT | sucesso_cliente | idem #17 | **CRITICO** | CRUD clientes |
| 19 | `comercial_tasks` | comercial_tasks_delete | DELETE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **CRITICO** | Kanban comercial |
| 20 | `comercial_tasks` | comercial_tasks_select | SELECT | ceo,gestor_projetos | `is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_projetos'::user_role)` | **CRITICO** | Kanban comercial |
| 21 | `cs_action_plans` | CS and CEO can create action plans | INSERT | ceo,gestor_projetos,sucesso_cliente | `is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_projetos'::user_role) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)` | **CRITICO** | Planos ação sucesso cliente |
| 22 | `cs_action_plans` | CS and CEO can delete action plans | DELETE | idem | idem | **CRITICO** | Planos ação sucesso cliente |
| 23 | `cs_action_plans` | CS and CEO can update action plans | UPDATE | idem | idem | **CRITICO** | Planos ação sucesso cliente |
| 24 | `design_briefings` | design_briefings_delete | DELETE | ceo,design,gestor_ads,gestor_projetos | `is_admin(auth.uid()) OR has_role(..., 'design') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos')` | **CRITICO** | Briefings departamento |
| 25 | `design_briefings` | design_briefings_insert | INSERT | idem | idem | **CRITICO** | Briefings departamento |
| 26 | `design_briefings` | design_briefings_update | UPDATE | idem | idem | **CRITICO** | Briefings departamento |
| 27 | `dev_briefings` | dev_briefings_delete | DELETE | ceo,devs,gestor_ads,gestor_projetos | `is_admin(auth.uid()) OR has_role(..., 'devs') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos')` | **CRITICO** | Briefings departamento |
| 28 | `dev_briefings` | dev_briefings_insert | INSERT | ceo,devs,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(auth.uid()) OR has_role(..., 'devs') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **CRITICO** | Briefings departamento |
| 29 | `dev_briefings` | dev_briefings_update | UPDATE | idem #28 | idem #28 | **CRITICO** | Briefings departamento |
| 30 | `produtora_briefings` | produtora_briefings_delete | DELETE | ceo,gestor_ads,gestor_projetos,produtora | `is_admin(...) OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'produtora')` | **CRITICO** | Briefings departamento |
| 31 | `produtora_briefings` | produtora_briefings_insert | INSERT | +sucesso_cliente | idem #30 + `has_role(..., 'sucesso_cliente')` | **CRITICO** | Briefings departamento |
| 32 | `produtora_briefings` | produtora_briefings_update | UPDATE | idem #31 | idem #31 | **CRITICO** | Briefings departamento |
| 33 | `video_briefings` | video_briefings_delete | DELETE | ceo,editor_video,gestor_ads,gestor_projetos | `is_admin(...) OR has_role(..., 'editor_video') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos')` | **CRITICO** | Briefings departamento |
| 34 | `video_briefings` | video_briefings_insert | INSERT | idem | idem | **CRITICO** | Briefings departamento |
| 35 | `video_briefings` | video_briefings_update | UPDATE | idem | idem | **CRITICO** | Briefings departamento |
| 36 | `ads_task_comments` | Users can view comments on tasks they can access | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` **mantém EXISTS de ownership** | **ALTO** | Comentários task ADS |
| 37 | `ads_task_delay_justifications` | Authorized roles can view justifications by role | SELECT | ceo,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Justificativas atraso |
| 38 | `ads_task_delay_justifications` | CEO can view all justifications | SELECT | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 39 | `ads_task_delay_justifications` | Only CEO can archive justifications | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 40 | `ads_task_delay_notifications` | Admins podem deletar notificações | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 41 | `ads_task_delay_notifications` | Notificações de atraso visíveis para cargos específicos | SELECT | ceo,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações atraso |
| 42 | `ads_task_delay_notifications` | Usuários autenticados podem inserir notificações | INSERT | idem | idem | **ALTO** | Notificações atraso |
| 43 | `card_attachments` | card_attachments_delete | DELETE | ceo,devs,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'devs') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Kanban anexos |
| 44 | `card_attachments` | card_attachments_insert | INSERT | idem | idem | **ALTO** | Kanban anexos |
| 45 | `churn_notifications` | Authorized roles can insert churn notifications | INSERT | ceo,financeiro,gestor_projetos | `is_admin(...) OR has_role(..., 'financeiro') OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações churn |
| 46 | `churn_notifications` | Users with specific roles can view churn notifications | SELECT | 6 roles | `is_admin(...) OR has_role(..., 'consultor_comercial') OR has_role(..., 'financeiro') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações churn |
| 47 | `comercial_client_documentation` | CEO pode ver todas documentações comercial | SELECT | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Documentação comercial |
| 48 | `comercial_client_documentation` | Gestor Projetos pode ver todas doc comercial | SELECT | gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Documentação comercial |
| 49 | `comercial_delay_justifications` | comercial_just_select | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Justificativas atraso |
| 50 | `comercial_delay_justifications` | comercial_just_update | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 51 | `comercial_delay_notifications` | comercial_delay_notif_delete | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 52 | `comercial_delay_notifications` | comercial_delay_notif_insert | INSERT | ceo,consultor_comercial,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'consultor_comercial') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações atraso |
| 53 | `comercial_delay_notifications` | comercial_delay_notif_select | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações atraso |
| 54 | `design_completion_notifications` | System can insert notifications | INSERT | 5 roles | `is_admin(...) OR has_role(..., 'design') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações completion |
| 55 | `design_delay_justifications` | Authorized roles can view justifications | SELECT | 5 roles | idem #54 | **ALTO** | Justificativas atraso |
| 56 | `design_delay_justifications` | CEO can archive justifications | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 57 | `design_delay_notifications` | Admins can delete notifications | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 58 | `design_delay_notifications` | Authorized roles can view notifications | SELECT | 5 roles | idem #54 | **ALTO** | Notificações atraso |
| 59 | `design_delay_notifications` | System can insert notifications | INSERT | 5 roles | idem #54 | **ALTO** | Notificações atraso |
| 60 | `dev_completion_notifications` | dev_completion_notifications_insert | INSERT | ceo,devs,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'devs') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações completion |
| 61 | `dev_delay_justifications` | dev_delay_justifications_select | SELECT | idem #60 | idem #60 | **ALTO** | Justificativas atraso |
| 62 | `dev_delay_justifications` | dev_delay_justifications_update | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 63 | `dev_delay_notifications` | dev_delay_notifications_delete | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 64 | `dev_delay_notifications` | dev_delay_notifications_insert | INSERT | idem #60 | idem #60 | **ALTO** | Notificações atraso |
| 65 | `dev_delay_notifications` | dev_delay_notifications_select | SELECT | idem #60 | idem #60 | **ALTO** | Notificações atraso |
| 66 | `outbound_justifications` | Admin can view all outbound justifications | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Justificativas outbound |
| 67 | `outbound_new_client_notifications` | Outbound managers can view notifications | SELECT | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações novo cliente |
| 68 | `outbound_task_comments` | Users can view outbound task comments | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Comentários outbound |
| 69 | `outbound_task_delay_justifications` | Users can update own outbound justifications | UPDATE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` **mantém ownership clause** | **ALTO** | Justificativas atraso |
| 70 | `outbound_task_delay_justifications` | Users can view own outbound justifications | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Justificativas atraso |
| 71 | `outbound_task_delay_notifications` | Admin can delete outbound delay notifications | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 72 | `outbound_task_delay_notifications` | Authenticated can insert outbound delay notifications | INSERT | ceo,gestor_projetos,outbound,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'outbound') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações atraso |
| 73 | `outbound_task_delay_notifications` | Outbound delay notifications visible to allowed roles | SELECT | idem #72 | idem #72 | **ALTO** | Notificações atraso |
| 74 | `produtora_delay_justifications` | produtora_delay_justifications_select | SELECT | 6 roles | `is_admin(...) OR has_role(..., 'editor_video') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'produtora') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Justificativas atraso |
| 75 | `produtora_delay_justifications` | produtora_delay_justifications_update | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 76 | `produtora_delay_notifications` | produtora_delay_notifications_delete | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 77 | `produtora_delay_notifications` | produtora_delay_notifications_insert | INSERT | idem #74 | idem #74 | **ALTO** | Notificações atraso |
| 78 | `produtora_delay_notifications` | produtora_delay_notifications_select | SELECT | idem #74 | idem #74 | **ALTO** | Notificações atraso |
| 79 | `task_delay_justifications` | Authorized roles can view justifications by role | SELECT | ceo,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Justificativas atraso (genérica) |
| 80 | `task_delay_justifications` | CEO can update any justification | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 81 | `video_completion_notifications` | System can insert video completion notifications | INSERT | ceo,editor_video,gestor_ads,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'editor_video') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **ALTO** | Notificações completion |
| 82 | `video_delay_justifications` | Authorized roles can view video justifications | SELECT | idem #81 | idem #81 | **ALTO** | Justificativas atraso |
| 83 | `video_delay_justifications` | CEO can archive video justifications | UPDATE | ceo | `is_executive(auth.uid()) OR is_admin(auth.uid())` | **ALTO** | Justificativas atraso |
| 84 | `video_delay_notifications` | Admins can delete video delay notifications | DELETE | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **ALTO** | Notificações atraso |
| 85 | `video_delay_notifications` | Authorized roles can view video delay notifications | SELECT | idem #81 | idem #81 | **ALTO** | Notificações atraso |
| 86 | `video_delay_notifications` | System can insert video delay notifications | INSERT | idem #81 | idem #81 | **ALTO** | Notificações atraso |
| 87 | `client_daily_tracking` | Sucesso do Cliente can view all tracking | SELECT | sucesso_cliente | `is_admin(...) OR has_role(..., 'sucesso_cliente')` | **MEDIO** | Tracking CS |
| 88 | `comercial_daily_documentation` | comercial_doc_select | SELECT | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **MEDIO** | Documentação diária |
| 89 | `comercial_tracking` | comercial_tracking_select | SELECT | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **MEDIO** | Tracking comercial |
| 90 | `commission_records` | System can insert commissions | INSERT | 6 roles | `is_admin(...) OR has_role(..., 'consultor_comercial') OR has_role(..., 'financeiro') OR has_role(..., 'gestor_ads') OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **MEDIO** | Comissões |
| 91 | `cs_action_manuals` | Authorized roles can manage CS action manuals | ALL | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **MEDIO** | Manuais CS |
| 92 | `cs_action_plan_tasks` | CS and CEO can manage action plan tasks | ALL | idem | idem | **MEDIO** | Tasks CS plan |
| 93 | `cs_contact_history` | Authorized roles can manage CS contact history | ALL | idem | idem | **MEDIO** | Histórico CS |
| 94 | `cs_insights` | Authorized roles can manage CS insights | ALL | idem | idem | **MEDIO** | Insights CS |
| 95 | `financeiro_custos_produto` | Custos manageable by CEO and financeiro | ALL | ceo,financeiro,gestor_projetos | `is_admin(...) OR has_role(..., 'financeiro') OR has_role(..., 'gestor_projetos')` | **MEDIO** | DRE |
| 96 | `financeiro_dre` | DRE manageable by CEO and financeiro | ALL | idem | idem | **MEDIO** | DRE |
| 97 | `financeiro_produto_departamentos` | Departamentos manageable by CEO and financeiro | ALL | idem | idem | **MEDIO** | DRE |
| 98 | `financeiro_produtos` | Produtos manageable by CEO and financeiro | ALL | idem | idem | **MEDIO** | DRE |
| 99 | `financeiro_receita_produto` | Receita manageable by CEO and financeiro | ALL | idem | idem | **MEDIO** | DRE |
| 100 | `nps_responses` | CEO and CS can view responses | SELECT | ceo,sucesso_cliente | `is_admin(...) OR has_role(..., 'sucesso_cliente')` | **MEDIO** | NPS |
| 101 | `nps_surveys` | CEO and CS can manage surveys | ALL | idem | idem | **MEDIO** | NPS |
| 102 | `outbound_daily_documentation` | Admin can view all outbound documentation | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **MEDIO** | Documentação outbound |
| 103 | `outbound_meetings` | Admin can manage outbound meetings | ALL | ceo,gestor_projetos | `is_admin(...) OR has_role(..., 'gestor_projetos')` | **MEDIO** | Reuniões outbound |
| 104 | `outbound_tasks` | Admin can view all outbound tasks | SELECT | ceo,gestor_projetos,sucesso_cliente | `is_admin(...) OR has_role(..., 'gestor_projetos') OR has_role(..., 'sucesso_cliente')` | **MEDIO** | Tasks outbound |
| 105 | `profiles` | Consultor Comercial can view all profiles | SELECT | consultor_comercial | `is_admin(...) OR has_role(..., 'consultor_comercial')` | **MEDIO** | Visão perfis |
| 106 | `profiles` | Design can view all profiles | SELECT | design | `is_admin(...) OR has_role(..., 'design')` | **MEDIO** | Visão perfis |
| 107 | `profiles` | Devs can view all profiles | SELECT | devs | `is_admin(...) OR has_role(..., 'devs')` | **MEDIO** | Visão perfis |
| 108 | `profiles` | Editor Video can view all profiles | SELECT | editor_video | `is_admin(...) OR has_role(..., 'editor_video')` | **MEDIO** | Visão perfis |
| 109 | `profiles` | Financeiro can view all profiles | SELECT | financeiro | `is_admin(...) OR has_role(..., 'financeiro')` | **MEDIO** | Visão perfis |
| 110 | `profiles` | Gestor CRM can view all profiles | SELECT | gestor_crm | `is_admin(...) OR has_role(..., 'gestor_crm')` | **MEDIO** | Visão perfis |
| 111 | `profiles` | Gestor de Ads can view all profiles | SELECT | gestor_ads | `is_admin(...) OR has_role(..., 'gestor_ads')` | **MEDIO** | Visão perfis |
| 112 | `profiles` | Outbound can view all profiles | SELECT | outbound | `is_admin(...) OR has_role(..., 'outbound')` | **MEDIO** | Visão perfis |
| 113 | `profiles` | RH can view all profiles | SELECT | rh | `is_admin(...) OR has_role(..., 'rh')` | **MEDIO** | Visão perfis |
| 114 | `profiles` | Sucesso do Cliente can view all profiles | SELECT | sucesso_cliente | `is_admin(...) OR has_role(..., 'sucesso_cliente')` | **MEDIO** | Visão perfis |

> CSV completo (114 linhas) em [[rls-literal-role-policies.csv]] — colunas: schema, table, policy, cmd, qual, with_check, literal_roles, proposed_helper, risk, flow_impact. Usar esse CSV para scripting da migration A.3.

---

## Seção 4. Top 10 críticas — SQL atual vs. proposto

### 1. `clients` — Ads Manager can update assigned clients (UPDATE)

**Roles literais**: `gestor_ads` (EXISTS form)
**Fluxo bloqueado**: CRUD clientes — admin sem role `gestor_ads` não atualiza cliente assigned.

**Atual**:
```sql
USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'gestor_ads'::user_role)))) AND (assigned_ads_manager = auth.uid())))
WITH CHECK (idem)
```

**Proposto** (preserva clause de ownership):
```sql
USING (
  is_admin(auth.uid())
  OR (has_role(auth.uid(), 'gestor_ads'::user_role) AND assigned_ads_manager = auth.uid())
)
WITH CHECK (
  is_admin(auth.uid())
  OR (has_role(auth.uid(), 'gestor_ads'::user_role) AND assigned_ads_manager = auth.uid())
)
```

---

### 2. `clients` — Consultor Comercial can view all clients (SELECT)

**Atual**:
```sql
USING (has_role(auth.uid(), 'consultor_comercial'::user_role))
```

**Proposto**:
```sql
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role))
```

---

### 3. `clients` — Financeiro can update clients for churn workflow (UPDATE)

**Atual**:
```sql
USING (has_role(auth.uid(), 'financeiro'::user_role))
```

**Proposto**:
```sql
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role))
```

---

### 4. `clients` — Financeiro can view all clients (SELECT)

**Atual / Proposto**: idem #3 com cmd SELECT.

---

### 5. `clients` — Gestor de Projetos can view clients in their group (SELECT)

**Atual**:
```sql
USING (has_role(auth.uid(), 'gestor_projetos'::user_role) AND group_id = get_user_group_id(auth.uid()))
```

**Proposto** (preserva scope de grupo pra gestor, abre total pra admin):
```sql
USING (
  is_admin(auth.uid())
  OR (has_role(auth.uid(), 'gestor_projetos'::user_role) AND group_id = get_user_group_id(auth.uid()))
)
```

---

### 6. `clients` — Sucesso do Cliente can update clients for CX validation (UPDATE)

**Atual**:
```sql
USING (has_role(auth.uid(), 'sucesso_cliente'::user_role))
WITH CHECK (has_role(auth.uid(), 'sucesso_cliente'::user_role))
```

**Proposto**:
```sql
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
```

---

### 7. `client_invoices` — Financeiro pode ver/criar/atualizar/deletar faturamentos (4 policies)

**Padrão atual** (idêntico nas 4 policies, só difere cmd):
```sql
USING (EXISTS ( SELECT 1
   FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['financeiro'::user_role, 'gestor_projetos'::user_role, 'ceo'::user_role])))
```

**Proposto** (aplicável aos 4):
```sql
-- USING para SELECT/UPDATE/DELETE
USING (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'financeiro'::user_role)
  OR has_role(auth.uid(), 'gestor_projetos'::user_role)
)
-- WITH CHECK para INSERT/UPDATE
WITH CHECK (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'financeiro'::user_role)
  OR has_role(auth.uid(), 'gestor_projetos'::user_role)
)
```

---

### 8. `client_sales` — Authorized roles can view all sales (SELECT) + insert

**Atual**:
```sql
USING (EXISTS ( SELECT 1
   FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'sucesso_cliente'::user_role, 'financeiro'::user_role, 'consultor_comercial'::user_role, 'gestor_ads'::user_role])))
```

**Proposto**:
```sql
USING (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'gestor_projetos'::user_role)
  OR has_role(auth.uid(), 'sucesso_cliente'::user_role)
  OR has_role(auth.uid(), 'financeiro'::user_role)
  OR has_role(auth.uid(), 'consultor_comercial'::user_role)
  OR has_role(auth.uid(), 'gestor_ads'::user_role)
)
```

---

### 9. `comercial_tasks` — comercial_tasks_select (SELECT)

**Atual**:
```sql
USING (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role])))
```

**Proposto**:
```sql
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_projetos'::user_role))
```

---

### 10. `cs_action_plans` — CS and CEO can create/update/delete action plans (3 policies)

**Atual**:
```sql
USING (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['ceo'::user_role, 'sucesso_cliente'::user_role, 'gestor_projetos'::user_role])))
```

**Proposto** (aplicável aos 3):
```sql
USING (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'sucesso_cliente'::user_role)
  OR has_role(auth.uid(), 'gestor_projetos'::user_role)
)
WITH CHECK (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'sucesso_cliente'::user_role)
  OR has_role(auth.uid(), 'gestor_projetos'::user_role)
)
```

---

## Seção 5. Padrões encontrados

### Padrão A — `EXISTS ... user_roles ... role = ANY(ARRAY['ceo', 'X', 'Y'])`

Dominante em `client_invoices`, `client_sales`, `cs_action_plans`, `comercial_tasks`, `*_briefings`, `*_delay_*` (~55 policies).

**Transformação canônica**:
```sql
-- antes
EXISTS ( SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['ceo'::user_role, 'R1'::user_role, 'R2'::user_role]))

-- depois (ceo vira is_admin; demais viram has_role)
is_admin(auth.uid())
  OR has_role(auth.uid(), 'R1'::user_role)
  OR has_role(auth.uid(), 'R2'::user_role)
```

### Padrão B — `has_role(auth.uid(), 'X'::user_role)` isolado

Dominante em `clients`, `profiles`, `client_daily_tracking`, `nps_*` (~40 policies).

**Transformação canônica**:
```sql
-- antes
has_role(auth.uid(), 'X'::user_role)

-- depois
is_admin(auth.uid()) OR has_role(auth.uid(), 'X'::user_role)
```

### Padrão C — `EXISTS ... user_roles ... role = 'ceo'::user_role` solo

Menor volume (~6 policies): policies "CEO can archive", "CEO can update any justification", etc.

**Transformação canônica**:
```sql
-- antes
EXISTS ( SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'ceo'::user_role)

-- depois
is_executive(auth.uid()) OR is_admin(auth.uid())
```

> **Nota**: quando a intenção é restringir a "executivos" (CEO real + CTO), use `is_executive`. Quando é "qualquer admin operacional" (inclui gestor_projetos), use `is_admin`. Em caso de ambiguidade, preferir `is_admin` — é o superset mais seguro.

### Padrão D — Clause composta (role + ownership/grupo)

Ex.: `has_role('gestor_ads') AND assigned_ads_manager = auth.uid()`. Requer cuidado: **não** colapsar. Apenas adicionar `is_admin(auth.uid()) OR (...clause original...)`.

---

## Seção 6. Helpers novos propostos

Critério: 10+ policies usando o mesmo role literal.

| role | ocorrências | propor helper? | nome |
|---|---|---|---|
| `gestor_projetos` | 84 | **SIM** | `is_gestor_projetos(uuid)` |
| `sucesso_cliente` | 56 | **SIM** | `is_sucesso_cliente(uuid)` |
| `gestor_ads` | 42 | **SIM** | `is_gestor_ads(uuid)` |
| `financeiro` | 17 | **SIM** | `is_financeiro(uuid)` |
| `editor_video` | 11 | **SIM** | `is_editor_video(uuid)` |
| `devs` | 10 | **SIM** | `is_devs(uuid)` |
| `design` | 8 | não | — |
| `consultor_comercial` | 7 | não | — |

> [!note] Decisão: **NÃO criar helpers por role nesta fase**.
> Criar 6 helpers novos multiplica superfície de manutenção sem ganho real — `has_role(uid, 'X'::user_role)` já é helper por si (SECURITY DEFINER, cacheável). A única razão real para criar `is_X` específico seria se a lógica de "é X" ficasse mais rica (ex.: "é financeiro OU admin OU tem flag Z") — ainda não é o caso.
>
> **Revisitar pós-A.3**: se a migration ficar repetitiva e a wiki de papéis evoluir para regras compostas por departamento, criar batch de helpers em migration dedicada. Por ora: `is_admin(auth.uid()) OR has_role(auth.uid(), 'X'::user_role)` é o padrão.

---

## Seção 7. Plano de execução da migration A.3

### Estratégia recomendada: **uma migration única** com blocos por tabela

**Arquivo**: `supabase/migrations/20260420210000_rls_role_helpers_migration.sql`

**Justificativa**:
- 114 policies, 55 tabelas. Dividir em 55 migrations sequenciais triplica ruído em PR sem ganho operacional — são todas não-destrutivas (ALTER POLICY via DROP+CREATE não perde dados).
- Transação única → rollback trivial se alguma policy falhar.
- Mais fácil auditar em uma única leitura.

### Estrutura da migration

```sql
-- 20260420210000_rls_role_helpers_migration.sql
--
-- Wave 1 Track A.3 — Corrige 114 policies que usavam literal de role
-- sem cobertura de is_admin/is_executive/is_ceo. Incidente CTO expôs que
-- executivos sem role nomeada em user_roles eram silenciosamente bloqueados.
-- Ver docs/wiki/00-Arquitetura/Auditoria RLS Literal Role 2026-04-20.md
-- para inventário detalhado e rationale por policy.

BEGIN;

-- Bloco 1: clients (8 policies CRITICO)
DROP POLICY IF EXISTS "Ads Manager can update assigned clients" ON public.clients;
CREATE POLICY "Ads Manager can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR (has_role(auth.uid(), 'gestor_ads'::user_role) AND assigned_ads_manager = auth.uid())
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR (has_role(auth.uid(), 'gestor_ads'::user_role) AND assigned_ads_manager = auth.uid())
  );

-- ... (mais 7 policies clients)

-- Bloco 2: client_invoices (4)
-- Bloco 3: client_sales (2)
-- Bloco 4: cs_action_plans (3)
-- Bloco 5: comercial_tasks (2)
-- Bloco 6: *_briefings (15 — atrizes/design/dev/produtora/video × 3)
-- Bloco 7: *_delay_notifications + *_delay_justifications + *_completion_notifications (ALTO)
-- Bloco 8: outbound_* (ALTO)
-- Bloco 9: financeiro_* dashboards (MEDIO)
-- Bloco 10: cs_* auxiliares (MEDIO)
-- Bloco 11: profiles (10 — MEDIO)
-- Bloco 12: residual (ads_task_comments, card_attachments, churn_notifications, etc.)

COMMIT;
```

### Ordem para evitar estado intermediário inconsistente

Dentro de uma transação única, ordem é indiferente para coerência (atomicidade garante). Mas para **facilitar revisão**:

1. `clients` primeiro (entidade raiz).
2. Entidades dependentes diretas: `client_invoices`, `client_sales`, `cs_action_plans`, `comercial_tasks`, `*_briefings`.
3. Notificações/justificativas (auxiliares).
4. Dashboards financeiros.
5. `profiles` por último (maior volume, risco mais baixo).

### Estratégia DROP-all-then-CREATE-all?

**Não recomendado**. Motivos:
- Janela de vulnerabilidade: entre DROP e CREATE, se outra transação abrir, vê tabela com RLS ON mas **sem policies** → tudo bloqueado para não-admin. É pior do que estado atual.
- Em transação única o problema some, mas obriga lock pesado em muitas tabelas simultaneamente.
- DROP+CREATE por policy individual, sequencial, é mais seguro e mais legível.

### Safeguards obrigatórios na migration

1. `BEGIN;` / `COMMIT;` envolvendo tudo.
2. Cada `CREATE POLICY` precedido de `DROP POLICY IF EXISTS` com nome idêntico (evita erro se migration for reaplicada).
3. Adicionar `TO authenticated` explícito em toda policy criada (várias atuais não têm — vulnerável a invocação anônima via PostgREST).
4. Para policies com scope composto (grupo, ownership), **preservar a clause** — `is_admin(...) OR (clause original)`.
5. Ao final do bloco, rodar:
   ```sql
   DO $$
   DECLARE
     v_count int;
   BEGIN
     SELECT count(*) INTO v_count FROM pg_policy WHERE polname LIKE '%'; -- placeholder
     RAISE NOTICE 'Policies afetadas: %', v_count;
   END$$;
   ```
   Para confirmar no log de aplicação.

### Pós-migration — validação

1. **pgTAP** (Track A.4): suite para cada policy crítica verificando que:
   - admin (ceo + is_admin + is_executive + cto) vê/edita TUDO em `clients`/`client_invoices`/`client_sales`.
   - role funcional (ex.: `financeiro`) mantém acesso esperado.
   - role sem permissão é bloqueada.
2. **Smoke E2E** Wave 2: CTO login → dashboard CS carrega, cliente TESTE 01 aparece, editar invoice não dá 403.
3. **Dry-run contra `supabase db diff --linked`** pra revisar SQL antes de `supabase db push`.

---

## Seção 8. Dados crus

- **CSV completo**: [[rls-literal-role-policies.csv]] (114 linhas, 10 colunas)
- Colunas: `schema, table, policy, cmd, qual, with_check, literal_roles, proposed_helper, risk, flow_impact`
- JSON bruto (não commitado): `/tmp/rls_all_policies.json` (456 policies), `/tmp/rls_flagged_v2.json` (114 flaggadas com full context).
- Script reprodutivo de análise: `/tmp/analyze_rls_v2.py` (não commitado — pode ser movido para `scripts/audit/` se a wiki aprovar).

---

## Handoff

- **Segurança**: revisar Top 10 críticas (Seção 4) + padrões (Seção 5). Confirmar decisão sobre `is_admin` vs. `is_executive` nos casos Padrão C.
- **DB Specialist (próxima fase — Track A.3)**: escrever migration conforme Seção 7. Rodar localmente antes de prod.
- **QA (Track A.4 + Wave 2)**: suite pgTAP para os 35 criticos + smoke E2E CTO.
- **Engenheiro (Wave 1 parallel)**: nenhum impacto direto em hooks — policies mudam, contratos não. `useClients`, `useClientInvoices`, `useClientSales`, `useCsActionPlans` continuam idênticos.

## Referências

- [[Supabase e RLS]] — doutrina geral
- [[Hierarquia Executiva]] — contexto do incidente CTO
- [[Funções RLS]] — inventário dos helpers disponíveis
- `supabase/migrations/20260420*_wave0_hotfix*.sql` — fix das 11 policies já corrigidas
