# 0004 — Monolito modular contrato-only sobre Supabase

- **Status:** ✅ Aceito (sign-off do fundador em 2026-06-03 — HITL #76)
- **Data:** 2026-06-03
- **Decisores:** Fundador/CTO
- **Relacionado:** PRD #75, Slice 0 #76; `CONTEXT.md` → "Módulo", "Contrato"
- **Referência conceitual:** Augusto Galego, "Acabou o hype de microsserviços. Voltamos pra 2010"

> **Por que este ADR é crítico.** Sem ele, um dev futuro (ou um agente) vê a ausência de
> Foreign Key entre schemas como um bug e "conserta" adicionando a FK — quebrando o isolamento
> que é a razão de ser da arquitetura. Este documento existe para que a ausência de FK seja
> lida como **decisão deliberada**, não como dívida. Quem for adicionar uma FK cross-schema
> deve primeiro superseder este ADR.

## Contexto

O CRM da Milennials é um SPA monolítico **não-modular** sobre Supabase: ~185k LOC, 54 páginas,
188 hooks numa pasta só, 295 imports cruzados, 141 chamadas diretas ao banco, 167 tabelas todas
em `public`. Não há fronteira entre domínios além da RLS — que acumula segurança **e** regra de
negócio no mesmo lugar. O sistema precisa escalar de 40 para 300 usuários até o fim de 2026 e o
custo de manutenção cresce de forma não-linear (código-espaguete). A migração para AWS foi
suspensa; tudo permanece no Supabase.

Queremos os ganhos de **isolamento** dos microsserviços (fronteira real entre domínios, extração
trivial para serviço quando — e se — necessário) **sem** os custos (comunicação via rede, overhead
de DevOps, deploys orquestrados, bancos distribuídos) que não se justificam para uma empresa do
nosso porte. Essa é exatamente a promessa do **monolito modular**.

Existem duas variantes do padrão:

- **Modular "soft"**: schemas separados mas com FK cross-schema permitidas e leitura direta de
  tabela de outro módulo. Fronteira existe no front, mas o banco continua acoplado.
- **Modular "purista / contrato-only"**: nenhuma FK cross-schema (nem para o shared kernel),
  nenhuma leitura/escrita direta de tabela de outro módulo. Toda interação cross-módulo passa por
  uma **interface explícita** — no nosso caso, uma RPC tipada `SECURITY DEFINER`. É o equivalente
  arquitetural dos "getters/setters em escala" da tese.

## Decisão

Adotamos o **monolito modular contrato-only purista sobre Supabase**. Um **Módulo** tem dois lados
indissociáveis:

### 1. Lado front — pasta + barrel + boundaries

- Cada módulo é uma pasta em `src/modules/<nome>/` cujo **único ponto público** é `index.ts`
  (barrel). Internals (`components/`, `hooks/`, `lib/`, `schemas/`) são privados.
- `eslint-plugin-boundaries` quebra o build em qualquer import que (a) fure o barrel de outro
  módulo, ou (b) importe internals diretamente. Import cross-módulo só via `@/modules/<nome>`
  (o barrel).
- **Adoção por estrangulamento:** a regra de boundaries é aplicada **apenas a `src/modules/**`**
  na introdução (Slice 0). O legado em `src/features/**` e `src/pages/**` NÃO é forçado de uma
  vez — entra no perímetro de boundaries fatia a fatia, conforme cada área migra. Ligar boundaries
  no repo inteiro num big-bang explodiria o build em ~295 violações pré-existentes; isso não é a
  intenção e seria o oposto de strangler.

### 2. Lado banco — schema Postgres dedicado + contrato RPC

- Cada módulo possui um **schema Postgres dedicado** (`cliente.*`, `demanda.*`, `presenca.*`, …).
  `public` (legado) **coexiste** com os schemas novos durante toda a transição.
- **Zero FK cross-schema** — nem para o shared kernel `cliente`. Um módulo guarda `client_id` /
  `demanda_id` como **`uuid` solto** (sem `REFERENCES`).
- **Escrita direta nas tabelas do módulo é revogada** de `authenticated`
  (`REVOKE INSERT, UPDATE, DELETE`). A **única** forma de escrever é a **RPC tipada
  `SECURITY DEFINER`** do módulo dono, que valida a existência das referências **atomicamente**
  (senão `RAISE`). A RPC é a interface pública do módulo no banco — o "contrato".
- **Integridade referencial** (que sem FK o banco não garante por si) é mantida por dois
  mecanismos complementares: (a) **validação atômica na RPC** no momento da escrita; (b) **job de
  reconciliação** periódico que detecta órfãos, os coloca em quarentena e alerta (Slice 7 / #82 —
  fora do escopo da Slice 0).

### 3. Convenções de segurança da RPC-contrato

Toda RPC-contrato segue o padrão de hardening já canônico no repo:

- `SECURITY DEFINER` com `SET search_path = ''` (ou `pg_catalog` explícito) — nunca depender do
  search_path do chamador.
- Todo identificador **schema-qualified** (`cliente.clients`, `auth.uid()`).
- `GRANT EXECUTE` apenas aos roles que devem chamar (ex.: `authenticated`); a função é o único
  caminho de escrita.
- Validação de papel/autorização **dentro** da função quando aplicável (helpers `is_ceo`,
  `is_admin`, `e_envolvido` — nunca literal de role; ver guard `no_literal_role_in_policy.sql`).
- Quirk conhecido: `clients.assigned_mktplace` é `TEXT`; comparar com `auth.uid()::text`.

### 4. Exposição no PostgREST

Para que a RPC-contrato de um schema de módulo seja chamável pelo cliente
(`supabase.schema('cliente').rpc('existe', …)`), o schema precisa estar **exposto no PostgREST**.
Decisão: **expor os schemas de módulo no PostgREST** (adicionando-os à lista de exposed schemas,
mantendo `public` exposto). A alternativa — uma RPC-wrapper em `public` que delega à RPC do módulo —
é **rejeitada**: recria em `public` o acoplamento que o módulo existe para eliminar e mantém
`public` como god-schema. (Operacionalização exata — `config.toml` `[api] schemas` vs. dashboard/
Management API — é detalhe de execução do engenheiro; a decisão arquitetural é "expor o schema".)

## Alternativas consideradas

- **Modular soft (FK cross-schema permitidas).** Mais barato no curto prazo, leitura direta de
  tabelas vizinhas. **Rejeitado** pelo fundador conscientemente: a FK cross-schema reacopla o banco
  e torna a extração futura de um módulo para serviço não-trivial (a FK teria que virar validação
  de aplicação de qualquer forma). O ganho de isolamento real só existe na variante purista.
- **Microsserviços de verdade (rede + bancos separados agora).** Overhead de DevOps, latência de
  rede, deploys orquestrados, logging/falhas distribuídas — custos que não se pagam para uma
  empresa de ~dezenas de pessoas com um problema que **não é de hardware**. A tese de referência é
  explícita: comunicação via rede só é vantagem quando há necessidade real de hardware/escala
  distinta. **Rejeitado.**
- **Manter monolito não-modular e só disciplinar com convenção/review.** É o status quo que
  produziu os 295 imports cruzados. Convenção sem enforcement mecânico (boundaries + REVOKE) não
  segura sob 300 usuários e múltiplos contribuidores/agentes. **Rejeitado.**
- **Big-bang: migrar as 167 tabelas e ligar boundaries no repo inteiro de uma vez.** Risco
  altíssimo em produção viva (40 users), build quebrado em massa, negócio congelado. **Rejeitado**
  em favor de **estrangulamento** (kernel primeiro, áreas oportunisticamente depois).

## Consequências aceitas

- **Aceitamos perder a garantia de integridade referencial do banco** (sem FK cross-schema) **em
  troca de isolamento real e extração futura trivial.** O preço é pago por validação atômica na
  RPC + job de reconciliação. Órfãos transitórios são possíveis entre escrita e reconciliação;
  o reconciler é a rede de segurança, não a primeira linha.
- **Aceitamos duplicação leve** (cada módulo guarda `client_id`/`demanda_id` solto, sem JOIN
  cross-schema "grátis") em troca de baixo acoplamento. Baixo acoplamento > DRY.
- **Aceitamos uma chamada de RPC onde antes haveria um JOIN ou import direto** — custo de latência
  desprezível (função local, mesmo Postgres), ganho de fronteira explícita.
- **Aceitamos que a adoção é gradual** (strangler): por um longo período, `public` legado e schemas
  de módulo coexistem, e parte do código fica fora do perímetro de boundaries. Isso é deliberado,
  não inacabamento.
- **A ausência de FK cross-schema é lei.** Adicionar uma é superseder este ADR, não um hotfix.

## Notas de implementação (Slice 0 / #76)

A Slice 0 prova o padrão ponta-a-ponta com o **mínimo aditivo**, sem migrar dados reais:

- Schema `cliente` criado, coexistindo com `public` (zero regressão).
- Tabela-marca `cliente.modulo_health` (descartável) só para demonstrar o REVOKE — **não** se
  toca `public.clients` nem `public.client_info_bank` nesta slice.
- Uma RPC-contrato de **leitura**: `cliente.existe(p_client_id uuid) → boolean` (predicado de
  existência usado pelos contratos dos outros módulos). RPC de **escrita** real fica para Slice 1+,
  quando houver dado de módulo a escrever.
- `REVOKE INSERT, UPDATE, DELETE ON cliente.modulo_health FROM authenticated`; prova-se via pgTAP
  que a escrita direta falha e a leitura via RPC funciona.
- `eslint-boundaries` ligado e escopado a `src/modules/**`, com `src/modules/cliente/index.ts`.
- `supabase gen types --schema public,cliente`; typecheck limpo.
