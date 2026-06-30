---
status: accepted
---

# Hierarquia Epic→Issue→Sub-task se expõe na UI mantendo o modelo Jira padrão

## Contexto

O fundador pediu "linkar como no Jira: dentro de uma história uma task, dentro das
tasks as subtasks". A investigação mostrou que o **modelo de dados já existe** (ADR 0014):
`tech_tasks.parent_id` (self-ref + CHECK que proíbe pontos/epic em sub-task),
`tech_tasks.epic_id`, tabela `tech_epics`, RPCs `tech_issue_create(p_epic_id, p_parent_id)`
e `tech_issue_update(p_epic_id)`, hooks `useCreateIssue(epicId)`, `useRelinkIssueEpic`,
`useTechEpics`, `useEpicRollupMap`. O Roadmap já consome epics fullstack. O gap era **só
de superfície**: backlog/board não expõem a relação Epic↔issue, e `useRelinkIssueEpic`
nunca foi fiado.

Surgiu uma tensão de vocabulário: o fundador chama de "história" o **contêiner** que
agrupa tasks. No modelo (e no Jira real), quem contém é a **Epic** — `STORY` e `TASK` são
issues standard do **mesmo nível** (irmãs), não pai/filho. "História" foi mapeada para
**Epic** (CONTEXT.md:279-285), sem renomear o termo no produto.

## Decisão

**Manter o modelo Jira padrão como está no DB e apenas expô-lo na UI** — não remodelar
para aninhamento literal `Story → Task`. Hierarquia canônica permanece
`Project > Epic > {Story/Bug/Task} > Sub-task`.

Fiação de superfície (#169):

- **Linkar issue↔Epic em dois pontos**: seletor de Epic no `IssueCreateModal` (cria) e
  campo de Epic no detail da issue para trocar/desvincular (fia `useRelinkIssueEpic`).
- **Backlog agrupado por Epic**: seções colapsáveis com header (título + rollup de
  pontos/contagem via `useEpicRollupMap`), seção "Sem Epic" para issues soltas, chip
  colorido de Epic por row, toggle de agrupamento (default ligado).
- **Sub-task sinalizada por fora**: badge de progresso `done/total` no row/card (exige
  agregar sub-tasks por parent na query do backlog/board).
- **Board kanban**: mantém swimlane por squad; cards ganham o chip de Epic (sem swimlane
  por epic).
- **Criar Epic a partir do backlog**: botão "Nova Epic" abrindo `EpicFormModal`, tornando
  a Epic cidadã de 1ª classe onde o trabalho vive.

## Opções consideradas

- **A — `Story` contém `Task` (aninhamento literal de 3 níveis de parent).** Bate com a
  frase do fundador ao pé da letra, mas **diverge do Jira real** (onde Story/Task são
  irmãs), exigiria aceitar 3 níveis de `parent_id` e reabrir os CHECK constraints de
  sub-task. Rejeitada: contradiz ADR 0014 e o padrão da indústria sem ganho.
- **B — expor o modelo existente via UI (escolhida).** Zero mudança de schema, reaproveita
  RPCs/hooks já em produção, alinha ao Jira real. "História" = Epic resolve a intenção do
  fundador sem remodelar.

## Consequências

- **Sem migration**: backend intocado; trabalho é majoritariamente front + 1 ajuste de
  query (agregação de sub-tasks por parent). Risco de regressão baixo.
- O termo "história" do fundador vive como **Epic** no código/glossário — qualquer doc/UI
  futura usa "Epic" para o contêiner; não há tipo nem tabela "História".
- Fora de escopo deliberado: swimlane por Epic no board e o fix do `demanda_id` TODO no
  `EpicFormModal` (Epic coleta a demanda mas não passa pra RPC) — re-abrir se necessário.
