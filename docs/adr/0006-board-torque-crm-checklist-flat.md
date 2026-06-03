# 0006 — Board do Gestor de CRM: 6 colunas + checklist achatado; aposenta state-machine rígida, SLA e validation gate

- **Status:** 🟢 Aceito (sign-off de arquitetura/DB na Slice 1/#91, 2026-06-03). Fundação implementada: schema + rename v8→torque + migração de progresso + board 6-col read-only. Slices #92–97 (interações) seguem.
- **Data:** 2026-06-03
- **Decisores:** Fundador/CTO
- **Relacionado:** `CONTEXT.md` → "Torque CRM", "Tier", "Card (de implantação)", "Acompanhamento"; `src/pages/GestorCRMPage.tsx`; `src/hooks/useCrmKanban.ts`; `src/hooks/useCrmStepValidation.ts`; `src/components/gestor-crm/*`
- **Supersede:** a state-machine rígida por produto (`CRM_STEPS_BY_PRODUTO` + fases + gate de avanço `CrmValidationGate`/`useCrmStepValidation`) como **mecanismo de fluxo**. NÃO supersede o conteúdo dos steps — eles sobrevivem como **seed** do checklist.

> **Por que este ADR.** É uma virada de produto difícil de reverter: substitui o board inteiro
> do Gestor de CRM (11 colunas-seção) por 6 colunas e **achata** uma state-machine rica
> (12–16 steps por tier, fases, validações por step com `checklist_items`, gate de avanço, SLA
> por produto) num **checklist plano e editável por card**. Um leitor futuro olhando o código
> antigo vai perguntar "por que jogaram fora todo o gate de validação e o SLA?". A resposta é
> deliberada e está aqui.

## Contexto

O board atual (`GestorCRMPage.tsx`) tem **11 colunas-seção** heterogêneas (Documentação do dia,
Tarefas Diárias, Novos clientes, Boas-vindas, Acompanhamento diário, Config V8/Automation/Copilot,
Justificativa, CRMs Finalizados, Ferramentas PRO+). As 3 colunas de configuração rodam uma
**state-machine independente por produto** (`v8`/`automation`/`copilot`), cada uma com:

- lista ordenada de 12–16 steps (`CRM_STEPS_BY_PRODUTO`),
- agrupamento em fases (`CRM_PHASES_BY_PRODUTO`),
- validações por step (`useCrmStepValidation`, `checklist_items` por step) e **gate de avanço**
  (`CrmValidationGate`) que bloqueia mudar de step,
- SLA por produto (`CRM_CONFIG_DEADLINE_DAYS`: 12/15/10 dias) com card escapando pra Justificativa.

Na prática o fluxo virou pesado demais: dois lugares dizendo "o que falta fazer" (steps + tags
de bloqueio), gate rígido atrapalhando, e colunas operacionais (Documentação/Daily/Boas-vindas)
que diluem o board. O fundador quer um board enxuto, orientado a **checklist por card** e a um
**ciclo de relacionamento pós-implantação** separado.

## Decisão

### 1. Board de implantação — aba KANBAN, 6 colunas

```
A FAZER → TORQUE → AUTOMATION → COPILOT → APRESENTAÇÃO → PRONTOS
```

- **Card = 1 por cliente**, roteado para a coluna do **tier mais alto** (`getHighestProduct`
  preservado — Copilot subsume Automation subsume Torque). `crm_configuracoes` continua sendo a
  linha-base do card.
- **Torque = ex-`v8` renomeado** (label e valor). "V8" aposentado como termo.
- **A FAZER**: card nasce via "Gerar tarefa" no olhinho do cliente (fluxo manual atual,
  `CrmGerarTarefaSection`). Ação **"Começar"** promove o card para a coluna do seu tier.
- **TORQUE/AUTOMATION/COPILOT**: o card abre um **checklist editável** `[{id, label, done}]`.
  Seed inicial = os steps do tier (`CRM_STEPS_BY_PRODUTO` + `CRM_STEP_LABEL`), mas o gestor pode
  **adicionar/remover/renomear** itens por card. **Sem gate de ordem** — qualquer item marcável a
  qualquer momento. Marcar **todos** → card auto-move para APRESENTAÇÃO.
- **APRESENTAÇÃO**: gestor escolhe **data + hora**. A partir de **00h do dia agendado**
  (fuso `America/Sao_Paulo`) liberam dois botões: **PRONTO** (→ PRONTOS) e **REAGENDAR**
  (define nova data/hora, card permanece em APRESENTAÇÃO). Antes do dia, só exibe a data.
- **PRONTOS**: arquivo da implantação (card fica parado, histórico). Ao entrar, **dispara a
  criação de um card novo** na aba Acompanhamentos.

### 2. Board de relacionamento — aba ACOMPANHAMENTOS, 4 colunas

```
Fazer follow-up | Follow-up feito | Tasks em aberto | Aguardando resposta
```

- Entidade **nova e independente** do card de implantação (dois cards, mundos separados). Entra em
  **Fazer follow-up** quando o cliente cai em PRONTOS.
- **Drag livre**: card vive em exatamente uma coluna; gestor move manualmente.
- **Tasks em aberto**: checklist editável que **começa vazio** (gestor define as pendências).
  Marcar **todas** → card auto-move para **Fazer follow-up**.
- **Reset semanal** (toda segunda 00h, `America/Sao_Paulo`): cards em **Follow-up feito** **e**
  **Aguardando resposta** voltam para **Fazer follow-up**. **Tasks em aberto** fica intacto.
  Requer job agendado (pg_cron).

### 3. Migração dos cards vivos — preserva progresso

`crm_configuracoes` em andamento (com `current_step` no meio da máquina) migram mapeando
`current_step` → marca como `done` todos os steps **até ali** no checklist novo, e posiciona o
card na coluna do seu tier. Ninguém perde trabalho. Migration de dados única.

### 4. O que é aposentado (UI removida; tabelas ficam dormentes)

- **State-machine rígida**: gate de avanço (`CrmValidationGate`/`CrmAdvanceButton`),
  validações por step (`useCrmStepValidation`), fases (`CRM_PHASES_BY_PRODUTO`). Os **rótulos dos
  steps sobrevivem** só como seed do checklist.
- **SLA por produto** (`CRM_CONFIG_DEADLINE_DAYS`, badges de deadline, escape pra Justificativa).
- **UI das colunas**: Documentação do dia, Tarefas Diárias, Novos clientes, Boas-vindas,
  Acompanhamento diário, Justificativa, CRMs Finalizados (vira PRONTOS), Ferramentas PRO+.
  As **tabelas** de suporte (`crm_daily_tracking`, etc.) **não são dropadas** — só perdem a UI
  (reversível, não-destrutivo).

## Alternativas consideradas

- **Só trocar o trilho de config, manter as outras 7 colunas.** Mais incremental. **Rejeitado**
  pelo fundador: quer o board enxuto, as colunas operacionais diluíam o foco.
- **1 card por produto contratado** (cliente com 3 tiers = 3 cards). **Rejeitado**: quebra a
  hierarquia `getHighestProduct` e multiplica checklists; o tier mais alto já subsume os menores.
- **Manter a state-machine e sobrepor o checklist.** **Rejeitado**: duplicaria "o que falta
  fazer" em dois sistemas — exatamente a dor atual.
- **Truncar `crm_configuracoes` e começar limpo.** **Rejeitado**: há cards vivos em produção;
  gestores perderiam o ponto onde estavam.
- **Gate de data no datetime exato.** **Rejeitado**: apresentação adiantada travaria. Gate "no
  dia (≥00h)" é tolerante.

## Consequências aceitas

- **Perde-se o gate de validação por step e o SLA por produto.** Aceito: o checklist editável +
  os badges de progresso cobrem "o que falta"; rigidez sai de propósito. Se a disciplina de SLA
  voltar a ser necessária, reentra como badge sobre o card, não como máquina de estados.
- **As tabelas das colunas removidas ficam órfãs de UI.** Aceito como dívida explícita
  reversível; drop fica para uma limpeza futura após confirmar zero uso.
- **Duas automações dependem de job agendado** (reset de segunda; transição de gate de data é
  client-side por comparação de data). Aceito; pg_cron já é padrão do projeto.
- **RLS/permibilidade reusa o escopo `gestor_crm` atual** — sem nova superfície de acesso.

## Pontos de decisão humana (HITL — pendentes de sign-off)

1. **Substituir o board inteiro** (6 colunas) vs. manter colunas operacionais. (Fundador: substituir.)
2. **Achatar a state-machine** em checklist editável, aposentando gate + SLA. (Fundador: sim.)
3. **Migrar vivos preservando progresso** vs. recomeçar. (Fundador: preservar.)
4. **Reset de segunda** cobre Follow-up feito **+** Aguardando resposta (além do texto original que
   citava só Follow-up feito). (Fundador: ampliar para os dois.)

## Sign-off de arquitetura/DB — Slice 1 (#91, 2026-06-03)

Aceito o ADR com dois ajustes de escopo que o texto original da issue não dimensionava
e que a inspeção do banco vivo revelou:

1. **O rename v8→torque é mais largo que `crm_configuracoes.produto`.** O valor de tier `'v8'`
   também vivia em `clients.torque_crm_products` (text[], 8 clientes) — consumido por
   `getTorqueCrmProducts`/`getHighestProduct` para rotear o card. Migrar só `produto` quebraria o
   roteamento de 8 clientes (`getHighestProduct([])` lança). A migração renomeia **ambas as fontes**
   + o CHECK de produto, e limpa o default stale `current_step='criar_pipeline'`. O slug
   **financeiro** `'torque-crm-v8'` (consumido por `process_upsell`/billing) **fica intacto** — é
   outro namespace; `useUpsells` passa a mapear `'torque-crm-v8' → tier 'torque'` na escrita do array.
2. **A RLS de `crm_configuracoes` estava `USING(true)/WITH CHECK(true)`** (qualquer authenticated
   lia/escrevia qualquer card — furo pré-existente). Como a Slice 1 já abre a superfície do board,
   fechei agora: SELECT + write escopados por `is_admin OR has_page_access('gestor-crm') OR
   gestor_id = auth.uid()::text`. Isto torna verdadeira a consequência "RLS reusa escopo gestor_crm"
   que o ADR afirmava mas o schema não cumpria.

Provas: vitest `src/lib/torqueCrm/migracaoSteps.test.ts` (6) + pgTAP
`supabase/tests/torque_board_migration_test.sql` (17, inclui prova de não-perda de progresso e
rejeição de `produto='v8'`). Migração rodada no remoto (`semhnpwxptfgqxhkoqsk`): 0 linhas v8,
31 cards com checklist preenchido, progresso conferido contra a ordem canônica dos steps.
