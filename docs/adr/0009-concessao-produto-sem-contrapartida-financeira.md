# 0009 — Concessão: adição de produto a cliente sem contrapartida financeira

- **Status:** 🟡 Proposto (grill 2026-06-08, sign-off de arquitetura pendente — entra pelo `arquiteto`)
- **Data:** 2026-06-08
- **Decisores:** Fundador/CTO
- **Relacionado:** `CONTEXT.md` → "Upsell vs Concessão", "Torque CRM / Tier"; módulo `financeiro` (CONTEXT.md linha 182); `supabase/migrations/20260203190438_*.sql` (tabela `upsells` + trigger `process_upsell`); `20260223100000_financeiro_per_product.sql` (comissão 7%, `financeiro_active_clients`); `20260409100000_create_mrr_changes.sql`; `src/components/upsells/CreateUpsellModal.tsx`; `src/components/client/ClientViewModal.tsx`

> **Por que este ADR.** Difícil reverter (tabela + RPC + semântica financeira), surpreendente
> sem contexto (um leitor futuro vai estranhar linhas `monthly_value = 0` no financeiro e uma
> entidade `Concessão` paralela ao `Upsell` que entrega o mesmo produto), e fruto de trade-off
> real (escolhemos conceito-separado vs flag-no-upsell, linha-financeiro-zerada vs sem-linha,
> qualquer-produto vs só-tiers-CRM). A intenção deliberada está registrada aqui.

## Contexto

Hoje, **anexar um produto a um cliente só existe por um caminho: o `Upsell`**. Inserir um upsell
dispara o trigger `process_upsell` em cascata, sem condicional:

1. **Comissão automática 7%** — `upsell_commissions`, `monthly_value * 0.07` (hardcoded).
2. **Expansão de MRR** — `mrr_changes` tipo `expansion`.
3. **Linha per-product** em `financeiro_active_clients`.
4. **Cards de board** (entrega real do produto).

Não há forma de adicionar produto **sem** gerar dinheiro. O caso de negócio que falta: **retenção
de cliente em risco** — cliente entra só com Growth, ao longo do tempo entra em risco de churn, e
a empresa **concede** um Torque Copilot de cortesia. O time precisa **entregar** o Copilot de
verdade (board, envolvidos, tier), mas **sem** gerar comissão para ninguém nem inflar o MRR/ticket
do cliente (não houve venda).

Forçar isso como "upsell de R$ 0" é semanticamente errado (upsell = venda) e frágil (o galho
condicional viveria no trigger de venda). O glossário do projeto valoriza termos limpos.

## Decisão

Introduzir um conceito de domínio de primeira classe: **Concessão** — produto concedido a um
cliente **sem contrapartida financeira**. Distinto e paralelo ao `Upsell`.

### 1. Entrega idêntica, dinheiro suprimido

A Concessão **reusa o pipeline de entrega** do upsell (entra em `contracted_products`, gera card
de board roteado por produto, registra envolvidos/tier) e **suprime apenas os galhos de dinheiro**:

- **Zero comissão** — não gera `upsell_commissions`.
- **Zero variação de MRR** — não gera `mrr_changes`.
- Aparece em `financeiro_active_clients` com **`monthly_value = 0`** — financeiro enxerga o produto
  (auditoria: "quantas concessões ativas, por qual motivo"), sem valor que mexa no MRR/ticket.

Consequência de implementação: a parte "entrega" precisa ser **fatorada** da parte "dinheiro" no
pipeline de upsell, para ser reusada pela RPC de concessão sem duplicar lógica de geração de card.

### 2. Escopo: qualquer produto do catálogo

Concessão é genérica — vale para qualquer produto (Growth, Outbound, Paddock, tiers do Torque CRM,
etc). A geração de card **roteia por produto** (tier Torque → board CRM via `torque_board_gerar`,
respeitando subsunção um-card-por-cliente; outro produto → board do produto). Modelo de dados nasce
genérico (`product_slug` livre).

### 3. Governança

- **Quem concede:** `admin` + `sucesso_cliente` (CS é quem segura churn).
- **Motivo obrigatório** — enum de risco: `risco_churn`, `compensacao_falha`,
  `negociacao_renovacao`, `cortesia_estrategica`. Enum (não texto livre) para manter auditável.

### 4. Ciclo de vida

Status: **`ativa → convertida | revogada`**. Expiração `contract_expires_at` **opcional** (força CS
a revisitar "ainda vale dar de graça?").

- **Converter (`convertida`)** — cliente retido passa a pagar. Transição **puramente financeira**:
  gera comissão + expansão de MRR + sobe `monthly_value` da linha financeiro de 0 para o valor
  acordado. **Não recria card** (produto já está entregue). Histórico preserva que começou como
  concessão.
- **Revogar (`revogada`)** — **teardown físico**: arquiva o card de board, remove de
  `contracted_products`, inativa a linha financeiro. Cliente perde o produto. Concessão fica
  `revogada` no histórico.

### 5. Superfície de UI

- **Conceder** — no **Card Universal do cliente** (`ClientViewModal`): ato contextual, onde a
  decisão de retenção nasce.
- **Gerenciar** (listar, revogar, converter) — **página própria "Concessões"**: portfólio de
  margem concedida para CS/admin (visão agregada de governança).

### 6. Propriedade de módulo

Concessão pertence ao módulo **`financeiro`** (dono de upsells/MRR/comissões — CONTEXT.md linha
182). Tabela no schema do módulo, escrita via **RPC tipada do módulo** (contrato), não escrita
direta — alinhado ao monolito modular (ADR 0004).

## Considered Options

### Conceito separado (Concessão) vs flag em `upsell` — **escolhido: separado**

Flag (`is_cortesia`/`tipo` em `upsells`) reusaria modal/hook/página, menos código. **Rejeitado:**
polui o termo `upsell` (que significa venda com comissão — "upsell de R$ 0 sem comissão" é
contradição) e enfia galho condicional frágil no trigger de venda. Conceito separado mantém
`upsell` puro e dá nome auditável ao ato de retenção.

### Linha financeiro `monthly_value = 0` vs nenhuma linha — **escolhido: linha zerada**

Sem linha, o produto ficaria invisível ao financeiro. Linha zerada dá auditoria ("quantos Copilots
de cortesia, por qual risco") sem inflar MRR.

### Qualquer produto vs só tiers do Torque CRM — **escolhido: qualquer produto**

Restringir a tiers CRM seria MVP enxuto (resolve o caso Copilot-de-retenção sem mapear geração de
card de 17 produtos). Optou-se por genérico já — a geração de card roteia por produto e reusa o
pipeline de upsell que já lida com qualquer produto.

## Consequences

- Pipeline de entrega do upsell precisa ser **refatorado** para separar "entrega" de "dinheiro" —
  dívida de design assumida para evitar duplicação.
- Dashboards de MRR/ticket **ignoram** concessões (valor 0). Métricas de retenção/churn-saved
  ficam **fora do escopo v1** (concessão não atribui receita-salva automaticamente).
- `financeiro_active_clients` passa a conter linhas legítimas de `monthly_value = 0` — consultas de
  MRR que assumem valor > 0 devem ser auditadas.
- Badge de produto no cliente pode querer distinção visual "cortesia" (decisão de design, fora
  deste ADR).
