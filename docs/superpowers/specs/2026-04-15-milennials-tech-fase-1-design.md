# Milennials Tech — Fase 1 (Design)

**Data:** 2026-04-15
**Escopo:** Fase 1 de um subsistema completo "DevTrack" embutido no dashboard atual como nova aba **Milennials Tech**.
**Status:** Design aprovado. Próximo passo: plano de implementação (writing-plans).

---

## 1. Visão geral e escopo

### 1.1 O que é a Milennials Tech

Uma nova aba no dashboard (sidebar) que implementa um subsistema de gestão de engenharia inspirado em Linear/Jira enxuto. Replica o produto **DevTrack** (documentado em mensagem do usuário nesta brainstorming) adaptando da stack original (Node+Fastify+Prisma+Socket.io) para a stack deste projeto (Refine + React + Supabase Postgres + Realtime + RLS).

### 1.2 Entrega da Fase 1

- Novo cargo **CTO** (clone total de permissões do CEO).
- Nova aba **Milennials Tech** na sidebar, visível para `ceo`, `cto`, `devs`.
- Subsistema isolado com 3 telas: **Backlog**, **Kanban**, **Sprints**.
- Primitivas que sustentam as telas: Tasks, Time tracking (baseado em eventos), Collaborators, Activities imutáveis.
- Realtime nas 4 tabelas principais via Supabase Realtime.
- RPCs Postgres para todas as regras críticas de negócio.
- Gates obrigatórios: `/hm-design`, `/hm-engineer`, `/hm-qa`.

### 1.3 Fora de escopo (Fases 2 e 3)

Fase 2: Dashboard executivo, formulários públicos de bug/feature/hotfix, roteamento de hotfix, notificações, comentários estruturados.
Fase 3: Reports (horas por dev, velocidade, bug rate, estimated vs actual), Settings (team management, hotfix routing), cron de overdue, seniority (JUNIOR/PLENO/SENIOR) e poder de approve/reject para DEV SENIOR.

### 1.4 Princípios

- **Isolamento total**: prefixo `tech_` no banco, `/milennials-tech/*` nas rotas, pasta dedicada `src/features/milennials-tech/`. Zero risco de regressão nos outros kanbans.
- **Fidelidade ao DevTrack** no modelo de dados, enums de status, regras de negócio e state machine. Apenas a infraestrutura muda.
- **Regras críticas no banco** (RPCs Postgres + RLS), não no client — impede qualquer bypass via Supabase API direta.
- **Status machine** preservada: `BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE`. UI mostra labels PT no kanban; DB guarda o enum original.

---

## 2. Cargo CTO (clone de CEO)

### 2.1 Definição

- Adicionar `cto` ao enum/constraint de cargos em `src/types/auth.ts` (ao lado de `ceo`).
- CTO tem exatamente as mesmas permissões que CEO em todo o sistema — não apenas na aba Milennials Tech.

### 2.2 Mudanças de código

- **`useSidebarPermissions.ts`**: `ROLE_BOARD_SLUGS['cto']` = valor igual a `ROLE_BOARD_SLUGS['ceo']`. Idem para `ROLE_INDEPENDENT_CATEGORIES['cto']` e `SPECIAL_ROUTES['cto']`.
- **Helper `isExecutive(role: UserRole): boolean`** — centraliza `role === 'ceo' || role === 'cto'`. Todo condicional que hoje verifica `'ceo'` passa a chamar `isExecutive(role)`.
- **`<CEORoute>`**: renomear para `<ExecutiveRoute>` aceitando CEO ou CTO, OU manter `<CEORoute>` e criar `<ExecutiveRoute>` paralelo (decidir no plano de implementação — preferência: renomear para reduzir duplicação, pois CEO e CTO são equivalentes).
- **`DefaultRedirect`**: CTO cai no mesmo destino que CEO.

### 2.3 Mudanças no banco

Migration `add_cto_role.sql`:
- Adiciona `'cto'` ao enum/constraint de cargos.
- Atualiza **toda** RLS policy, function ou view que hoje faz `role = 'ceo'` para `role IN ('ceo','cto')` (ou `role = ANY (ARRAY['ceo','cto'])`).
- A migration documenta no comentário de cabeçalho cada ponto alterado, baseado em varredura `grep -r "'ceo'"` no código + busca SQL em `pg_policies`, `pg_proc`, `pg_views`.

### 2.4 Atribuição inicial

Migration **não** atribui `cto` a ninguém automaticamente. CEO atribui manualmente via tela de admin existente ou UPDATE SQL pontual após o deploy. Fábio pode receber o cargo CTO se desejar.

### 2.5 UI

Label exibido: "CTO". Avatar, tema e tudo mais são iguais ao CEO.

---

## 3. Modelo de dados

### 3.1 Enums

- `tech_task_type`: `BUG | FEATURE | HOTFIX | CHORE`
- `tech_task_status`: `BACKLOG | TODO | IN_PROGRESS | REVIEW | DONE`
- `tech_task_priority`: `CRITICAL | HIGH | MEDIUM | LOW`
- `tech_sprint_status`: `PLANNING | ACTIVE | COMPLETED`
- `tech_time_entry_type`: `START | PAUSE | RESUME | STOP`

### 3.2 Tabelas

**`tech_sprints`**
- `id UUID PK default gen_random_uuid()`
- `name TEXT NOT NULL`
- `goal TEXT`
- `start_date TIMESTAMPTZ NOT NULL`
- `end_date TIMESTAMPTZ NOT NULL`
- `status tech_sprint_status NOT NULL DEFAULT 'PLANNING'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- CHECK `end_date > start_date`
- Índice parcial único: `CREATE UNIQUE INDEX tech_sprints_single_active ON tech_sprints (status) WHERE status = 'ACTIVE'`

**`tech_tasks`**
- `id UUID PK default gen_random_uuid()`
- `title TEXT NOT NULL` (CHECK `char_length(title) BETWEEN 1 AND 200`)
- `description TEXT`
- `type tech_task_type NOT NULL`
- `status tech_task_status NOT NULL DEFAULT 'BACKLOG'`
- `priority tech_task_priority NOT NULL`
- `sprint_id UUID REFERENCES tech_sprints(id) ON DELETE SET NULL`
- `assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL`
- `created_by UUID NOT NULL REFERENCES auth.users(id)`
- `deadline TIMESTAMPTZ`
- `estimated_hours NUMERIC` (CHECK `estimated_hours IS NULL OR estimated_hours > 0`)
- `acceptance_criteria TEXT`
- `technical_context TEXT`
- `git_branch TEXT`
- `checklist JSONB NOT NULL DEFAULT '[]'::jsonb` (array de `{id, text, done}`)
- `is_blocked BOOLEAN NOT NULL DEFAULT false`
- `blocker_reason TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Índices: `status`, `type`, `assignee_id`, `sprint_id`.
- Trigger `moddatetime` em `updated_at`.

**`tech_task_collaborators`**
- PK composta `(task_id, user_id)`
- `task_id UUID REFERENCES tech_tasks(id) ON DELETE CASCADE`
- `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`
- `added_at TIMESTAMPTZ NOT NULL DEFAULT now()`

**`tech_time_entries`**
- `id UUID PK default gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES tech_tasks(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `type tech_time_entry_type NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Índices: `task_id`, `user_id`, `(user_id, created_at DESC)`.

**`tech_task_activities`**
- `id UUID PK default gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES tech_tasks(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `type TEXT NOT NULL`
- `data JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Índice: `task_id`.
- **Imutável**: policy bloqueia UPDATE e DELETE.

### 3.3 View

**`tech_task_time_totals`** — calcula segundos totais por task a partir dos eventos.
- Lógica: janelas START/RESUME → PAUSE/STOP ordenadas por `created_at`. Último evento aberto estende até `now()`.
- Retorna `(task_id, total_seconds)`.

### 3.4 RLS

Habilitado em todas as tabelas.

- **SELECT** (todas as 5 tabelas): CEO OU CTO OU Devs.
- **`tech_tasks` INSERT**: CEO OU CTO OU Devs; `created_by = auth.uid()` forçado pela policy.
- **`tech_tasks` UPDATE**: CEO OU CTO sem restrição; Dev apenas se `auth.uid() = assignee_id` OU existe row em `tech_task_collaborators (task_id, auth.uid())`.
- **`tech_tasks` DELETE**: CEO OU CTO.
- **`tech_sprints` INSERT/UPDATE/DELETE**: CEO OU CTO.
- **`tech_task_collaborators` INSERT/DELETE**: CEO OU CTO OU o `assignee` da task.
- **`tech_time_entries` INSERT**: bloqueado direto; obrigatório via RPC (`SECURITY DEFINER`).
- **`tech_task_activities` INSERT**: via trigger ou RPC apenas; direto bloqueado. UPDATE/DELETE bloqueado universalmente.

### 3.5 RPCs (Postgres functions, `SECURITY DEFINER`)

Todas validam `auth.uid()` e o cargo internamente antes de mutar qualquer tabela. `GRANT EXECUTE ... TO authenticated`.

- `tech_start_timer(task_id UUID)`:
  1. Busca timers ativos do `auth.uid()` em qualquer task. Cria `PAUSE` em cada um.
  2. Se status da task é `BACKLOG` ou `TODO`, atualiza para `IN_PROGRESS`.
  3. Insere `START` em `tech_time_entries`.
  4. Insere activity `timer_started`.
- `tech_pause_timer(task_id UUID)`: valida que existe timer ativo do user na task; insere `PAUSE`; activity.
- `tech_resume_timer(task_id UUID)`: análogo ao START (auto-pause de outros), mas insere `RESUME`.
- `tech_stop_timer(task_id UUID)`: insere `STOP`; activity.
- `tech_send_to_review(task_id UUID)`:
  1. Se há timer ativo do user na task, insere `STOP`.
  2. Atualiza status para `REVIEW`.
  3. Activity `sent_to_review`.
  4. Permissão: assignee, collaborator, CEO ou CTO.
- `tech_approve_task(task_id UUID)`: status `REVIEW` → `DONE`; activity. Permissão: CEO ou CTO.
- `tech_reject_task(task_id UUID)`: status `REVIEW` → `IN_PROGRESS`; activity. Permissão: CEO ou CTO.
- `tech_block_task(task_id UUID, reason TEXT)`: `is_blocked=true`, `blocker_reason=reason`; activity.
- `tech_unblock_task(task_id UUID)`: `is_blocked=false`, `blocker_reason=null`; activity.
- `tech_start_sprint(sprint_id UUID)`:
  1. Valida que não há outra sprint `ACTIVE` (o índice parcial também protege).
  2. Valida sprint em `PLANNING`.
  3. `UPDATE tech_tasks SET status='TODO' WHERE sprint_id=$1 AND status='BACKLOG'`.
  4. `UPDATE tech_sprints SET status='ACTIVE' WHERE id=$1`.
  5. Permissão: CEO ou CTO.
- `tech_end_sprint(sprint_id UUID)`:
  1. Valida sprint em `ACTIVE`.
  2. `UPDATE tech_tasks SET sprint_id=null, status='BACKLOG' WHERE sprint_id=$1 AND status != 'DONE'`.
  3. `UPDATE tech_sprints SET status='COMPLETED' WHERE id=$1`.
  4. Permissão: CEO ou CTO.

### 3.6 Trigger em `tech_tasks`

- Em `INSERT`: cria activity `task_created`.
- Em `UPDATE` quando `status` mudou: cria activity `status_changed` com `{from, to}`.
- `updated_at` atualiza via `moddatetime` (ou trigger equivalente).

### 3.7 Realtime

Adicionar à publication `supabase_realtime`:
- `tech_tasks`
- `tech_sprints`
- `tech_time_entries`
- `tech_task_activities`

---

## 4. Estrutura de código (frontend)

### 4.1 Pasta dedicada

```
src/features/milennials-tech/
├── pages/
│   ├── MilennialsTechPage.tsx        # wrapper com sub-nav (tabs)
│   ├── BacklogTab.tsx
│   ├── KanbanTab.tsx
│   └── SprintsTab.tsx
├── components/
│   ├── TaskCard.tsx
│   ├── TaskRow.tsx
│   ├── TaskDetailModal.tsx
│   ├── TaskFormModal.tsx
│   ├── TimerButton.tsx
│   ├── SprintPicker.tsx
│   ├── SprintFormModal.tsx
│   ├── KanbanColumn.tsx
│   ├── BacklogTabs.tsx
│   └── CommandPalette.tsx
├── hooks/
│   ├── useTechTasks.ts
│   ├── useTechSprints.ts
│   ├── useTechTaskActivities.ts
│   ├── useTechTimer.ts
│   ├── useActiveTimer.ts
│   └── useTechRealtime.ts
├── lib/
│   ├── statusLabels.ts               # map EN -> PT
│   ├── computeTaskTime.ts
│   └── permissions.ts
├── schemas/
│   └── task.ts                       # Zod schemas
└── types.ts
```

### 4.2 Rotas em `App.tsx`

```tsx
<Route
  path="/milennials-tech"
  element={<MilennialsTechRoute><MilennialsTechPage /></MilennialsTechRoute>}
>
  <Route index element={<Navigate to="kanban" replace />} />
  <Route path="backlog" element={<BacklogTab />} />
  <Route path="kanban" element={<KanbanTab />} />
  <Route path="sprints" element={<SprintsTab />} />
</Route>
```

`<MilennialsTechRoute>` = guard que aceita `ceo`, `cto`, `devs`. Usa o padrão dos guards existentes.

### 4.3 Sidebar

Um único item "Milennials Tech" em `src/components/layout/AppSidebar.tsx`, apontando para `/milennials-tech` (redireciona para `/milennials-tech/kanban`). Visível quando `role ∈ {ceo, cto, devs}`. Adicionado no bloco condicional existente, respeitando o padrão visual dos outros itens de primeiro nível.

### 4.4 Realtime e React Query

- `useTechRealtime()` monta em `MilennialsTechPage`, escuta as 4 tabelas `tech_*`, invalida query keys do React Query no INSERT/UPDATE/DELETE. Desmonta em unmount.
- Query keys: `['tech', 'tasks', filtros]`, `['tech', 'sprints']`, `['tech', 'activities', taskId]`, `['tech', 'task', taskId]`, `['tech', 'activeTimer', userId]`.
- Mutations otimistas para drag-and-drop do kanban; rollback em erro exibido no status-line.

### 4.5 Drag-and-drop

Usar a lib já presente no repo (verificar no código existente; padronizar com `@dnd-kit` se divergir). Movimento entre colunas chama a RPC apropriada, não UPDATE direto:
- TODO → IN_PROGRESS: chama `tech_start_timer` (mantendo convenção que startar timer promove status).
- IN_PROGRESS → REVIEW: chama `tech_send_to_review`.
- REVIEW → DONE: chama `tech_approve_task` (só CEO/CTO pode; Dev tem ação bloqueada na UI).
- REVIEW → IN_PROGRESS (arrastar pra trás): chama `tech_reject_task` (só CEO/CTO).
- Qualquer outra transição via drag é bloqueada (UI não permite).

---

## 5. UX world-class (design visual)

Identidade visual distinta do resto do dashboard. Referências: Linear, Vercel, Stripe Dashboard, Apple.

### 5.1 Linguagem visual

- **Superfície**: fundo não-preto (`#0A0A0C` ou `#0E0E12`) com gradiente radial sutil no topo. Cards em `#141418` com border `1px solid rgba(255,255,255,0.06)`.
- **Tipografia**: Geist (ou Inter em tracking negativo). Pesos 300/500/600 para hierarquia. Números em Geist Mono / `tabular-nums` para timers, horas, IDs. Títulos de página em 28–32px, peso 500, letter-spacing apertado.
- **Paleta**: monocromática zinc. Um único accent (amarelo Milennials do branding OU violeta elétrico — decidir na implementação com apoio de `frontend-design`). Prioridades e tipos codificados com ícones + peso tipográfico, não com paleta colorida.
- **Radius**: 10–12px em cards, 8px em inputs, 6px em badges.
- **Motion**: springs (Framer Motion) em drag-and-drop, mudanças de status e hover states. Timer ativo pulsa sutilmente.
- **Densidade**: linhas de backlog em 36–40px. Aparência de ferramenta de profissional, não dashboard corporativo.

### 5.2 Interações premium

- **Command palette** (`⌘K` / `Ctrl K`): nova task, navegar entre tabs, abrir task por ID, pular para sprint.
- **Atalhos de teclado**: `C` nova task, `/` busca, `G B` backlog, `G K` kanban, `G S` sprints, `E` editar, `T` toggle timer, `R` send to review, `A` approve.
- **Hover states**: cards revelam ações secundárias (timer, assignee, quick-edit) no hover.
- **Drag-and-drop cinematográfico**: card levanta com shadow + tilt, coluna destino brilha, drop encaixa com spring.
- **Timer vivo**: badge numérico atualiza em tempo real (segundos) no card, no row e no header da aba.
- **Empty states** com micro-copy e CTA discreto.
- **Status-line** no rodapé (estilo Linear) substitui toasts.

### 5.3 Telas

**Backlog**: lista tipográfica (não tabela cinza). Tabs horizontais por tipo (Bugs/Features/Hotfixes/Chores/Concluídas) com accent-line 2px embaixo da ativa. Tipo codificado como ícone à esquerda, metadados em mono à direita. Separadores hairline.

**Kanban**: 4 colunas (A fazer · Fazendo · Em teste · Feito) mapeadas 1-para-1 com TODO/IN_PROGRESS/REVIEW/DONE. Headers em caps 11px + tracking largo, contagem em mono, hairline separadora. Cards com padding 14–16px, título em peso 500, metadados 12px muted. Coluna "Feito" tem sutileza visual (opacity 0.75 ou linha dourada). Prioridade CRITICAL marca accent-dot discreto.

**Sprints**: split — sprint ativa com running indicator (ponto pulsante). Dois painéis (Backlog disponível | Tasks da sprint) com drag entre eles. Start/End Sprint têm modal de confirmação mostrando o impacto ("3 tasks BACKLOG virarão TODO").

### 5.4 Modais

- `TaskDetailModal` 720–820px em duas colunas: campos à esquerda, metadados + activities + checklist à direita. Scroll interno.
- Activities em timeline com avatar + ação + timestamp relativo, vertical line conectando.
- Checklist com drag-to-reorder, checkbox arredondado, item concluído fade suavemente.

### 5.5 Responsividade

Desktop-first sem comprometer. Em tablet/mobile: kanban vira swipe horizontal entre colunas; backlog mantém lista.

### 5.6 Acessibilidade

Contraste WCAG AA mínimo (AAA quando possível). Focus rings visíveis mas elegantes (accent + 2px offset). Atalhos de teclado sempre têm alternativa mouse. Screen readers anunciam mudanças de estado do kanban.

### 5.7 Gate `/hm-design`

Obrigatório antes de considerar a Fase 1 shipável. Se reprovar, não merge.

### 5.8 Decisões adiadas para a implementação

- Escolha do accent (amarelo Milennials vs. violeta elétrico).
- Pair tipográfico definitivo (Geist vs. Inter vs. Geist + serif editorial para H1).
- Design tokens (colors/space/radius/shadows) em config Tailwind dedicada ao escopo `milennials-tech/*`.

Essas decisões ficam pinned no plano de implementação, resolvidas com apoio de `frontend-design`.

---

## 6. Regras de negócio (Fase 1)

Todas implementadas em RPCs Postgres (§3.5), não no client.

### 6.1 Status machine

- `BACKLOG → TODO`: automático ao iniciar sprint (tasks BACKLOG da sprint viram TODO).
- `BACKLOG/TODO → IN_PROGRESS`: automático no start do timer.
- `IN_PROGRESS → REVIEW`: manual via `tech_send_to_review`; para timer com STOP.
- `REVIEW → DONE`: `tech_approve_task` (CEO ou CTO).
- `REVIEW → IN_PROGRESS`: `tech_reject_task` (CEO ou CTO).
- `qualquer → BACKLOG`: ao encerrar sprint, tasks != DONE voltam ao BACKLOG + `sprint_id = null`.

### 6.2 Permissões

- CEO e CTO: irrestrito (criar, editar, deletar, aprovar, rejeitar, gerenciar sprints).
- Devs: criam tasks; editam/movem apenas tasks onde são `assignee` ou `collaborator`; não aprovam/rejeitam, não gerenciam sprints, não deletam.
- Seniority fora de escopo nesta fase.

### 6.3 Time tracking

- Tempo total **nunca persistido**; sempre derivado dos eventos em `tech_time_entries`.
- START/RESUME abrem intervalo; PAUSE/STOP fecham. Último evento aberto estende até `now()`.
- Ao START ou RESUME em uma task, RPC cria PAUSE em todos os outros timers ativos do mesmo `user_id` — um usuário nunca tem dois timers ativos simultâneos.
- Estado "ativo" = último evento do par `(task_id, user_id)` é START ou RESUME.
- View `tech_task_time_totals` expõe tempo por task sem loop no client.
- Time tracking isolado ao Milennials Tech; outros kanbans do sistema não são afetados.

### 6.4 Sprints

- Apenas uma sprint `ACTIVE` no sistema, garantido por índice parcial único + validação na RPC.
- PLANNING: livre para adicionar/remover tasks, editar nome/goal/datas.
- START: valida unicidade, promove BACKLOG → TODO das tasks da sprint.
- END: tasks != DONE voltam ao BACKLOG com `sprint_id = null`; sprint vai para COMPLETED.

### 6.5 Bloqueio

- Não muda status da task. Apenas marca `is_blocked` e registra `blocker_reason`. Exibido como cadeado no card.

### 6.6 Validações

- `title`: 1–200 chars (CHECK no banco + Zod no client).
- `sprint.end_date > start_date` (CHECK).
- `estimated_hours > 0` quando presente (CHECK).
- Task sem assignee é permitida.
- Zod no client + CHECK/FK/RLS no banco (defesa em profundidade).

### 6.7 Activities (imutáveis)

Tipos registrados na Fase 1:
`task_created`, `task_updated`, `status_changed` ({from,to}), `task_blocked` ({reason}), `task_unblocked`, `timer_started`, `timer_paused`, `timer_resumed`, `timer_stopped`, `sent_to_review`, `approved`, `rejected`, `collaborator_added`, `collaborator_removed`, `checklist_updated`, `assigned`, `sprint_changed`.

Inseridas por trigger ou pela própria RPC. UPDATE/DELETE bloqueado por policy.

### 6.8 Realtime

Subscribe nas 4 tabelas; handler invalida a query key correspondente do React Query. Sem lógica de negócio no listener.

### 6.9 Ausências explícitas (Fase 1)

- Sem formulários públicos de bug/feature/hotfix.
- Sem roteamento de hotfix (`type=HOTFIX` existe no enum; hotfixes criados manualmente).
- Sem notificações.
- Sem cron de overdue.
- Sem reports.
- Sem settings.
- Sem comentários separados (activities cobrem timeline; comentário estruturado chega na Fase 2).

---

## 7. Migração e rollout

### 7.1 Ordem das migrations

Cada migration é idempotente, reversível (down documentado em comentário no topo) e documenta seus pontos de alteração.

1. `YYYYMMDDHHMMSS_add_cto_role.sql` — enum de cargo + varredura RLS.
2. `YYYYMMDDHHMMSS_create_tech_enums.sql` — os 5 enums.
3. `YYYYMMDDHHMMSS_create_tech_tables.sql` — 5 tabelas + índices + CHECKs + FKs + índice parcial da sprint ACTIVE + trigger `moddatetime` em `tech_tasks`.
4. `YYYYMMDDHHMMSS_tech_rls_policies.sql` — RLS + policies.
5. `YYYYMMDDHHMMSS_tech_views_and_triggers.sql` — view `tech_task_time_totals` + trigger de activities.
6. `YYYYMMDDHHMMSS_tech_rpcs.sql` — todas as RPCs com `SECURITY DEFINER` e `GRANT EXECUTE TO authenticated`.
7. `YYYYMMDDHHMMSS_tech_realtime.sql` — adiciona as 4 tabelas à publication `supabase_realtime`.

### 7.2 Estratégia de deploy

- Sem feature flag. Subsistema novo e isolado; risco de regressão baixo.
- Aplicar migrations em staging → validar (smoke + automatizado) → aplicar em prod.
- PR único engloba migrations + código do subsistema + ajustes do cargo CTO. Atomicidade preservada.
- A aba só aparece quando o frontend também está deployado (sidebar só adiciona o item nos mesmos cargos).

### 7.3 Rollback

- Reverter deploy frontend: aba some.
- Rodar migrations down em ordem reversa se necessário.
- Nenhum outro kanban é afetado (isolamento total).

### 7.4 Seeds

- Nenhum em prod.
- Opcional: script de dev criando 1 sprint PLANNING + 2–3 tasks de exemplo para testar localmente. Não entra em prod.

---

## 8. Testes e gates de qualidade

### 8.1 Banco (pgTAP ou SQL assertions via Supabase CLI)

- `tech_start_timer` pausa outros timers ativos do mesmo user.
- `tech_start_timer` promove BACKLOG/TODO → IN_PROGRESS; mantém se IN_PROGRESS.
- `tech_send_to_review` para timer ativo com STOP antes de mudar status.
- `tech_approve_task` / `tech_reject_task` rejeitam chamada de Dev; aceitam de CEO/CTO.
- `tech_start_sprint` falha se já existe outra ACTIVE.
- `tech_start_sprint` promove BACKLOG → TODO apenas das tasks da sprint.
- `tech_end_sprint` devolve tasks != DONE ao BACKLOG com `sprint_id = null`.
- View `tech_task_time_totals` calcula corretamente: START/PAUSE, START/STOP, START/RESUME/STOP, START com último evento aberto.
- RLS: Dev consegue UPDATE só de task onde é assignee/collaborator; CEO/CTO UPDATE qualquer.
- Activities imutáveis (UPDATE/DELETE retornam 0 rows ou erro).

### 8.2 Frontend (Vitest + Testing Library)

- `useTechTimer` chama a RPC correta para cada ação.
- `computeTaskTime` no client é consistente com a view SQL.
- `permissions.canEditTask` retorna correto para cada combinação de role × task.
- Snapshots das telas principais com dados mock (smoke).

### 8.3 Integração (Playwright, fluxos críticos)

- Dev cria task → aparece no kanban → drag "A fazer" → "Fazendo" (timer inicia) → drag "Em teste" (timer para) → CEO aprova → "Feito".
- CEO cria sprint → adiciona 3 tasks BACKLOG → inicia (tasks viram TODO) → encerra com 1 TODO restante (volta ao BACKLOG).
- Dev inicia timer em task A; dev inicia timer em task B → timer de A pausou automaticamente.
- Realtime: dev 1 cria task em aba A; dev 2 com kanban aberto vê a task aparecer sem refresh.

### 8.4 Gates obrigatórios antes do merge

- `/hm-engineer` — validação de código em todas as camadas.
- `/hm-design` — validação contra padrões da §5. Reprovou, não merge.
- `/hm-qa` — executa fluxos de integração e caça gaps.
- Security review das RPCs (`SECURITY DEFINER` exige auditoria: cada RPC valida `auth.uid()` e cargo antes de tocar em qualquer tabela).
- Tipos gerados do Supabase commitados e usados; zero `any`.

### 8.5 Performance targets

- Kanban com 200 tasks: render < 100ms (virtualização se necessário).
- Drag-and-drop optimistic: UI < 16ms; rollback em erro.
- View `tech_task_time_totals`: < 50ms para 500 tasks (medir; se exceder, materialized view com refresh trigger).

---

## 9. Próximos passos

1. Usuário revisa este spec.
2. Executar `writing-plans` para gerar o plano de implementação detalhado (tarefas atômicas, ordem de execução, critérios de verificação por tarefa).
3. Executar o plano via `executing-plans` ou `subagent-driven-development`, com gates `/hm-engineer`, `/hm-design` e `/hm-qa` nos checkpoints definidos.
