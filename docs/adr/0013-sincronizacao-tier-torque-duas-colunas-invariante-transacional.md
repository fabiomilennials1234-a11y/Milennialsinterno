# 0013 — Tier Torque CRM: duas colunas + invariante de sincronização transacional na origem

- **Status:** 🟢 Aceito (decisão do fundador; diagnóstico fechado pelo arquiteto). Implementado: sync em `_entregar_produto` + remoção do patch client-side + pgTAP.
- **Data:** 2026-06-15
- **Decisores:** Fundador/CTO
- **Relacionado:** ADR 0006 (rename v8→torque, board Torque CRM); `public._entregar_produto`; `public.process_upsell` (trigger), `public.conceder_produto` (RPC); `src/hooks/useUpsells.ts`; `src/hooks/useTorqueCrmClients.ts`; `clients.contracted_products`, `clients.torque_crm_products`
- **Migration:** `supabase/migrations/20260615160000_entregar_produto_sync_torque_tier.sql`
- **Provas:** pgTAP `supabase/tests/entregar_produto_sync_torque_tier_test.sql` (13/13 contra o remoto)

> **Por que este ADR.** Registra por que o sistema mantém DUAS colunas de produto
> aparentemente redundantes em `clients` e como a consistência entre elas é
> garantida. Um leitor futuro olhando `contracted_products` e `torque_crm_products`
> vai perguntar "por que não uma só?" — a resposta é deliberada e está aqui.

## Contexto

O cliente Torque CRM tem duas representações de produto, com semânticas distintas:

- **`clients.contracted_products`** (`text[]`) — o que o cliente **contratou/é
  faturado**. Carrega slugs de billing, incluindo a base `'torque-crm'` e os
  sub-slugs de upsell (`'torque-crm-automation'`, `'torque-crm-v8'`, etc.).
- **`clients.torque_crm_products`** (`text[]`) — o **tier operacional** que o board
  do Gestor de CRM usa para rotear o card (`getHighestProduct`: copilot ⊃
  automation ⊃ torque). Valores canônicos: `'torque'`, `'automation'`, `'copilot'`.

`useTorqueCrmClients` só lista clientes que têm **ambos**: a base `'torque-crm'` em
`contracted_products` **e** ≥1 tier em `torque_crm_products`. Quando as duas colunas
**derivam** (drift) — cliente faturado por um sub-tier torque mas sem o tier
operacional gravado — ele **some da lista de briefing**, sem erro visível.

A causa-raiz do drift era a escrita das duas colunas em lugares diferentes e sem
atomicidade: um patch **client-side** em `useUpsells` (`useCreateUpsell`) fazia
read-modify-write de `torque_crm_products` e garantia a base em
`contracted_products` em duas queries separadas, fora de transação. Esse patch:
(a) só cobria o caminho de **upsell**, não o de **concessão** (`conceder_produto`);
(b) era frágil (race entre read e write, sem rollback conjunto); (c) duplicava no
cliente uma regra de domínio load-bearing (mapeamento legado `v8→torque`, ADR 0006).

## Decisão

**Opção C: manter as duas colunas; impor a sincronização TRANSACIONALMENTE na
origem da escrita.**

- As duas colunas permanecem, com responsabilidades separadas: `contracted_products`
  = contrato/billing; `torque_crm_products` = tier operacional do board.
- A invariante de consistência ("todo cliente com tier tem a base `'torque-crm'`")
  é imposta em **`public._entregar_produto`** — o **ponto ÚNICO de entrega** de
  produto, `SECURITY DEFINER`, chamado por `process_upsell` (upsell) **e**
  `conceder_produto` (concessão). Sincronizar ali cobre os **dois** caminhos numa
  única transação implícita.
- Ao entregar um slug `'torque-crm-<sufixo>'`, a função deriva o tier (regra
  load-bearing, ADR 0006: `v8→torque`; `torque/automation/copilot` mapeiam para si;
  qualquer outro sufixo é **ignorado silenciosamente**, sem falhar) e, se válido,
  garante atomicamente **(a)** a base `'torque-crm'` em `contracted_products` e
  **(b)** o tier em `torque_crm_products`. Tudo idempotente (guard com `ANY()`).
- O patch client-side em `useUpsells` é **removido** — as duas escritas de coluna
  saem; só permanece a criação da tarefa de briefing do Treinador Comercial, que
  não é coberta pelo server.

## Alternativas consideradas

- **A) Coluna única / colapsar as duas.** Uma só coluna serviria billing e board.
  **Rejeitado:** os namespaces são genuinamente distintos — billing carrega
  sub-slugs (`'torque-crm-automation'`) e produtos não-torque; o board quer só o
  tier canônico com hierarquia de subsunção. Colapsar forçaria derivação no read em
  todo consumidor (billing teria de filtrar tier; board teria de parsear slug),
  espalhando a regra `v8→torque` por mais lugares — o oposto do objetivo. Migração
  destrutiva e irreversível sobre dado de produção.
- **B) View derivada / trigger de reconciliação.** `torque_crm_products` viraria
  uma view (ou um trigger reconciliaria as colunas pós-fato). **Rejeitado:** view
  perde a capacidade de o fundador definir tier manualmente desacoplado do billing
  (estado "base sem tier" deixaria de ser representável). Trigger de reconciliação
  AFTER esconde a regra num gatilho implícito, mais difícil de testar e auditar que
  um bloco explícito no ponto de entrega; e reconciliar "pós-fato" reintroduz a
  janela de drift que queremos eliminar.
- **C) Duas colunas + sync transacional na origem [ESCOLHIDA].** Mantém a separação
  semântica, elimina o drift na fonte, cobre os dois caminhos de escrita num único
  ponto testável e atômico, e preserva o estado legítimo "base sem tier".

## Consequências aceitas

- **O estado "contratou base `'torque-crm'`, tier a definir" é legítimo.** Não é
  bug — é o fundador decidindo o tier depois. Esses clientes ficam invisíveis na
  lista de briefing **por design**, não por inconsistência.
- **4 clientes pendentes** (Cauã Mathias, Hugo Dias, JC, Ricardo Pasqualini)
  permanecem `base_sem_tier` por **decisão explícita** do fundador (tier a definir),
  não por bug. NÃO recebem backfill nem tier default. Confirmado pós-migration:
  contagem `base_sem_tier` permanece exatamente 4.
- **A regra `v8→torque` agora vive só no server** (`_entregar_produto`). O slug de
  billing `'torque-crm-v8'` continua intacto em `contracted_products` — outro
  namespace —; só o **tier** derivado é normalizado para `'torque'`.
- **Patch client-side removido.** A responsabilidade de sincronizar colunas é 100%
  server-side. `useUpsells` não toca mais `torque_crm_products` nem a base
  `'torque-crm'`. Sem perda de autorização: quem pode entregar produto é decidido
  pelos chamadores (`process_upsell`/`conceder_produto`), não pelo patch removido.
- **`_entregar_produto` segue helper interno** — `SECURITY DEFINER`,
  `search_path=''`, ACL `postgres`/`service_role` apenas (sem `EXECUTE` para
  `authenticated`/`anon`/`PUBLIC`). Nenhuma nova superfície de acesso.
