---
title: Mtech (Milennials Tech)
tags:
  - feature
  - mtech
  - tech
---

# Mtech (Milennials Tech)

> [!abstract] O módulo técnico
> Mtech é um sistema **Scrum-like** para o time de engenharia: sprints com 1 ativa por vez, tasks com status fechado (BACKLOG→TODO→IN_PROGRESS→REVIEW→DONE), timer por task, aprovação executiva. É o módulo mais "por livro" do sistema — contrasta com os [[03-Features/Kanbans por Área|kanbans por área]] que usam swim lanes de pessoa.

Pasta: `src/features/milennials-tech/`.

## Quem acessa

Regra:

```ts
canAccess = isExecutive(role)       // ceo, cto
         || role === 'devs'
         || profile.can_access_mtech === true
```

Ver [[01-Papeis-e-Permissoes/Flag can_access_mtech]].

Submit task (`/submit-task`) é aberto para **qualquer autenticado**, mesmo sem flag — intencional.

## Rotas

| Rota | Tab / Página |
|---|---|
| `/mtech` (ou `/milennials-tech`) | parent layout |
| `/mtech/kanban` | Kanban tab |
| `/mtech/backlog` | Backlog tab |
| `/mtech/sprints` | Sprints tab |
| `/submit-task` | formulário público de submissão |

## Arquitetura

```
src/features/milennials-tech/
├── pages/
│   ├── BacklogTab.tsx
│   ├── KanbanTab.tsx
│   ├── SprintsTab.tsx
│   └── SubmitTaskPage.tsx
├── components/
│   ├── TaskCard.tsx           // card no Kanban
│   ├── TaskRow.tsx            // linha no Backlog
│   ├── TaskDetailModal.tsx    // modal de detalhe
│   ├── TaskFormModal.tsx      // criar/editar task
│   ├── SprintFormModal.tsx    // criar/editar sprint
│   ├── KanbanColumn.tsx
│   └── BacklogTabs.tsx
├── hooks/
│   ├── useTechTasks.ts
│   ├── useTechSprints.ts
│   ├── useTechTimer.ts
│   ├── useActiveTimer.ts
│   ├── useTechRealtime.ts
│   └── useProfileMap.ts
├── lib/
│   ├── statusLabels.ts        // PT labels + KANBAN_COLUMNS
│   ├── permissions.ts         // canDragToColumn
│   ├── computeTaskTime.ts     // soma intervalos de time entries
│   └── canApprove.ts
├── schemas/                   // zod schemas dos forms
└── types.ts                   // TechTask, TechSprint types
```

## Tabelas

| Tabela | Papel |
|---|---|
| `tech_sprints` | sprints: `name`, `goal`, `start_date`, `end_date`, `status` (PLANNING/ACTIVE/CLOSED). Unique index garante 1 ACTIVE. |
| `tech_tasks` | task principal. Status fixo (enum), priority, assignee, **`created_by` imutável**, deadline, `estimated_hours`, `acceptance_criteria`, `technical_context`, `git_branch`, `checklist JSONB`, `is_blocked`, `blocker_reason` |
| `tech_task_collaborators` | N:M — colaboradores além do assignee |
| `tech_time_entries` | entries de timer — `type` (START/PAUSE/RESUME), `seq` (ordenação determinística) |
| `tech_task_activities` | activity log append-only — `type`, `data JSONB` |
| `tech_task_attachments` | metadados; bytes no bucket `tech-attachments` |
| `tech_task_tags` | N:M tags |

## Tabs em detalhe

### Backlog Tab (`BacklogTab.tsx`)

- Lista todas tasks em status BACKLOG + TODO
- Filtros: busca por título, tabs de categoria
- Click em linha abre [[#TaskDetailModal]]
- Pode criar task via botão (abre TaskFormModal)
- **Executivo** pode mover/atribuir/deletar inline

### Kanban Tab (`KanbanTab.tsx`)

- 5 colunas fixas: BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE
- Cards mostram: avatar creator + assignee, prioridade, deadline, tags, bloqueio
- Drag entre colunas respeita `canDragToColumn()` em `lib/permissions.ts`
- Clique no card abre TaskDetailModal

### Sprints Tab (`SprintsTab.tsx`)

- Lista de sprints (PLANNING, ACTIVE, CLOSED)
- Destaque para sprint ACTIVE
- Botões: criar sprint, iniciar sprint, encerrar sprint
- Por sprint: lista de tasks agrupadas, totais de tempo
- Click em task → TaskDetailModal

## Sprints

Modelo:

```
status PLANNING → admin pode adicionar/remover tasks, ajustar goal
status ACTIVE   → sprint em execução, tasks visíveis no /mtech/kanban
status CLOSED   → histórico; tasks não-DONE foram movidas de volta para BACKLOG
```

**Unique index em `status = 'ACTIVE'`** garante só 1 sprint ativa.

RPCs:
- `tech_start_sprint(_sprint_id)` — PLANNING → ACTIVE. Falha se já há ACTIVE.
- `tech_end_sprint(_sprint_id)` — ACTIVE → CLOSED. Move tasks não-DONE para BACKLOG e limpa `sprint_id`.

## Timer

[[02-Fluxos/Ciclo de Tasks Mtech#Timer]].

**1 timer ativo por usuário** — ao iniciar/retomar em task A, qualquer timer ativo em outra task é automaticamente pausado.

Hook global: `useActiveTimer()` — retorna a task que está sendo cronometrada agora mesmo.

**Nota importante**: até abril/2026, as abas `BacklogTab`, `KanbanTab`, `SprintsTab` **bloqueavam** abertura de outras tasks quando havia timer ativo (toast "finalize o timer da task atual"). Isso foi removido — clicar em card de REVIEW para aprovar não deveria ser impedido pelo timer. Ver commit `e56e7ae`.

## Submit Task (formulário público)

Rota: `/submit-task`. Acessível a **qualquer autenticado**.

Campos: título, tipo, descrição, acceptance_criteria, technical_context, prioridade, deadline, tags, attachments.

Ao submeter: RPC `submit_task()` insere em `tech_tasks` com:
- `status = BACKLOG`
- `created_by = auth.uid()` (imutável)
- `assignee_id = null`

A submissão **não** atribui automaticamente. Admin revisa depois.

## Imutabilidade do creator

`tech_tasks.created_by` é trancado por trigger (`tech_tasks_lock_created_by`). Qualquer UPDATE que tente mudar essa coluna levanta exceção.

Motivo: auditoria e crédito de ideia. Quem submeteu uma task é o "dono intelectual" — o assignee pode mudar, mas o creator não.

Commit: `9158096 feat(mtech): lock tech_tasks.created_by as immutable`.

## Atribuição e avatares

`useProfileMap()` provê map `user_id → profile` para evitar N queries ao renderizar cards.

Display rules:
- Se `creator == assignee` → 1 avatar com accent dot
- Se diferentes → stack de 2 avatares
- Tooltip mostra nomes (guard contra null profile — ver `9c59925`)

## Matriz de transições (canDragToColumn)

`src/features/milennials-tech/lib/permissions.ts`:

| De → Para | Condição |
|---|---|
| BACKLOG → TODO | executivo ou gestor_projetos |
| TODO → IN_PROGRESS | assignee/collaborator (starta timer) — ou executivo |
| IN_PROGRESS → REVIEW | assignee/collaborator |
| REVIEW → DONE | **executivo apenas** |
| REVIEW → IN_PROGRESS | executivo (rejeita) |
| Qualquer → BACKLOG | executivo |

## Realtime

Único módulo com realtime ativo. Ver [[00-Arquitetura/Realtime e Polling]].

Subscriptions:
- `tech_tasks` — criações, updates, deletes
- `tech_sprints` — transições de sprint
- `tech_time_entries` — timer ao vivo
- `tech_task_activities` — log em tempo real

## Attachments

Bucket: `tech-attachments` (público). Policies:
- SELECT: qualquer autenticado
- INSERT: `can_see_tech()`
- DELETE: executivo ou uploader

Upload via RPC `tech_submit_attachment()` → insere em `tech_task_attachments` e retorna URL pública.

## Comments

RPC `tech_comment_task(_task_id, _content)` → insere em `tech_task_activities` com `type='comment'`, `data={content}`. Renderizado na timeline do TaskDetailModal.

## Relatórios de tempo

RPC `tech_get_time_totals(_task_id, _user_id)` retorna soma agregada em segundos/minutos/horas. Usado para:
- Dashboard de horas por dev
- Fechamento de sprint (horas gastas vs. estimadas)
- Billable hours se aplicável

## Links

- [[02-Fluxos/Ciclo de Tasks Mtech]]
- [[01-Papeis-e-Permissoes/Flag can_access_mtech]]
- [[01-Papeis-e-Permissoes/Funções RLS#Módulo Mtech]]
- [[04-Integracoes/Storage Buckets]]
