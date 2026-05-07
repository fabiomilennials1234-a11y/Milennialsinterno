# Gestão de Projetos — CTO View

> Camada de projetos acima do Milennials Tech existente. Nova tab "Projetos" no MilennialsTechPage. Visão executiva (CEO/CTO only). Kanban por etapas com automação, tracking diário, e matriz de alocação de equipe.

## Escopo

- Projetos de clientes e internos no mesmo board, diferenciados por tipo
- Camada ACIMA das tasks: cada projeto agrupa tech_tasks via `project_id`
- Somente CEO/CTO vê a tab Projetos; devs continuam no Milennials Tech normal
- Fluxo fixo universal de 8 etapas com tarefas automáticas
- Tracking diário com alertas (igual CRM)
- Matriz completa de alocação de equipe (dev × projeto × horas)

## Data Model

### tech_projects

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| name | TEXT NOT NULL | "CRM Torque v2", "Dashboard Growth" |
| description | TEXT | Descrição do projeto |
| type | TEXT CHECK ('client', 'internal') | Diferencia no board |
| status | TEXT CHECK ('planning', 'active', 'paused', 'completed') | Status operacional |
| current_step | TEXT NOT NULL DEFAULT 'briefing' | Etapa atual no fluxo de 8 |
| priority | TEXT CHECK ('critical', 'high', 'medium', 'low') | Prioridade estratégica |
| lead_id | UUID FK auth.users | Dev lead responsável |
| client_id | UUID FK clients NULLABLE | Se tipo 'client', referência ao cliente |
| start_date | TIMESTAMPTZ | Início planejado |
| deadline | TIMESTAMPTZ | Prazo final |
| estimated_hours | NUMERIC | Horas estimadas totais |
| created_by | UUID FK auth.users NOT NULL | Quem criou |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | |

### tech_project_members (N:M)

| Coluna | Tipo | Descrição |
|---|---|---|
| project_id | UUID FK tech_projects | |
| user_id | UUID FK auth.users | |
| allocated_hours_week | NUMERIC DEFAULT 0 | Horas/semana alocadas |
| role | TEXT CHECK ('lead', 'dev', 'design', 'qa') | Função no projeto |
| PK | (project_id, user_id) | Composta |

### tech_project_tracking

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK tech_projects UNIQUE | 1 registro por projeto |
| lead_id | UUID NOT NULL | Lead do projeto |
| current_day | TEXT CHECK ('segunda'...'sexta') | Dia da última movimentação |
| last_moved_at | TIMESTAMPTZ | Timestamp da última movimentação |
| is_delayed | BOOLEAN DEFAULT false | Flag de atraso |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | |

### Alteração em tech_tasks

```sql
ALTER TABLE tech_tasks ADD COLUMN project_id UUID REFERENCES tech_projects(id);
CREATE INDEX idx_tech_tasks_project ON tech_tasks(project_id);
```

## State Machine — 8 Etapas Fixas

```
briefing → arquitetura → setup_ambiente → desenvolvimento → code_review → testes → deploy → acompanhamento
```

| Step | Label | Tarefa automática pro Lead |
|---|---|---|
| briefing | Briefing Técnico | "Levantar requisitos e documentar briefing — [Projeto]" |
| arquitetura | Arquitetura / Design | "Definir arquitetura e stack — [Projeto]" |
| setup_ambiente | Setup de Ambiente | "Configurar repositório e ambiente — [Projeto]" |
| desenvolvimento | Desenvolvimento | "Iniciar desenvolvimento — [Projeto]" |
| code_review | Code Review | "Revisar código e aprovar PRs — [Projeto]" |
| testes | Testes / QA | "Executar QA e validar entrega — [Projeto]" |
| deploy | Deploy | "Realizar deploy e verificar produção — [Projeto]" |
| acompanhamento | Acompanhamento | "Acompanhar pós-entrega (7 dias) — [Projeto]" |

Ao concluir último step → `status = 'completed'` + notificação pro CTO.

Motor idêntico ao CRM: tarefa feita → `current_step` avança → nova tarefa criada → idempotente (NOT EXISTS guard).

## UI — Tab Projetos

### Localização

Nova tab no MilennialsTechPage: `Backlog | Kanban | Sprints | **Projetos**`

Visível apenas para `isExecutive(role)` (CEO/CTO).

Rota: `/milennials-tech/projetos`

### Kanban horizontal

8 colunas correspondendo às 8 etapas. Scroll horizontal com chevrons (padrão CRM).

| Coluna | Cor | Ícone |
|---|---|---|
| Briefing Técnico | sky | ClipboardList |
| Arquitetura | violet | PenTool |
| Setup Ambiente | amber | Settings |
| Desenvolvimento | blue | Code |
| Code Review | orange | GitPullRequest |
| Testes / QA | emerald | TestTube |
| Deploy | purple | Rocket |
| Acompanhamento | green | Eye |

Largura fixa por card: 340px. Cards arrastáveis entre colunas (drag = avança step).

### Card do projeto

Exibe:
- Nome + badge tipo (Cliente → azul, Interno → cinza)
- Barra de progresso (etapa X de 8)
- Lead (avatar + nome)
- Devs alocados (avatares empilhados, max 4 + overflow "+N")
- Deadline + dias restantes (vermelho se <3 dias ou estourado)
- Contador de tasks (pendentes / total)
- Badge prioridade (critical = vermelho, high = laranja)
- Cliente vinculado (nome, se tipo client)

### Drill-down

Click no card → modal ProjectDetailModal:
- Todos os campos do projeto (edição inline)
- Lista de members (adicionar/remover, editar horas)
- Tasks do projeto (tabela filtrada de tech_tasks WHERE project_id = X)
- Activity log do projeto
- Botão "Ver no Kanban" → redireciona pra tab Kanban com filtro project_id

### Header

- Botão "Novo Projeto" (abre ProjectFormModal)
- Filtros rápidos: tipo (client/internal), prioridade, lead
- Toggle "Kanban / Equipe" (alterna entre views)
- Toggle "Só ativos / Todos"

## UI — Visão Equipe (Matriz)

Toggle "Equipe" no header da tab Projetos.

Tabela/matriz: linhas = devs, colunas = projetos ativos, células = horas/semana.

| Dev | Projeto A | Projeto B | Projeto C | Total/sem | Status |
|---|---|---|---|---|---|
| João | 20h | 10h | — | 30h | Normal |
| Maria | — | 20h | 20h | 40h | Sobrecarregado |
| Pedro | 10h | — | — | 10h | Disponível |

Regras visuais:
- 0-20h/sem: verde "Disponível"
- 20-35h/sem: neutro "Normal"
- 35h+/sem: vermelho "Sobrecarregado"

Dados: `tech_project_members.allocated_hours_week` somados por user.

Ações:
- Editar horas inline (click na célula)
- Click na célula → ver tasks do dev naquele projeto
- Filtrar por projeto, por dev, por status de carga

## Tracking Diário + Alertas

### Entrada no tracking

Projeto entra no tracking quando `status = 'active'` E `current_step` está entre `desenvolvimento` e `acompanhamento`.

Cria registro em `tech_project_tracking` com `lead_id` do projeto.

### pg_cron (seg-sex 06:00 BRT)

Função `_cron_check_project_delays()`:

| Condição | Ação | Destinatário |
|---|---|---|
| `last_moved_at` > 2 dias | Tarefa `department_tasks`: "Verificar andamento do projeto [Nome]" | Lead (department='devs', priority='high') |
| `last_moved_at` > 5 dias | Notificação `system_notifications`: "Projeto [Nome] parado há 5 dias" | CTO |
| `deadline` em < 3 dias | Tarefa: "Deadline se aproximando — [Nome]" | Lead |
| `deadline` estourado | Notificação alta prioridade | CTO + Lead |

Idempotente: NOT EXISTS guard por project_id + título + data.

### Saída do tracking

Projeto sai quando `status` muda pra `completed` ou `paused`. Registro deletado de `tech_project_tracking`.

## Permissões

| Ação | CEO/CTO | Dev/Lead |
|---|---|---|
| Ver tab Projetos | Sim | Não |
| Criar projeto | Sim | Não |
| Editar projeto | Sim | Não |
| Arrastar entre etapas | Sim | Não |
| Ver drill-down de tasks | Sim | (via Milennials Tech normal) |
| Ver matriz de equipe | Sim | Não |
| Editar alocação | Sim | Não |

RLS: `tech_projects` visível apenas para executivos. `tech_project_members` e `tech_project_tracking` seguem mesma regra.

`tech_tasks.project_id` é visível pra devs (eles vêem a qual projeto pertencem), mas não acessam a tab Projetos.

## Não incluso (futuro)

- Burndown chart por projeto (item 1.1 do planejamento geral Mtech)
- Templates de projeto
- Dependências entre projetos
- Orçamento/custo por projeto
- Integração com Git/PRs automática
