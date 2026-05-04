# Justificativas na Sidebar — Design Spec

**Data:** 2026-05-04
**Status:** Spec aprovada — pronta para `writing-plans`
**Owner:** CTO (decisão estratégica) → harness de agentes (execução)

---

## 1. Problema

Hoje o sistema interrompe o usuário com **modal bloqueante de justificativa** (`TaskDelayModal`) sempre que ele entra no app e há tarefas atrasadas. Esse modal:

- Quebra o fluxo de quem só queria abrir o sistema rápido.
- Não permite o usuário priorizar quando justificar.
- Para CEO/CTO já é skipável — para os demais é hard gate.
- Não dá visão consolidada de "tudo que estou devendo".
- Master (CEO/CTO/gestor) acessa visão de equipe via páginas dispersas — sem hub único.

**Objetivo:** substituir o entry-modal por uma **área dedicada na sidebar** que concentra todas as pendências do usuário e fornece visão master das pendências da equipe, com pressão visual mas sem bloqueio.

## 2. Escopo

### Em escopo

- Nova rota dedicada `/justificativas` com 3 tabs.
- Item bottom-fixed sticky na sidebar com badge contador.
- Visão master agrupada por pessoa, com filtro "só não-justificadas".
- Ações master: arquivar, cobrar (nudge via Notification Center), comentar com flag "exigir refazer".
- Migração das tabelas DB existentes para suportar comentário master + flag de revisão.
- 8 RPCs novas SECURITY DEFINER cobrindo leitura por escopo, submissão e ações master.
- Remoção completa do `TaskDelayModal` e seu render em `MainLayout`.

### Fora de escopo

- **Action-modais preservados** (`JustificationProvider` / `requireJustification` em `useAdsManager`, `useDepartmentTasks`, `useCrmDelayJustifications`, `useClientTagDelayJustifications`, `useComercialClients`, `useProductChurn`). Esses são bloqueios contextuais de ação — manter força do gate é importante.
- Thread de comentários (somente comentário único por justificativa).
- Cobrar via email/WhatsApp (somente in-app via Notification Center).
- Realtime via WebSocket (manter `refetchInterval` 30s + `refetchOnWindowFocus`).
- Dashboard analítico de SLA de justificativas (escopo futuro).

## 3. Decisões travadas

| ID | Decisão |
|---|---|
| Q1 | Substituir somente o entry-modal (`TaskDelayModal`). Action-modais preservados. |
| Q2 | Pressão soft — badge contador, sem nag escalonado, sem hard gate. |
| Q3 | Visão hierárquica por escopo (CEO/CTO/gestor_projetos = global; demais gestores = grupo deles; demais roles = só própria). |
| Q4 | 3 tabs: **Pendentes** / **Justificadas por mim** / **Da minha equipe**. |
| Q5 | Item da sidebar = bottom-fixed sticky no rodapé. |
| Q6 | Container = página dedicada (`/justificativas`), não drawer. |
| Q7 | Tab Equipe agrupada por pessoa + filtro toggle "só não-justificadas". |
| Q8 | `TaskDelayModal` removido completamente. Backend (`useCheckOverdueTasks`, tabelas) preservado e migrado para RPCs novas. |
| Q9 | Master pode: read + arquivar + cobrar + comentar (com flag refazer). |
| Q9.1 | Cobrar = notification persistente in-app via Notification Center existente. |
| Q9.2 | Comentário único + flag `requires_revision` que devolve item à tab Pendentes do devedor. |

## 4. Arquitetura

```
┌─────────────────────────┐
│  AppSidebar (bottom)    │  badge contador via RPC
│  ⚠ Justificativas (3)   │
└──────────┬──────────────┘
           │ click → /justificativas
           ▼
┌──────────────────────────────────────┐
│  Page /justificativas                │
│  ┌──────────┬─────────────┬────────┐ │
│  │Pendentes │Justificadas │Equipe* │ │ * só renderiza se escopo > 0
│  └──────────┴─────────────┴────────┘ │
└──────────────────────────────────────┘
        │
        │ todas as queries via RPCs SECURITY DEFINER
        ▼
┌──────────────────────────────────────┐
│  Postgres                            │
│  - task_delay_notifications (existe) │
│  - task_delay_justifications         │
│      + master_comment, *_by, *_at    │
│      + requires_revision             │
│      + revision_requested_by, *_at   │
│  - notifications (existe)            │
│  - 8 RPCs novas                      │
└──────────────────────────────────────┘
```

**Princípio inegociável:** escopo definido server-side. Frontend nunca decide quem pode ver/agir sobre o quê.

## 5. UI / Componentes

```
src/
├── pages/
│   └── Justificativas.tsx
├── components/
│   └── justificativas/
│       ├── SidebarBadge.tsx          # bottom-fixed, badge contador
│       ├── PendentesTab.tsx
│       ├── JustificadasTab.tsx
│       ├── EquipeTab.tsx
│       ├── PessoaAccordion.tsx
│       ├── JustificativaItem.tsx
│       ├── JustificarForm.tsx
│       ├── ComentarioMaster.tsx
│       └── CobrarButton.tsx
└── hooks/
    └── useJustificativas.ts
```

### Roteamento

- Adicionar rota `/justificativas` em `src/App.tsx`. Acessível por todos os usuários autenticados.
- Tab Equipe somente renderiza se `useTeamScope()` retornar pelo menos 1 user (escopo não-vazio).

### Visual (padrão HM dark-first)

- **SidebarBadge**: posição sticky no fim do `<Sidebar>`. Ícone `AlertTriangle`, label "Justificativas", badge `bg-danger text-white` quando `count > 0`. Some quando `count = 0`.
- **Página**: header com título + tabs (`shadcn/ui` Tabs). Cada tab carrega query própria.
- **Item card** (reusado em todas as tabs): mostra título da task, prazo formatado, dias atraso (vermelho se >2d), espaço de justificativa. Estados visuais distintos:
  - **Pendente sem justificativa**: borda `danger/50`, label dias.
  - **Pendente por revisão**: borda `warning`, banner "Refazer: <comment>".
  - **Justificada OK**: borda `border`, texto da justificativa.
  - **Justificada arquivada**: opacity 50%, label "Arquivada" (master only com toggle).
- **EquipeTab**: header com `Switch` "Só não-justificadas". Lista de `PessoaAccordion`. Cada accordion: avatar + nome + role + contador "X pendentes / Y justificadas". Aberto mostra os itens da pessoa.
- **Empty states**: Pendentes vazia → ilustração + "Sem pendências por enquanto. Continue assim."

### Remoção do legacy

1. Tirar `<TaskDelayModal />` de `src/layouts/MainLayout.tsx:57`.
2. Deletar `src/components/TaskDelayModal.tsx`.
3. `localStorage` key `task-delay-justified-ids` permanece (dead key, sem prejuízo).
4. **Não tocar:** `src/contexts/JustificationContext.tsx`, `AdsTaskDelayModal.tsx` e action-modais relacionados (escopo Q1).

## 6. Banco de dados

### Migration: extensão de `task_delay_justifications`

```sql
ALTER TABLE public.task_delay_justifications
  ADD COLUMN master_comment text,
  ADD COLUMN master_comment_by uuid REFERENCES auth.users(id),
  ADD COLUMN master_comment_at timestamptz,
  ADD COLUMN requires_revision boolean NOT NULL DEFAULT false,
  ADD COLUMN revision_requested_by uuid REFERENCES auth.users(id),
  ADD COLUMN revision_requested_at timestamptz;

CREATE INDEX idx_tdj_requires_revision
  ON public.task_delay_justifications (user_id)
  WHERE requires_revision = true;
```

**Semântica de `requires_revision`:**
- `true` = justificativa rejeitada pelo master, devedor precisa refazer.
- Quando devedor submete justificativa nova para a mesma `notification_id`, RPC `submit_justification` arquiva a versão antiga (`archived = true`) e cria nova com `requires_revision = false`.

### RPCs novas (todas `SECURITY DEFINER`, com `SET search_path = public`)

| RPC | Quem chama | Descrição |
|---|---|---|
| `get_justifications_pending_mine()` | qualquer caller | Notifications onde caller é dono OU está no rol de notificação de delay; sem justificativa válida (sem registro OU `requires_revision = true`). |
| `get_justifications_done_mine()` | qualquer caller | Justificativas onde `user_id = auth.uid()`, `archived = false`, `requires_revision = false`, com join na notification. |
| `get_team_users_in_scope()` | qualquer caller | Set de `user_id` que o caller pode ver na tab Equipe. Vazio = sem permissão master. |
| `get_justifications_team_grouped(only_pending boolean default false)` | caller com escopo | Tabular `{user_id, user_name, user_role, task_id, task_table, task_title, task_due_date, justification_id, justification_text, master_comment, requires_revision, archived, created_at}`. Cliente agrupa por `user_id`. |
| `submit_justification(notification_id uuid, text text)` | dono da notification | Cria/atualiza justificativa. Se já existe com `requires_revision=true`, arquiva antiga + cria nova limpa. Idempotente em duplo-submit. |
| `request_justification_revision(justification_id uuid, comment text)` | master no escopo | Seta `requires_revision=true`, popula `master_comment*` e `revision_requested_*`. Insere notification persistente para o devedor. |
| `nudge_user_for_justification(notification_id uuid)` | master no escopo | Insere notification persistente para `task_owner_id` da notification. Guard: dedupe nudges para mesma notification em janela < 1h. |
| `archive_justification(justification_id uuid)` / `unarchive_justification(justification_id uuid)` | master no escopo | Substitui mutation client-side existente. |

### Helper interno

```sql
CREATE OR REPLACE FUNCTION public.assert_user_in_my_scope(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'target user out of caller scope';
  END IF;
END $$;
```

Toda RPC master chama isso antes de mutar.

### `get_team_users_in_scope` — regras de escopo

| Caller role | Escopo retornado |
|---|---|
| `ceo` ou `cto` (via `is_ceo()`) | Todos os users |
| `gestor_projetos` | Todos os users |
| `gestor_ads` | Users no mesmo `profiles.group_id` com role em `('gestor_ads','sucesso_cliente')` |
| `sucesso_cliente` | Users no mesmo `group_id` com role `gestor_ads` |
| `gestor_crm` | Users no mesmo `group_id` com role em `('gestor_crm','consultor_comercial')` |
| `rh` | A definir com db-specialist na fase de implementação. Default = vazio se incerto. |
| Demais roles | Conjunto vazio |

```sql
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
    FROM user_roles ur WHERE ur.user_id = caller_id LIMIT 1;

  SELECT p.group_id INTO caller_group_id
    FROM profiles p WHERE p.user_id = caller_id LIMIT 1;

  IF public.is_ceo(caller_id) OR caller_role = 'gestor_projetos' THEN
    RETURN QUERY SELECT p.user_id FROM profiles p;
    RETURN;
  END IF;

  IF caller_role = 'gestor_ads' THEN
    RETURN QUERY
      SELECT p.user_id FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role IN ('gestor_ads','sucesso_cliente');
    RETURN;
  END IF;

  IF caller_role = 'sucesso_cliente' THEN
    RETURN QUERY
      SELECT p.user_id FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role = 'gestor_ads';
    RETURN;
  END IF;

  IF caller_role = 'gestor_crm' THEN
    RETURN QUERY
      SELECT p.user_id FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role IN ('gestor_crm','consultor_comercial');
    RETURN;
  END IF;

  -- demais roles: vazio
  RETURN;
END $$;
```

### RLS

`task_delay_justifications`:
- `SELECT`: `user_id = auth.uid()` (próprias justificativas).
- `INSERT/UPDATE/DELETE`: bloqueado direto. Tudo via RPCs SECURITY DEFINER.

Visão master e ações master vêm exclusivamente das RPCs.

### Reuso de `notifications`

Notification Center existente recebe dois novos `type` values:

- `justification_nudge` — gerado por `nudge_user_for_justification`.
- `justification_revision_required` — gerado por `request_justification_revision`.

Conteúdo formatado server-side dentro das RPCs.

## 7. Data flow

### Fluxo: caller comum justifica

```
1. useCheckOverdueTasks (existe) cria task_delay_notifications a cada 60s.
2. SidebarBadge → useJustificativasCount → RPC get_justifications_pending_mine.
3. Badge mostra count > 0.
4. User clica → /justificativas.
5. PendentesTab carrega via mesma RPC.
6. User clica item → JustificarForm inline expande.
7. Submit → RPC submit_justification(notification_id, text).
8. RPC insere registro (ou re-submit zera requires_revision e arquiva antiga).
9. Client invalida queries: justif-pending-mine, justif-done-mine, justif-team.
10. Item migra de Pendentes para Justificadas. Badge decrementa.
```

### Fluxo: master cobra

```
1. Master abre /justificativas → tab Equipe.
2. EquipeTab → RPC get_justifications_team_grouped.
3. Master vê PessoaAccordion. Clica "Cobrar" em pendência.
4. RPC nudge_user_for_justification(notification_id).
5. RPC valida assert_user_in_my_scope(notification.task_owner_id).
6. RPC valida guard 1h (não duplicar nudges).
7. Insert em notifications (type='justification_nudge').
8. Devedor recebe notification persistente.
```

### Fluxo: master marca refazer

```
1. Master abre item na tab Equipe.
2. Digita comentário + checkbox "Exigir refazer".
3. RPC request_justification_revision(justification_id, comment).
4. RPC valida escopo via assert_user_in_my_scope.
5. Atualiza justificativa: requires_revision=true, master_comment*, revision_requested_*.
6. Insere notification (type='justification_revision_required').
7. No próximo refresh do devedor:
   - Item volta pra tab Pendentes (RPC inclui requires_revision=true).
   - Badge incrementa.
   - Item mostra master_comment como contexto.
8. Devedor submete nova justificativa → submit_justification arquiva versão antiga + cria nova com requires_revision=false.
```

### Refresh

- `refetchInterval: 30s` + `refetchOnWindowFocus: true` nas 3 queries (paridade com hoje).
- Mutations invalidam queries.
- Sem realtime/WebSocket nesta versão.

### Concorrência

- Submit duplicado (double-click): RPC checa `existing` por `(notification_id, user_id)` e é idempotente.
- Master e devedor agem simultaneamente: last-write-wins. Aceitável para v1.

## 8. Testes

### pgTAP (DB)

- `submit_justification` cria registro novo, atualiza quando existe + `requires_revision=true`, arquiva versão anterior nesse caso, é idempotente em duplo-submit imediato.
- `request_justification_revision` raise quando caller fora do escopo, sucesso quando dentro.
- `nudge_user_for_justification` insere em `notifications`, raise fora do escopo, dedupe em janela 1h.
- `get_team_users_in_scope` retorna set correto para cada role: ceo, cto, gestor_projetos, gestor_ads, sucesso_cliente, gestor_crm, demais (vazio).
- `get_justifications_team_grouped(only_pending=true)` filtra corretamente.
- RLS: SELECT direto retorna só linhas próprias; INSERT/UPDATE/DELETE direto bloqueado.

### Vitest (hooks/componentes)

- `useJustificativasCount` retorna 0 → badge oculto.
- `useSubmitJustificativa` invalida as 3 queries certas.
- `useEquipeJustificativas` agrupa por `user_id`.
- Toggle "só não-justificadas" passa `only_pending=true` na RPC.

### Playwright (e2e)

- User com pendência: badge visível com count, clica, vai para `/justificativas`, submete, badge zera.
- User volta para Pendentes quando master marca refazer.
- Master CEO vê tab Equipe; user comum sem escopo não vê.
- Cobrar gera 1 notification no Notification Center do devedor.
- `TaskDelayModal` **não** aparece em nenhum login (regressão do legacy).

## 9. Segurança

Gates inegociáveis:

- Toda lógica de escopo server-side. Cliente nunca filtra por role de outro user.
- RLS apertada em `task_delay_justifications`: SELECT só `user_id = auth.uid()`. Master via RPC.
- `SECURITY DEFINER` + `SET search_path = public` em todas as RPCs novas.
- `assert_user_in_my_scope` chamado no início de toda RPC master.
- Rate limit/dedupe de nudge: guard de 1h para mesma `notification_id`.
- Auditoria: campos `master_comment_by/at` e `revision_requested_by/at` rastreáveis.
- Sem CORS/edge function nessa feature.
- Justificativas e comentários podem conter PII — RLS já cobre.

> Agente `seguranca` revisa antes do merge.

## 10. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Devedor não percebe pendência sem nag automático | Badge `danger` no rodapé sticky + cobrança via Notification Center quando master cobra. Métricas observáveis pós-launch. |
| RPC `get_justifications_team_grouped` lenta com muitos users | Index existente em `task_delay_justifications.user_id` + index parcial novo em `requires_revision = true`. db-specialist valida com `EXPLAIN`. |
| Master cobra repetidamente o mesmo user | Guard de 1h no nudge. |
| Race entre devedor justificando e master marcando refazer | Last-write-wins aceito. |
| Mudança de cargo/grupo altera tab Equipe abruptamente | Aceitável — paridade com `can_view_board` e demais features. |
| Regra de escopo de `rh` indefinida | Default vazio até db-specialist mapear necessidade. |

## 11. Gates antes de merge (CLAUDE.md)

- [ ] conselheiro consultado
- [ ] arquiteto assinou (multi-módulo: sidebar + page + DB)
- [ ] db-specialist validou schema, RLS, RPCs e EXPLAIN
- [ ] frontend-design rodou hm-design (sidebar badge, página, accordion, item card, formulários)
- [ ] engenheiro entregou com arquivos:linhas
- [ ] qa rodou hm-qa
- [ ] seguranca aprovou (RLS + RPCs + nudge guard)

## 12. Open questions (para fase de implementação)

- **Escopo exato de `rh`**: db-specialist define com base nas regras de delay já existentes para o cargo.
- **Janela de dedupe do nudge**: confirmação de 1h ou parametrizável.
- **Guard de máximo de cobranças por dia**: nice-to-have; decisão na implementação.
