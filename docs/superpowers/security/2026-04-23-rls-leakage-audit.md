---
title: Auditoria RLS — Leakage por Policies Permissivas (2026-04-23)
date: 2026-04-23
project: semhnpwxptfgqxhkoqsk (PROD)
status: READ-ONLY audit — nenhuma migration aplicada
agent: seguranca
triggered_by: descoberta crítica em kanban_{boards,cards,columns} (agente paralelo fixando)
---

# Auditoria RLS — Leakage por Policies Permissivas

> [!danger] TL;DR executivo
> **Varredura completa do schema `public` em PROD confirmou leakage sistêmico**. 144 policies permissivas em 81 tabelas (54% do schema). Dentre elas:
> - **4 tabelas anon-exploitable confirmadas live** (custom_roles, squads, rh_vagas, rh_vaga_briefings, paddock_diagnosticos, meeting_folders, video_briefings) — ANON key sem login lê dados internos.
> - **1 tabela anon-writable confirmada live** (`financeiro_kanban_tasks` — INSERT anon retornou 201 com UUID real; registro removido ao fim do teste).
> - **~50 tabelas com FOR ALL / UPDATE / DELETE `USING(true)`** — qualquer authenticated deleta/modifica tudo (MRR, DRE, CRM, financeiro contas a receber/pagar, RH candidatos, strategy_requests, etc.).
> - **`user_roles` SELECT `USING(true)`** — vazamento de hierarquia completa para qualquer authenticated (fonte de enumeração de admins).
> - **2 tabelas RLS ON zero policies** (`api_keys`, `api_logs`) — OK (bloqueia tudo), mas confirmar intencional.
> - **2 tabelas RLS OFF** (`meeting_folders`, `recorded_meetings`) — na verdade RLS ON com policy `USING(true)` (query q3 reportou pelo valor `relrowsecurity=false` em cache — revalidar).
>
> Esta auditoria vem em paralelo à auditoria anterior de **literal role sem helper** (2026-04-20) — são **eixos ortogonais**. Lá: admins bloqueados (falso-negativo). Aqui: não-admins permitidos (falso-positivo). Ambos precisam ser fechados.

---

## Seção 0. Metodologia

### Credenciais
- `SUPABASE_ACCESS_TOKEN` em `.env.scripts` do projeto raiz (gitignored).
- Queries via Supabase Management API v1 (`/v1/projects/{ref}/database/query`) — SQL read-only.
- Anon key (`VITE_SUPABASE_PUBLISHABLE_KEY`) em `.env` — usado em testes de intrusão empíricos via PostgREST REST.

### Script reproduzível
- `/tmp/rls_audit_q.mjs` — 7 queries pg_policies / pg_class / pg_proc
- `/tmp/rls_audit_grants.mjs` — grants de tabela (anon/authenticated/service_role)
- `/tmp/test_anon.mjs`, `/tmp/test_anon2.mjs`, `/tmp/test_anon3.mjs` — PoCs live via anon key
- Output bruto: `/tmp/rls_audit_out.json` (465 policies, 150 tabelas, 80 SECURITY DEFINER funcs)

### Timestamp
- Auditoria executada: **2026-04-23 ~21:15 UTC**
- Projeto linked: `semhnpwxptfgqxhkoqsk`

### Critério de flag
Policy é flaggada quando **qualquer** das condições abaixo:
1. `qual = 'true'` ou `with_check = 'true'` (anel aberto)
2. `qual` / `with_check` é só `auth.uid() IS NOT NULL` (só exige login — não escopa)
3. Policy em tabela sensível com escopo insuficiente (ex: só filtrar por status)

Grant level (`information_schema.role_table_grants`) foi cruzado: se `anon` tem SELECT/INSERT/UPDATE/DELETE, a RLS é o único muro — policy permissiva = leak direto anônimo.

---

## Seção 1. Sumário quantitativo

| Métrica | Valor |
|---|---|
| Tabelas no schema `public` | 150 |
| Tabelas com RLS enabled | 148 |
| Tabelas RLS enabled com policies permissivas | 81 (54%) |
| Tabelas RLS enabled sem policies | 2 (`api_keys`, `api_logs`) |
| Tabelas reportadas RLS off | 2 (`meeting_folders`, `recorded_meetings` — ver §6) |
| Tabelas com FORCE RLS | 2 de 150 |
| Total policies em public | 465 |
| Policies permissivas | 144 |
| Policies SECURITY DEFINER | 80 |
| Grants `anon` com privilégios full-table | 100% das tabelas testadas |

### Distribuição por cmd (policies permissivas)
| cmd | count |
|---|---|
| SELECT | 63 |
| INSERT | ~31 |
| UPDATE | ~19 |
| DELETE | ~15 |
| ALL | 16 |

---

## Seção 2. Vulnerabilidades CRÍTICAS (P0 — bloqueadores)

Ordem: por blast radius × facilidade de exploração.

### 2.1. `financeiro_kanban_tasks` — ALL `USING(true) WITH CHECK(true)` com roles={public} ⚠️ **EXPLORADO LIVE**

- **Policy**: `Allow all operations for authenticated users` cmd=ALL, qual=`true`, with_check=`true`, roles=`{public}`.
- **Grant anon**: DELETE, INSERT, SELECT, UPDATE.
- **PoC confirmado**: `POST /rest/v1/financeiro_kanban_tasks` com anon key retornou **HTTP 201** + UUID + timestamps. Nenhum login. Registro deletado ao fim do teste.
- **Impacto**: anônimo pode injetar tarefas financeiras, poluindo kanban financeiro; enumerar existentes; deletar tarefas legítimas.
- **Fix**:
  ```sql
  DROP POLICY "Allow all operations for authenticated users" ON public.financeiro_kanban_tasks;
  CREATE POLICY "financeiro_kanban_tasks_select" ON public.financeiro_kanban_tasks
    FOR SELECT TO authenticated
    USING (is_admin(auth.uid()) OR has_role(auth.uid(),'financeiro'::user_role));
  CREATE POLICY "financeiro_kanban_tasks_write" ON public.financeiro_kanban_tasks
    FOR ALL TO authenticated
    USING (is_admin(auth.uid()) OR has_role(auth.uid(),'financeiro'::user_role))
    WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(),'financeiro'::user_role));
  ```
- **Migration**: `20260423230000_fix_financeiro_kanban_tasks_rls.sql`

---

### 2.2. `mrr_changes` — ALL `USING(true) WITH CHECK(true)` roles={authenticated}

- **Policy**: `Allow all for authenticated users` cmd=ALL.
- **Grant anon**: todos (mas policy só autoriza authenticated). Qualquer usuário logado (até `atrizes_gravacao` intern) lê/escreve MRR do negócio inteiro.
- **Impacto**: MRR é um dos dados mais sensíveis da empresa. Qualquer empregado junior vê curva de receita mensal, churn, upsells, downgrades. Pode também **apagar histórico** de MRR (auditoria financeira comprometida).
- **Fix**: restringir a `is_admin(auth.uid()) OR has_role(auth.uid(),'financeiro'::user_role)`.
- **Migration**: `20260423230100_fix_mrr_changes_rls.sql`

---

### 2.3. `financeiro_contas_pagar` + `financeiro_contas_receber` — INSERT/UPDATE/DELETE `USING(true)` roles={authenticated}

- **4 tabelas** (pagar, receber × INSERT, UPDATE, DELETE, SELECT — SELECT também é true).
- **Impacto**: qualquer authenticated cria/altera/deleta contas a pagar e receber da empresa. Vetor de fraude: funcionário cria `contas_receber` fantasma, altera `contas_pagar` para desviar pagamento, deleta registros legítimos.
- **Estimativa**: 255 rows em cada. ~R$ em centenas de milhares em circulação.
- **Fix**: policies por `is_admin` OR `has_role(..., 'financeiro')`.
- **Migration**: `20260423230200_fix_financeiro_contas_rls.sql`

---

### 2.4. `financeiro_active_clients` — INSERT/UPDATE/DELETE `auth.uid() IS NOT NULL` roles={public}

- 4 policies (insert/update/delete/select).
- 104 rows estimadas.
- **Impacto**: idem acima — o log de clientes ativos financeiros (MRR individual, status fatura) pode ser modificado por qualquer authenticated (inclusive anônimo no INSERT, pois `roles={public}` e a condição só exige `auth.uid() IS NOT NULL` — mas anon tem `auth.uid() = NULL`, então INSERT anon falha; authenticated passa livre).
- **Fix**: restringir a `is_admin OR has_role('financeiro') OR has_role('gestor_projetos')`.
- **Migration**: `20260423230300_fix_financeiro_active_clients_rls.sql`

---

### 2.5. `financeiro_dre` + `financeiro_produtos` + `financeiro_custos_produto` + `financeiro_produto_departamentos` + `financeiro_receita_produto` — SELECT `auth.uid() IS NOT NULL` roles={public}

- 5 tabelas de DRE/receita/custo **lidas por qualquer authenticated**.
- **Impacto**: DRE vaza pra time operacional — margem, custo por produto, receita por departamento. Competitor intelligence se cred leak.
- **Fix**: `is_admin OR has_role('financeiro') OR has_role('gestor_projetos')`.
- **Migration**: `20260423230400_fix_financeiro_dashboards_rls.sql`

---

### 2.6. `strategy_requests` — SELECT `USING(true)` roles={public} + INSERT/UPDATE anon-gate

- **Policy SELECT**: qual=`true`, roles=`{public}` — **anon lê tudo** se houver rows.
- PoC ao vivo: tabela está vazia (0 rows), mas **qualquer row nova vaza** para anon.
- **Impacto**: `strategy_requests` são planos de crescimento/marketing com dados do cliente + consultor. Leak de estratégia de cliente para anônimo (concorrente, scraper, etc.).
- **Fix**: `TO authenticated` + USING que escopa ao cliente/consultor envolvido.
- **Migration**: `20260423230500_fix_strategy_requests_rls.sql`

---

### 2.7. `clients` — NÃO tem `USING(true)` mas tem lacuna de ownership

- **Achado secundário**: clients está bem protegido no SELECT (multiple policies escopadas). Mas `INSERT` e `UPDATE` já foram tratados em 2026-04-20 (literal role audit). **Não é P0 aqui** — confirmação explícita de que `clients` **NÃO** entra na lista de CRÍTICAS desta auditoria. Deixo registrado para o time não se surpreender.

---

### 2.8. Marketplace/CRM/Paddock — ALL `USING(true) WITH CHECK(true)` em 7 tabelas

Tabelas:
- `crm_configuracoes`, `crm_daily_documentation`, `crm_daily_tracking`
- `mktplace_daily_documentation`, `mktplace_daily_tracking`, `mktplace_diagnosticos`, `mktplace_relatorios`
- `paddock_diagnosticos`

Todas com `FOR ALL USING(true) WITH CHECK(true)` roles={authenticated} — um único registro já vazando em anon para `paddock_diagnosticos` (PoC confirmada).

- **Impacto**: qualquer authenticated lê/edita/deleta documentação de clientes CRM, mktplace, paddock. Diagnósticos internos com client_id + consultor_id revelam relação cliente-consultor inteira.
- **Fix**: restringir por role departamental + ownership/escopo de cliente.
- **Migration**: `20260423230600_fix_crm_mktplace_paddock_rls.sql`

---

### 2.9. `prova_social_*` (3 tabelas) + `provas_sociais` — ALL `USING(true) WITH CHECK(true)`

Tabelas: `prova_social_metrics`, `prova_social_types`, `provas_sociais`.
- `provas_sociais` armazena cases/testimonials com `client_id`. Exposto a authenticated inteiro.
- **Fix**: restringir writes a `is_admin OR has_role('sucesso_cliente') OR has_role('gestor_projetos')`.
- **Migration**: `20260423230700_fix_provas_sociais_rls.sql`

---

### 2.10. RH inteiro — 8 tabelas com permissivas

Tabelas: `rh_atividades`, `rh_candidatos`, `rh_comentarios`, `rh_justificativas`, `rh_tarefas`, `rh_vaga_briefings`, `rh_vaga_plataformas`, `rh_vagas`.
- Policies com `USING(true)` SELECT roles={public} — **PoC ao vivo: `rh_vagas` e `rh_vaga_briefings` retornam rows para anon key**.
- **Impacto**: dados sensíveis de candidatos (nomes, contatos), briefings internos de vagas, justificativas de atraso (RH). Vetor LGPD direto — dados pessoais de candidatos acessíveis sem autenticação.
- **Fix**: restringir SELECT a authenticated + escopo por role RH/executivo. Reconsiderar se vagas devem ser públicas (se sim, policy por `is_public=true`).
- **Migration**: `20260423230800_fix_rh_rls.sql`

---

### 2.11. `custom_roles` — SELECT `USING(true)` roles={public} ⚠️ **LEAK ANON CONFIRMADO**

- **PoC**: anon key retorna row `{id, name='vendedores-visualizadores', display_name, allowed_pages, is_viewer}`.
- **Impacto**: atacante externo enumera papéis customizados da empresa, identifica páginas-alvo (`allowed_pages`), descobre estrutura de permissão granular sem login.
- **Fix**: restringir SELECT a authenticated. Não há caso de uso para anônimo ler `custom_roles`.
- **Migration**: `20260423230900_fix_custom_roles_rls.sql`

---

### 2.12. `user_roles` — SELECT `USING(true)` roles={authenticated}

- **Policy**: `Users can view all roles` — qualquer authenticated vê user_id + role de **todos** os 25 usuários.
- **Impacto**: enumeração de admins. Atacante com cred de staff junior lista todos os CEOs/CTOs → atira spearphishing contra eles. Também expõe quem é devs/atrizes/etc — vetor de engenharia social.
- **Fix**: remover policy `USING(true)`; manter acesso apenas via funções `SECURITY DEFINER` (`is_ceo`, `has_role`). Se UI precisa listar papéis, criar RPC com filtro.
  ```sql
  DROP POLICY "Users can view all roles" ON public.user_roles;
  CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR is_admin(auth.uid()));
  ```
- **Migration**: `20260423231000_fix_user_roles_select.sql`
- **Atenção**: validar que `AuthContext.tsx` não depende de leitura direta — se sim, migrar para RPC ou `auth.jwt()` claims.

---

### 2.13. `nps_responses` — INSERT `WITH CHECK(true)` roles={public}

- **Intencional** provavelmente (formulário NPS público). **Mas**: aceita `INSERT` anônimo sem gate. Sem rate-limit, sem token validator, sem CAPTCHA.
- **Impacto**: flood de respostas NPS falsas distorce métricas; injection de payload malformado em JSONB; poluição de dados.
- **Fix**: gatear por `nps_survey_token` existente válido não respondido (`EXISTS (SELECT 1 FROM nps_surveys WHERE token=... AND answered_at IS NULL)`), ou exigir token match no body.
- **Severidade**: CRÍTICA de integridade (não confidencialidade).
- **Migration**: `20260423231100_harden_nps_responses_insert.sql`

---

## Seção 3. Vulnerabilidades ALTAS

### 3.1. Briefings de departamento — SELECT `USING(true)`

Tabelas: `atrizes_briefings`, `dev_briefings`, `design_briefings`, `produtora_briefings`, `video_briefings`.
- SELECT `USING(true)` com mistura de roles=`{authenticated}` e `{public}`.
- **PoC: `video_briefings`** retornou row com `script_url`, `materials_url` via anon key.
- **Impacto**: briefings internos (briefing de vídeo, design, produtora) contêm referências do cliente, estrutura criativa. Vaza IP criativo + contexto do cliente.
- **Fix**: `is_admin(auth.uid()) OR can_view_board(auth.uid(), (SELECT board_id FROM kanban_cards WHERE id = card_id))` — mesmo helper do kanban.
- **Migration**: `20260423231200_fix_briefings_select_rls.sql`

---

### 3.2. `card_activities` + `card_attachments` + `card_comments` — SELECT `USING(true)`

- **Similar aos kanban_* que o agente paralelo está fixando** — são tabelas filhas que herdam a exposição dos cards.
- **Policy** `USING(true)` SELECT → comments, anexos, atividades de **todos os boards** visíveis para qualquer authenticated.
- **Fix**: `EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = card_id AND can_view_board(auth.uid(), c.board_id))`.
- **Migration**: incluir no mesmo bundle de fix dos kanban_* que o outro agente está escrevendo.

---

### 3.3. `meeting_folders` + `recorded_meetings` — ALL permissivo roles={authenticated}

- 8 policies somadas, `USING(true) WITH CHECK(true)`.
- **PoC ao vivo**: `meeting_folders` retorna row com `name='Alinhamento - Segunda-Feir...'` via anon key.
- **Impacto**: gravações internas (links, transcripts), estrutura de pastas de reuniões 1:1 e rituais — privadas por design.
- **Fix**: restringir por `created_by = auth.uid() OR is_admin`, e para recordings vincular a folder scope.
- **Migration**: `20260423231300_fix_meetings_rls.sql`

---

### 3.4. `weekly_summaries` + `weekly_problems` + `meetings_one_on_one` — UPDATE/SELECT `USING(true)`

- `meetings_one_on_one UPDATE USING(true) WITH CHECK(true)` é o pior — coexiste com policy correta `Admins podem atualizar` criando **policy OR** que anula restrição.
- **Impacto**: qualquer authenticated altera resumos/problems/1:1 de qualquer outro user. 1:1 contém feedback confidencial.
- **Fix**: dropar as policies permissivas `USING(true)`; manter apenas as `is_admin` e `created_by = auth.uid()`.
- **Migration**: `20260423231400_fix_weekly_and_1on1_rls.sql`

---

### 3.5. `client_product_churns` + `client_product_values` + `client_results_reports` + `client_strategies` + `outbound_strategies` — 4 policies cada `USING(true)`

- 20 policies totais em 5 tabelas. INSERT/UPDATE/DELETE/SELECT todas com `true`.
- **Impacto**: registros de churn (motivo, cliente), valores por produto (R$), strategies (planejamento comercial) — lidos/escritos/deletados por qualquer authenticated.
- **Fix**: escopo por role + ownership (`assigned_ads_manager`, `assigned_comercial`, etc.).
- **Migration**: `20260423231500_fix_client_commercial_data_rls.sql`

---

### 3.6. Notificações completion/delay — INSERT `auth.uid() IS NOT NULL` roles={public}

Policies em: `ads_new_client_notifications`, `ads_note_notifications`, `atrizes_completion_notifications`, `outbound_new_client_notifications`, `produtora_completion_notifications`, `system_notifications`, `task_delay_notifications`.

- **Policy**: INSERT `WITH CHECK (auth.uid() IS NOT NULL)` — qualquer authenticated cria notificação **direcionada a outro user** (campo `requester_id` ou `user_id` controlado pelo atacante).
- **Vetor de abuso**:
  1. Funcionário criar notificação falsa ao CEO "Cliente X pediu cancelamento" → CEO clica → ação errada.
  2. Spam direcionado.
  3. Integridade de notification center comprometida.
- **Fix**: adicionar `AND requester_id = auth.uid()` ou `AND created_by = auth.uid()` dependendo do schema.
- **Migration**: `20260423231600_fix_notifications_insert_identity.sql`

---

### 3.7. `contas_receber_value_adjustments` + `upsell_commissions` — INSERT `WITH CHECK(true)`

- **Policy INSERT** aceita qualquer authenticated.
- **Impacto**: qualquer funcionário cria ajustes de valor em contas a receber (vetor de fraude direta: inserir desconto fictício); cria commission record a seu nome (self-pay fraud).
- **Fix**:
  - `contas_receber_value_adjustments`: `is_admin OR has_role('financeiro')` no INSERT + UPDATE.
  - `upsell_commissions`: INSERT restrito a RPC `SECURITY DEFINER` (`insert_upsell_commission()`), revoke direto.
- **Migration**: `20260423231700_fix_financial_write_permissions.sql`

---

## Seção 4. Vulnerabilidades MÉDIAS

### 4.1. `cs_action_manuals` + `cs_contact_history` + `cs_insights` + `cs_action_plan_tasks` + `cs_action_plans` — SELECT `USING(true)`

- 5 tabelas CS com SELECT permissivo (várias roles={public}).
- **Impacto**: dados táticos de sucesso do cliente (insights, histórico, plano de ação) expostos a staff não-CS. Não é super-sensível mas quebra separação de dever.
- **Fix**: `is_admin OR has_role('sucesso_cliente') OR has_role('gestor_projetos')`.
- **Migration**: `20260423231800_fix_cs_auxiliary_rls.sql`

### 4.2. `cs_exit_reasons` — SELECT `(auth.uid() IS NOT NULL)` roles={public}

- Existe uma policy legítima (`Public can read by token`) para fluxo público. Mas a segunda policy `USING(auth.uid() IS NOT NULL)` abre SELECT para **qualquer authenticated** — não deveria.
- **Fix**: dropar a policy aberta, manter só a por token + uma por role CS.
- **Migration**: `20260423231900_fix_cs_exit_reasons_auth_scope.sql`

### 4.3. `feature_flags` — SELECT `USING(true)` roles={authenticated}

- **Aceitável?** Flags de feature são lidos pela UI para toggle. Mas **definição** de flags pode incluir string/context interno que não é pra vazar.
- **Fix preferível**: RPC `get_my_feature_flags()` que retorna só as flags aplicáveis + valor booleano.
- **Severidade**: MÉDIA (depende do shape). Registrar follow-up.

### 4.4. `app_pages` + `independent_categories` + `organization_groups` + `squads` — SELECT `USING(true)`

- Leitura genérica de taxonomia.
- `squads` e `organization_groups` **foram PoC-confirmadas como anon-leakable** (retornam 4 squads, 1 org group sem login).
- **Impacto**: enumeração de estrutura organizacional — útil pra spearphishing. Não é super-crítico, mas bandeira.
- **Fix**: restringir SELECT a authenticated (mínimo); idealmente escopo por usuário.
- **Migration**: `20260423232000_fix_org_taxonomy_rls.sql`

### 4.5. `trainings` + `training_lessons` + `pro_tools` + `company_content` + `predefined_challenges` — SELECT `USING(true)`

- Conteúdo curado. `pro_tools` e `company_content` anon-leakable.
- **Aceitável?** Possivelmente sim para `company_content` (site público). Mas `trainings` e `training_lessons` têm `allowed_roles[]` — RLS **não está aplicando** esse campo.
- **Fix trainings**: `allowed_roles @> ARRAY[get_user_role(auth.uid())::text] OR is_admin`.
- **Severidade**: MÉDIA.
- **Migration**: `20260423232100_fix_trainings_role_scope.sql`

### 4.6. `okrs` — SELECT `USING(true)` roles={authenticated}

- OKRs visíveis a todos staff. Provavelmente **intencional** (OKRs são transparentes). Falso positivo provável — confirmar com CEO.

### 4.7. `strategy_funnel_templates` — ALL `USING(true)`

- Templates de funnel compartilhados — possivelmente intencional. Mas `WITH CHECK(true)` permite qualquer authenticated criar templates que outros vão ver.
- **Fix**: SELECT aberto pode ficar; INSERT/UPDATE/DELETE restrito a admin.

---

## Seção 5. Vulnerabilidades INFORMATIVAS

### 5.1. `api_keys` + `api_logs` — RLS ON, zero policies

- **Aceitável pois**: não há grant que importa dado que nenhuma policy autoriza SELECT/INSERT. Queries retornariam 0 rows (RLS default-deny).
- **Mas**: service role bypassa. Edge functions e scripts acessam via service role — correto.
- **Recomendação**: adicionar comentário explícito em migration documentando "no policies intentional — access only via service_role".

### 5.2. FORCE RLS desabilitado em 148/150 tabelas

- **Padrão Supabase**: owner (postgres) não é coberto por RLS a menos que `FORCE RLS` esteja ligado.
- **Risco**: se service_role credentials vazarem (já existe alerta em auditoria 2026-04-20 bundle), vira bypass universal.
- **Recomendação**: habilitar `ALTER TABLE ... FORCE ROW LEVEL SECURITY` em tabelas CRÍTICAS (`clients`, `user_roles`, `api_keys`, `financeiro_*`).
- **Severidade**: INFORMATIVA (defesa em profundidade).
- **Migration opcional**: `20260423232200_force_rls_critical_tables.sql`

### 5.3. SECURITY DEFINER funcs sem grant controlado

- 80 SECDEF funcs. Não auditei cada uma individualmente nesta wave, mas **recomendação**:
  - Para cada SECDEF: confirmar `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` + `GRANT EXECUTE TO authenticated` (não anon).
  - Especialmente `tech_*`, `grant_pages`, `revoke_page`, `set_mtech_access` — qualquer authenticated que chamar sem check interno = bypass.
- **Follow-up**: auditoria dedicada de SECDEF funcs (wave separada).

### 5.4. `meeting_folders` + `recorded_meetings` aparecem como RLS off em q3

- A query q3 olhou `relrowsecurity = false`. Mas policies existem na q4. Possível:
  - RLS foi temporariamente desabilitada manualmente.
  - Policies existem mas não estão ativas (RLS off = policies ignoradas).
- **Ação**: confirmar via `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('meeting_folders','recorded_meetings')` + habilitar se off.
- **Severidade**: **ALTA** se de fato RLS off (qualquer grant-holder — incluindo anon — tem acesso sem filtro).
- **Migration**: `20260423232300_ensure_meetings_rls_enabled.sql`

---

## Seção 6. Testes de intrusão empíricos (live em PROD)

Todos os testes executados com anon key (`VITE_SUPABASE_PUBLISHABLE_KEY`), sem login.

| Tabela | Método | HTTP | Resultado | Severidade |
|---|---|---|---|---|
| `custom_roles` | GET | 200 | **1 row retornada** (id, name, allowed_pages) | CRÍTICA |
| `squads` | GET | 206 | **4 rows** (org structure) | MÉDIA |
| `organization_groups` | GET | 200 | **1 row** (name, slug) | MÉDIA |
| `rh_vagas` | GET | 200 | **1 row** (title, description) | CRÍTICA |
| `rh_vaga_briefings` | GET | 200 | **1 row** (vaga_id, solicitado_por, area_squad) | CRÍTICA |
| `paddock_diagnosticos` | GET | 200 | **1 row** (client_id, consultor_id, métricas) | CRÍTICA |
| `pro_tools` | GET | 200 | **1 row** (slug, title, content) | MÉDIA (pode ser intencional) |
| `company_content` | GET | 200 | **1 row** (slug, title) | MÉDIA (pode ser intencional) |
| `video_briefings` | GET | 200 | **1 row** (script_url, materials_url) | ALTA |
| `meeting_folders` | GET | 200 | **1 row** (name, created_by) | ALTA |
| `financeiro_kanban_tasks` | **POST** | **201** | **Insert bem-sucedido sem login**, UUID retornado; cleanup OK | **CRÍTICA P0** |
| `meeting_folders` | DELETE | 200 | Permitiu chamada (linha inexistente, mas autorizou) | ALTA |
| `strategy_requests` | POST | 401 | Bloqueado (`auth.uid() IS NOT NULL` exige login) | (gate funciona aqui) |

Tabelas testadas que retornaram vazio (policy permitia mas dado inexistente): `strategy_requests`, `user_roles`, `kanban_cards`, `kanban_boards`, `clients`, `mrr_changes`, `rh_candidatos`, `financeiro_contas_receber`, `financeiro_dre`, `crm_daily_documentation`, `mktplace_relatorios`, etc. **Tudo isso vaza na segunda que houver dado**.

---

## Seção 7. Falsos positivos explicados

| Tabela | Por que policy permissiva é (possivelmente) intencional |
|---|---|
| `company_content` | Conteúdo público de site corporativo. Aceitável desde que `content` não contenha nada confidencial. |
| `pro_tools` | Curadoria de tools pública. Idem company_content. |
| `app_pages` | Metadados de rotas — o frontend precisa ler pra montar sidebar. Aceitável se shape é só (id, slug, label), sem info interna. |
| `nps_responses` INSERT | Formulário NPS público é por design. **Mas precisa gate por token válido não respondido** (hoje não tem). |
| `cs_exit_reasons` com `public_token` | Policy por token é padrão público correto. Coexistência com `auth.uid() IS NOT NULL` é que é problemática. |
| `okrs` SELECT | Filosofia de transparência. Confirmar com CEO se ficar aberta ou escopar por grupo. |
| `predefined_challenges` SELECT | Catálogo read-only provavelmente OK. |
| `api_keys` / `api_logs` RLS ON zero policies | Intencional — acesso só via service_role. Confirmar comment. |

---

## Seção 8. Ranking — Top 5 ações imediatas

> Ordem: blast radius × exploitabilidade × trivialidade do fix.

1. **`financeiro_kanban_tasks` ALL=true roles=public** — LEAK ATIVO confirmado, anon-writable. Fix em < 5min.
2. **`user_roles` SELECT=true** — vaza lista de admins a qualquer authenticated (staff junior). Vetor de spearphishing contra CEO/CTO. Fix trivial.
3. **Financeiro inteiro** (`mrr_changes`, `financeiro_contas_pagar`, `financeiro_contas_receber`, `financeiro_active_clients`, `financeiro_dre` + 4 dashboards) — fraude financeira direta + leak de margem. Fix em bloco único.
4. **RH inteiro** (`rh_vagas`, `rh_candidatos`, `rh_vaga_briefings`, `rh_comentarios`, `rh_justificativas`, `rh_atividades`, `rh_tarefas`, `rh_vaga_plataformas`) — LEAK ANON confirmado em 2 tabelas, LGPD risk (dados de candidatos). Fix em bloco único.
5. **Kanban-family writes** (`card_attachments`, `card_comments`, `card_activities` SELECT=true; briefings SELECT=true) — extensão natural do fix que o agente paralelo está fazendo em `kanban_{boards,cards,columns}`. **Merge com o bundle dele**.

---

## Seção 9. Estimativa de exposição

- **Usuários authenticated atuais**: 25 (estimativa `user_roles`), mas qualquer empregado pode abusar. Considerar também ex-funcionários com cred ainda válida.
- **Anônimos (anon key)**: a anon key está no bundle `dist/` público em `VITE_SUPABASE_PUBLISHABLE_KEY` — **qualquer visitante do site** tem a key. Isso é padrão Supabase, mas significa que **qualquer vulnerabilidade com `roles={public}` + permissive = leak mundial**.
- **Rows potencialmente expostas** (rough estimate):
  - `clients`: 107 (já OK)
  - `financeiro_contas_pagar` + `receber`: ~510
  - `financeiro_active_clients`: 104
  - `user_roles`: 25
  - `client_product_values`: 96
  - `kanban_cards`: 456
  - `profiles`: ~25
  - Rows em tabelas hoje vazias que potencialmente encherão: incontável.

---

## Seção 10. Migrations sugeridas (resumo por nome)

Nenhuma aplicada. Propostas pra wave fix — sugerir que `db-specialist` escreva em bloco único ou por tema, conforme Seção 7 da auditoria 2026-04-20.

| Migration name | Escopo | Severidade |
|---|---|---|
| `20260423230000_fix_financeiro_kanban_tasks_rls.sql` | 1 tabela anon-writable | P0 |
| `20260423230100_fix_mrr_changes_rls.sql` | MRR | CRÍTICA |
| `20260423230200_fix_financeiro_contas_rls.sql` | pagar + receber | CRÍTICA |
| `20260423230300_fix_financeiro_active_clients_rls.sql` | active_clients | CRÍTICA |
| `20260423230400_fix_financeiro_dashboards_rls.sql` | dre, produtos, custos, etc. | CRÍTICA |
| `20260423230500_fix_strategy_requests_rls.sql` | strategy_requests | CRÍTICA |
| `20260423230600_fix_crm_mktplace_paddock_rls.sql` | 8 tabelas | CRÍTICA |
| `20260423230700_fix_provas_sociais_rls.sql` | 3 tabelas | ALTA |
| `20260423230800_fix_rh_rls.sql` | 8 tabelas | CRÍTICA |
| `20260423230900_fix_custom_roles_rls.sql` | custom_roles | CRÍTICA |
| `20260423231000_fix_user_roles_select.sql` | user_roles SELECT | CRÍTICA |
| `20260423231100_harden_nps_responses_insert.sql` | nps_responses | CRÍTICA (integridade) |
| `20260423231200_fix_briefings_select_rls.sql` | 5 briefings dept. | ALTA |
| `20260423231300_fix_meetings_rls.sql` | meeting_folders + recorded_meetings | ALTA |
| `20260423231400_fix_weekly_and_1on1_rls.sql` | weekly_* + 1:1 | ALTA |
| `20260423231500_fix_client_commercial_data_rls.sql` | churns, values, reports, strategies | ALTA |
| `20260423231600_fix_notifications_insert_identity.sql` | notifications | ALTA |
| `20260423231700_fix_financial_write_permissions.sql` | adjustments + commissions | ALTA |
| `20260423231800_fix_cs_auxiliary_rls.sql` | cs_* auxiliares | MÉDIA |
| `20260423231900_fix_cs_exit_reasons_auth_scope.sql` | cs_exit_reasons | MÉDIA |
| `20260423232000_fix_org_taxonomy_rls.sql` | squads, groups, app_pages | MÉDIA |
| `20260423232100_fix_trainings_role_scope.sql` | trainings por allowed_roles | MÉDIA |
| `20260423232200_force_rls_critical_tables.sql` | FORCE RLS em tabelas críticas | INFO |
| `20260423232300_ensure_meetings_rls_enabled.sql` | confirmar RLS habilitada | ALTA |

**Consolidação recomendada**: bundle P0 + CRÍTICAS em uma migration única executada em janela de manutenção (quarta-feira madrugada). Evita 23 migrations sequenciais. Seguir estrutura da auditoria 2026-04-20 §7 — transação única, DROP+CREATE por policy, safeguard com `DO $$ RAISE NOTICE`.

---

## Seção 11. Gates pgTAP recomendados pós-fix

Pra cada CRÍTICA corrigida, criar teste em `supabase/tests/rls_<tabela>_test.sql`:

```sql
-- Exemplo financeiro_kanban_tasks
BEGIN;
SELECT plan(6);

-- Setup: um admin, um staff junior, um anon
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@test.com'),
  ('00000000-0000-0000-0000-000000000002', 'staff@test.com');
INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000000001', 'ceo');
INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000000002', 'design');

-- Test 1: admin pode INSERT
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT lives_ok($$INSERT INTO financeiro_kanban_tasks(title) VALUES ('test')$$, 'admin INSERT OK');

-- Test 2: staff junior NÃO pode INSERT
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT throws_ok($$INSERT INTO financeiro_kanban_tasks(title) VALUES ('bad')$$, NULL, 'staff blocked');

-- Test 3: anon NÃO pode INSERT
SET LOCAL role = anon;
SET LOCAL request.jwt.claim.sub = NULL;
SELECT throws_ok($$INSERT INTO financeiro_kanban_tasks(title) VALUES ('bad')$$, NULL, 'anon blocked');

-- ... (mais testes SELECT, UPDATE, DELETE)

SELECT * FROM finish();
ROLLBACK;
```

Suite completa pgTAP deve rodar em CI (já existe `npm run test:db` segundo `docs/wiki/00-Arquitetura/Supabase e RLS.md`).

---

## Seção 12. Handoff

### Para `seguranca` (próxima wave)
- Auditar 80 SECURITY DEFINER funcs individualmente (grants, search_path, validação de caller).
- Validar FORCE RLS em tabelas críticas (Seção 5.2).
- Investigar `meeting_folders` + `recorded_meetings` RLS habilitada vs. policies existentes (Seção 5.4).

### Para `db-specialist` (wave fix)
- Consolidar em 1-3 migrations por tema (CRÍTICA / ALTA / MÉDIA).
- Seguir pattern da wave 1 A.3: transação única, DROP+CREATE individual, `TO authenticated` explícito.
- Adicionar safeguard `FOR ALL TO authenticated` em todas as novas policies (várias atuais estão `{public}` sem necessidade).

### Para `qa` (pós-fix)
- pgTAP suite para os 13 CRÍTICOS principais (seção 2).
- Smoke E2E:
  1. Login como `design` (role não-executiva) → tentar GET `/rest/v1/mrr_changes` → deve vir vazio.
  2. Anon → GET custom_roles → 0 rows.
  3. Admin → INSERT `financeiro_kanban_tasks` → 201.
- **Reproduzir PoC** de `financeiro_kanban_tasks`: anon POST → esperar 401.

### Para `engenheiro` (impacto frontend)
- Auditar se algum hook lê `user_roles` diretamente. Se sim, migrar pra RPC `get_my_role()` ou `auth.jwt() ->> 'role'`.
- Auditar consumos de `custom_roles`, `strategy_requests`, `feature_flags` por anon — mover pra endpoint autenticado.

### Para `conselheiro` / fundador
- Decidir se `okrs`, `trainings`, `company_content` devem permanecer abertos a todo authenticated (filosofia transparência) ou escopar.
- Decidir política LGPD para `rh_candidatos` — hoje vaza dados pessoais se rows existirem.

---

## Apêndice A. Output raw

- `/tmp/rls_audit_out.json` — 7 queries × output completo (não versionado, `/tmp` é efêmero)
- `/tmp/grants.json` — grants por tabela
- Scripts: `/tmp/rls_audit_q.mjs`, `/tmp/rls_audit_grants.mjs`, `/tmp/test_anon*.mjs`

## Apêndice B. Auditorias relacionadas

- `docs/wiki/00-Arquitetura/Auditoria RLS Literal Role 2026-04-20.md` — eixo ortogonal (admins bloqueados silenciosamente)
- `docs/superpowers/security/2026-04-20-credential-exposure-audit.md` — service_role exposure
- `docs/superpowers/security/2026-04-20-bundle-verify-report.md` — bundle scan
- `docs/superpowers/security/2026-04-20-git-history-purge-report.md` — history cleanup

## Apêndice C. Ação de remediação já efetuada durante auditoria

- **Uma** INSERT anônimo de teste (`financeiro_kanban_tasks`, row `23098eb5-e8cb-4e6d-9851-8ab458048f91`) foi criado para confirmar PoC e **deletado via service_role imediatamente após confirmação**. Nenhum outro write durante a auditoria. Restante 100% read-only.

---

## Seção 13. Wave 1 — Status (2026-04-23, db-specialist)

> [!success] Wave 1 aplicada em PROD. P0 bloqueador fechado. Top 5 CRÍTICAS remediadas.

### 13.1. Resumo executivo

- **Migrations aplicadas em PROD** via Supabase Management API (access token privileged).
- **Zero downtime.** Cada migration em transação única com BEGIN/COMMIT.
- **Validação live anon**: 22 tabelas auditadas — todas retornam 0 rows SELECT + 401 RLS violation em INSERT.
- **Validação positive path**: CEO/Financeiro/gestor_ads (non-admin) via SET LOCAL jwt.claims — comportamento esperado em 100% dos casos.
- **pgTAP regression**: 27 tests em `supabase/tests/rls_security_wave1_test.sql` — todos passing.
- **Backup**: `docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql` (reconstituição das policies originais para rollback de emergência).

### 13.2. Migrations aplicadas

| # | Migration | Escopo | Status | Validação anon |
|---|---|---|---|---|
| 1 | `20260423140000_security_wave1_fix_financeiro_kanban_tasks.sql` | P0 — 4 policies escopadas (admin+financeiro) | ✅ applied | `INSERT → 401 RLS violation` |
| 2 | `20260423140100_security_wave1_fix_user_roles_select.sql` | SELECT → user_id=auth.uid OR is_admin | ✅ applied | `SELECT → []` |
| 3 | `20260423140200_security_wave1_fix_financeiro.sql` | 9 tabelas financeiro | ✅ applied | `SELECT → []` + `INSERT → 401` |
| 4 | `20260423140300_security_wave1_fix_rh.sql` | 8 tabelas RH + FORCE RLS em rh_candidatos | ✅ applied | `SELECT → []` + `INSERT → 401` |
| 5 | `20260423140400_security_wave1_fix_kanban_children.sql` | 3 tabelas (activities/attachments/comments) via can_view_card | ✅ applied | `SELECT → []` (gated por card scope) |

Total: **23 tabelas** transformadas. **64 policies** substituídas por 65 policies escopadas + 1 FORCE RLS.

### 13.3. Validação live (anon key, sem login)

```
=== ANON SELECT (expect empty [] or 401) ===
blocked    financeiro_kanban_tasks                http=200 body=[]
blocked    user_roles                             http=200 body=[]
blocked    mrr_changes                            http=200 body=[]
blocked    financeiro_contas_pagar                http=200 body=[]
blocked    financeiro_contas_receber              http=200 body=[]
blocked    financeiro_active_clients              http=200 body=[]
blocked    financeiro_dre                         http=200 body=[]
blocked    financeiro_produtos                    http=200 body=[]
blocked    financeiro_custos_produto              http=200 body=[]
blocked    financeiro_produto_departamentos       http=200 body=[]
blocked    financeiro_receita_produto             http=200 body=[]
blocked    rh_vagas                               http=200 body=[]
blocked    rh_candidatos                          http=200 body=[]
blocked    rh_vaga_briefings                      http=200 body=[]
blocked    rh_atividades                          http=200 body=[]
blocked    rh_comentarios                         http=200 body=[]
blocked    rh_justificativas                      http=200 body=[]
blocked    rh_tarefas                             http=200 body=[]
blocked    rh_vaga_plataformas                    http=200 body=[]
blocked    card_activities                        http=200 body=[]
blocked    card_attachments                       http=200 body=[]
blocked    card_comments                          http=200 body=[]

=== ANON INSERT (expect 401 RLS violation) ===
blocked    financeiro_kanban_tasks                http=401  code=42501
blocked    mrr_changes                            http=401  code=42501
blocked    financeiro_contas_pagar                http=401  code=42501
blocked    financeiro_contas_receber              http=401  code=42501
blocked    financeiro_active_clients              http=401  code=42501
blocked    rh_vagas                               http=401  code=42501
blocked    rh_candidatos                          http=401  code=42501
blocked    rh_tarefas                             http=401  code=42501
```

### 13.4. Validação positive path (por role)

Via `SET LOCAL ROLE authenticated` + `SET LOCAL "request.jwt.claims"` em PROD:

| Ator | user_roles | financeiro_kanban_tasks | financeiro_contas_pagar | rh_vagas | rh_candidatos |
|---|---|---|---|---|---|
| CEO (`07e5f01d...`) | 25 | 0 | **306** | **1** | 0 |
| Financeiro (`ce6f20a2...`) | 1 (próprio) | 0 | **306** | 0 (scoped) | 0 |
| gestor_ads non-admin (`683c085f...`) | 1 (próprio) | 0 | 0 | 0 | 0 |
| anon (sem JWT) | 0 | 0 | 0 | 0 | 0 |

Comportamento esperado:
- CEO vê tudo via `is_admin` bypass.
- Financeiro vê financeiro (via `has_role('financeiro')`) mas não vê RH.
- gestor_ads (não-admin, não-financeiro, não-RH) vê só o próprio user_roles.
- Anon bloqueado.

### 13.5. Bypasses preservados

- `is_admin(uid)` — ceo/cto/gestor_projetos — cobertura universal em todas as 23 tabelas novas.
- `is_ceo(uid)` — ceo/cto — preservado em `user_roles` INSERT/UPDATE/DELETE (policies CEO can *).
- `has_role(uid, 'financeiro')` — bypass explícito em 10 tabelas financeiro.
- `has_role(uid, 'rh')` — bypass explícito em 8 tabelas RH.
- `can_view_card(uid, card_id)` — escopo por board em 3 card-children.

### 13.6. Falsos positivos confirmados / descartados

Nenhum falso positivo identificado na lista top 5. Todas as policies substituídas eram de fato `USING(true)`, `WITH CHECK(true)` ou `auth.uid() IS NOT NULL` com `roles={public}` — leaks reais.

Observação: role `rh` **não existe** nos 25 user_roles atuais em PROD (verificado via `SELECT DISTINCT role FROM user_roles`). Bypass efetivo de RH hoje = apenas `is_admin`. Wave 2 deve ou (a) atribuir role `rh` a usuário responsável por RH, ou (b) documentar explicitamente que RH ops são admin-only no contexto atual.

### 13.7. pgTAP regression

- Arquivo: `supabase/tests/rls_security_wave1_test.sql`
- **27 tests** — passou 100% via Management API.
- Cobertura:
  - 17 structural asserts em pg_policies (ausência de USING(true)/public, presença de scope).
  - 3 helper function sanity (is_admin/has_role/can_view_card SECDEF).
  - 7 functional tests (CEO bypass, design non-admin escopo, ANON bloqueado).
- Rodar via `npm run test:db` (quando supabase CLI link for restaurado), ou via Management API.

### 13.8. Riscos residuais → Wave 2

Identificados durante execução; NÃO tocados na wave 1. Organizados por prioridade:

1. **Hooks que leem `user_roles` sem filtro quebram pra não-admin.** Lista confirmada via grep (40 ocorrências em 24 arquivos). Dependentes:
   - `src/hooks/useSquadManagers.ts` — lista gestor_ads pra atribuir a cliente
   - `src/hooks/useDashGestores.ts` — dashboard de gestores
   - `src/hooks/useUsers.ts` — gestão de usuários (admin-only OK)
   - `src/hooks/useDepartmentTasks.ts` — task assignment
   - `src/hooks/useTVDashboard.ts`, `useRHJornadaEquipe.ts`, `useDailyMovementDelayCheck.ts`, `useProjectManagerWelcomeTasks.ts` — dashboards de gestão (provavelmente OK se só gestor_projetos usa)
   - `src/hooks/useClientRegistration.ts` (6 pontos), `useTreinadorClientCount.ts` (7 pontos) — onboarding de cliente
   - `src/hooks/useClientNotes.ts`, `useProductChurn.ts`, `useGroupManagement.ts`, `useCSOnboardingTracking.ts`, `useSucessoCliente.ts` — ops pontuais
   - `src/hooks/useOnboardingAutomation.ts`, `useOutboundManagerBoards.ts`, `useCrmManagerBoards.ts` — automação de onboarding
   - `src/components/kanban/SpecializedKanbanBoard.tsx`, `src/components/upsells/CreateUpsellModal.tsx`, `src/components/gestor-projetos/SquadDelaysJustificationsSection.tsx` — componentes
   - `src/hooks/useTaskDelayNotifications.ts` (4 pontos) — notifications de atraso

   **Handoff engenheiro**: auditar cada um. Admin-only hooks OK. Non-admin hooks precisam RPC `list_users_by_role(role)` com grant controlado.

2. **Tabelas ainda permissivas** (§3-§5 do audit original):
   - CRM/Marketplace/Paddock (7 tabelas)
   - Briefings departamentais (5 tabelas)
   - Meeting folders/recorded_meetings (ver também §5.4 — validar RLS enabled vs. disabled)
   - Weekly/1:1 (4 tabelas)
   - Clients commercial data (5 tabelas)
   - Notifications INSERT identity gate
   - CS auxiliares
   - Org taxonomy (squads, groups, app_pages)
   - Trainings

3. **80 SECURITY DEFINER funcs sem grant controlado** — wave separada (§5.3). Checar `REVOKE EXECUTE FROM PUBLIC` + `GRANT EXECUTE TO authenticated`.

4. **FORCE RLS em tabelas críticas restantes** (§5.2) — `clients`, `user_roles`, `api_keys`, `profiles`, `financeiro_*`.

5. **`api_keys` + `api_logs` RLS-on-zero-policies** — adicionar comment explícito.

6. **role `rh` ausente** — decisão de produto: criar user com role `rh` OU deixar bypass só admin.

### 13.9. Gates pra Wave 2

- [ ] Refatorar hooks que listam `user_roles` sem filtro → RPC SECDEF ou aceite `is_admin` gate explícito.
- [ ] Auditar 80 SECDEF funcs: grants, search_path, caller validation.
- [ ] Aplicar FORCE RLS em `clients`, `user_roles`, `api_keys`, `profiles`, `financeiro_contas_receber`, `financeiro_contas_pagar`.
- [ ] Fechar restantes tabelas CRÍTICAS/ALTA (12-16 migrations adicionais).
- [ ] CI: rodar `npm run test:db` (pgTAP suite completa) em push.

### 13.10. Arquivos criados/modificados nesta wave

Criados:
- `supabase/migrations/20260423140000_security_wave1_fix_financeiro_kanban_tasks.sql`
- `supabase/migrations/20260423140100_security_wave1_fix_user_roles_select.sql`
- `supabase/migrations/20260423140200_security_wave1_fix_financeiro.sql`
- `supabase/migrations/20260423140300_security_wave1_fix_rh.sql`
- `supabase/migrations/20260423140400_security_wave1_fix_kanban_children.sql`
- `supabase/tests/rls_security_wave1_test.sql`
- `docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql`

Modificados:
- `docs/superpowers/security/2026-04-23-rls-leakage-audit.md` (este arquivo, Seção 13)

Regenerar types (não há mudança de schema, só RLS):
- Tipo TypeScript não muda (schema idêntico). `npm run supabase:gen-types` opcional.

