# 0010 — Funil A/B: pipeline do CRM em dois presets fixos, decidido pelo Gestor de ADS

- **Status:** 🟢 Aceito e implementado (grill 2026-06-09; build via `arquiteto` 2026-06-09 — migration `20260609120000_funil_ab_clients_column_and_rpc.sql` rodada no remoto; constantes `FUNIL_A`/`FUNIL_B`; modal refatorado; pgTAP `funil_ab_clients_rpc_test.sql` 11/11)
- **Data:** 2026-06-09
- **Decisores:** Fundador/CTO
- **Relacionado:** `CONTEXT.md` → "Funil (A / B)"; `src/components/gestor-crm/CrmTarefaFormModal.tsx` (radio `Padrão/Personalizado` → `PIPELINE_PADRAO`); `src/components/gestor-crm/CrmGerarTarefaSection.tsx`; `src/hooks/useCrmKanban` (`useCreateCrmConfiguracoes`); `crm_configuracoes.form_data` (pipeline); `src/components/ads-manager/AdsOnboardingSection.tsx` (milestone `criar_estrategia`); `src/components/client/ClientViewModal.tsx`; tabela `clients`

> **Por que este ADR.** Difícil reverter (coluna em `clients` + troca do controle do modal + queda
> do pipeline livre), surpreendente sem contexto (um leitor futuro vai estranhar que o **Gestor de
> ADS** escolhe o **pipeline do CRM**, dentro do **modal de gerar tarefa do CRM**, e que não existe
> mais pipeline personalizado), e fruto de trade-off real (storage em 4 variantes, dono CRM-vs-ADS,
> manter-vs-dropar Personalizado). A intenção deliberada fica registrada aqui.

## Contexto

Hoje o pipeline de qualificação de lead do CRM é montado no modal **"Gerar tarefa Gestor de CRM"**
(`CrmTarefaFormModal`) por um radio binário: **`Padrão (14 etapas)`** (constante `PIPELINE_PADRAO`)
ou **`Personalizado`** (etapas livres digitadas na hora). O pipeline escolhido é gravado em
`crm_configuracoes.form_data.pipeline_*`, por produto.

Dois problemas de negócio:

1. **Não há padronização de estratégia.** "Padrão único + texto livre" não captura que a empresa
   opera **duas jornadas de aquisição distintas** — uma com ramo de automação/qualificação quente,
   outra com cadência manual + coleta + criação de proposta. Cada cliente segue uma delas; o sistema
   não nomeia isso.
2. **A decisão é do ADS, mas não tem dono nem lugar.** Qual jornada o cliente segue é **estratégia
   de aquisição** — pensada pelo Gestor de ADS, não pelo Gestor de CRM. O CRM **executa** as etapas.
   Hoje a escolha some dentro de `form_data` e o ADS não tem como **visualizar** o funil que o
   cliente segue.

## Decisão

Introduzir o **Funil** como atributo de cliente de primeira classe: dois presets fixos e
mutuamente exclusivos do pipeline de CRM — **Funil A** e **Funil B**.

### 1. Dois presets fixos, sem escape-hatch

`PIPELINE_PADRAO` (preset único) e a opção `Personalizado` são **removidos**. O modal passa a ter
**exatamente duas opções: Funil A / Funil B**. Padronização total — todo cliente segue A ou B.

As etapas de cada funil são **constantes em código** (`FUNIL_A`, `FUNIL_B`):

- **Funil A** (14): Novo Lead · Pré Qualificar · Ligação Whatsapp · Automação · Respondeu Disparo ·
  Qualificando · Qualificado Quente · Ligação Marcada · Apresentação Marcada · Proposta Enviada ·
  Nutrição Infinita · Futuro · Sem Resposta · Perdido
- **Funil B** (15): Novo Lead · Pré Qualificar · Ligação Whatsapp · Cadência · Respondeu Disparo ·
  Coletando Informações · Ligação Marcada · Criando Proposta · Apresentação Marcada · Proposta
  Enviada · Nutrição Infinita · Futuro · Sem Resposta · Perdido · Agendado

### 2. Dono: Gestor de ADS, no ato de gerar a tarefa do CRM

Quem **gera a tarefa do Gestor de CRM é o Gestor de ADS** — e é nesse modal que ele **escolhe A ou
B**. A escolha é a tradução, no CRM, da estratégia de aquisição que o ADS desenhou. O Gestor de CRM
**recebe o pipeline já montado e executa** as etapas; não troca o funil.

### 3. Storage: `clients.funil`, fonte única de escrita

O funil é atributo do cliente, não config enterrada no CRM:

- Nova coluna **`clients.funil`** (`text`, `CHECK (funil IN ('A','B'))`, **nullable** até a primeira
  geração de tarefa).
- O modal grava `clients.funil` **e** deriva o pipeline (etapas da constante correspondente) para
  `crm_configuracoes.form_data`, como hoje.
- Fonte única de **escrita**: o modal de geração. Demais superfícies só **leem**.

### 4. ADS visualiza read-only em dois pontos

O funil escolhido aparece **read-only** (badge `Funil A/B` + etapas) em:

- O milestone **`criar_estrategia`** do onboarding do ADS (`AdsOnboardingSection`) — onde o ADS pensa
  estratégia.
- O **olhinho do cliente** (`ClientViewModal`) — visível a qualquer papel que abre o cliente.

## Alternativas consideradas

- **Storage em `crm_configuracoes.form_data`** (em vez de coluna em `clients`): rejeitado — acopla o
  ADS à tabela do CRM só pra visualizar; funil é atributo de cliente, pertence ao kernel.
- **Tabela `client_ads_strategy` dedicada**: rejeitado por ora — peso desproporcional pra um único
  atributo; promove-se a tabela quando houver mais decisões de aquisição.
- **CRM decide / ADS só visualiza** (pedido original): rejeitado — a jornada é estratégia de
  aquisição; o dono é o ADS. CRM executa.
- **Manter `Personalizado`**: rejeitado — padronização total é o objetivo; texto livre reabre a
  fragmentação que o funil resolve.
- **Snapshot das etapas no `form_data`** versionando contra mudança das constantes: adiado — só vale
  se as constantes mudarem com frequência; hoje são estáveis.

## Consequências

- **Positivas:** estratégia de aquisição vira termo nomeado e auditável; ADS dono explícito; CRM só
  executa; ADS e CRM leem o mesmo `clients.funil` barato; modal mais simples (2 opções vs radio +
  editor de etapas livres).
- **Custos / riscos:** migração de schema (`clients.funil`); clientes com `form_data` legado
  (`padrao`/`personalizado`) ficam **como estão** — não há backfill, o funil só passa a existir em
  novas gerações (decidir no build se há retro-classificação); mudar as etapas de um funil depois é
  edição de constante em código (deploy), não config — trade-off consciente por padronização.

## Pendências para o build (via `arquiteto`)

- Migration `clients.funil` + exposição PostgREST.
- Constantes `FUNIL_A`/`FUNIL_B` + refactor do `CrmTarefaFormModal` (remove `PipelineEditor`
  padrao/personalizado).
- Escrita de `clients.funil` no `useCreateCrmConfiguracoes` (atômica com a config).
- Componente read-only de funil reusado em `AdsOnboardingSection` + `ClientViewModal`.
- RLS: escrita de `clients.funil` permitida a quem gera a tarefa (Gestor de ADS / cúpula); leitura
  por quem `pode_ver_cliente`.
- Decisão de retro-classificação dos clientes com pipeline legado.
