# 0007 — Presença viva: Supabase Realtime Presence em canal private, audiência por `pode_ver_cliente`

- **Status:** ✅ Aceito (Slice 5 / #81 — 2026-06-03)
- **Data:** 2026-06-03
- **Decisores:** Fundador/CTO (arquiteto assinou o desenho)
- **Relacionado:** PRD #75, Slice 5 #81 (estado VIVO); persistência de intervalo é #83 (fora);
  ADR 0004 (monolito modular contrato-only), ADR 0005 (Envolvido / `pode_ver_cliente`);
  `CONTEXT.md` → "Presença", "Atuação", "Tempo-na-demanda", "Transporte".

> **Por que este ADR é crítico.** Supabase Realtime **não aplica RLS na entrada de um canal
> público** por padrão. Um canal de presença ingênuo (`presenca:client:<id>`, público) deixa
> qualquer `authenticated` que saiba/adivinhe o topic **entrar, `track()` e ler** o estado de
> todo mundo — vazamento de dado de pessoal **cross-cliente** (mesma classe de risco LGPD que o
> ADR 0005 endereçou para `public.clients`). Verificado no projeto em 2026-06-03: `realtime.messages`
> tem **RLS ligada e ZERO policies** — o default-deny só atinge canais **private**; públicos passam
> batido. Este ADR existe para que o canal de presença seja **private + autorizado por RLS** e para
> que ninguém "simplifique" trocando-o por público.

## Contexto

A feature headline ("quem está atuando em qual demanda de qual cliente, AGORA") precisa de um sinal
**vivo e efêmero**, não de um registro. `CONTEXT.md` é explícito: o estado "quem atua agora" vive
num **canal de presença efêmero (em memória, não toca o banco), escopado por cliente**; só o
intervalo fechado é persistido — e isso é a Slice #83, fora daqui.

Três decisões precisavam de assinatura: (1) o **transporte**; (2) **quem** vê/entra no canal
(escopo de audiência); (3) **como** travar a segurança do transporte.

## Decisão

### 1. Transporte: Supabase Realtime **Presence**, um canal por cliente, em memória

- Topic: `presenca:client:<clientId>`. Ao focar uma Demanda, o usuário entra no canal e faz
  `track({ user_id, demanda_id, atuando })`. Os demais recebem `sync`/`join`/`leave` e veem ao vivo.
- **Não toca o banco.** Nenhum schema/tabela `presenca` no Postgres nesta slice — o estado é o
  presence-state do canal. O "lado-banco" do módulo (ADR 0004) é **somente** a policy de
  autorização do transporte (item 3). É a leitura coerente de ADR 0004 para um módulo cujo estado
  é efêmero: o módulo existe no front; seu contrato de banco aqui é a RLS que protege o canal.
- **Atuação inferida + idle-aware:** `atuando = focado ∧ ¬idle`. Sem input (mouse/teclado) por um
  limiar (~5 min, configurável) → auto-pausa ("o almoço com a aba aberta não conta"); retomar input
  reativa. Heartbeat re-track a cada 30 s reavalia `atuando` mesmo sem input novo (captura
  ativo→idle). `online ≠ atuando` é invariante de domínio.

### 2. Escopo de audiência: **`cliente.pode_ver_cliente` (A+B+C+D)**, não `e_envolvido` estrito

Quem entra/lê o canal de um cliente = quem **pode ver o cliente** — o mesmo predicado unificado e
**dono único** de audiência do ADR 0005 (is_admin **A** + GP-por-grupo **B** + Envolvido **C/C'** +
page-grants **D**). É exatamente a audiência já usada por Demanda (#80) e Card Universal (#77).

- **Tensão reconhecida:** `CONTEXT.md` → "Atuação" diz "visível só para os **Envolvidos** (escopo
  `client_members`)". A letra sugere `e_envolvido` (só C+C'). **Desviamos conscientemente** e
  registramos: o que o CONTEXT protege é a **intenção de privacidade** — "não a empresa inteira /
  consciência de equipe, não vigilância global". `pode_ver_cliente` **honra** essa intenção: não é a
  empresa toda; é o mesmo conjunto restrito que já enxerga o cliente e suas demandas. A diferença
  para `e_envolvido` é apenas A/B/D — exec, GP-do-grupo e page-grant holders, que **por definição já
  têm visão legítima daquele cliente**. Usar `e_envolvido` aqui criaria a **5ª definição divergente**
  de "quem vê o cliente" e regrediria silenciosamente A/B/D (o erro que o ADR 0005 existe para
  impedir): o badge sumiria para o GP que legitimamente acompanha o cliente.
- **Ação de glossário:** atualizar `CONTEXT.md` → "Atuação" para dizer "visível a quem pode ver o
  cliente (`pode_ver_cliente`), não só aos Envolvidos estritos" — alinhando a letra à decisão.

### 3. Segurança do transporte: canal **`private: true`** + RLS em `realtime.messages`

- O frontend abre o canal como **private** (`config.private = true`). Só assim o servidor Realtime
  aplica a RLS de `realtime.messages` ao admitir o socket no topic.
- Policy `presenca_canal_audiencia` (migration `20260603160000`):
  ```sql
  CREATE POLICY presenca_canal_audiencia ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'presenca:client:%'
    AND cliente.pode_ver_cliente(
          substring(realtime.topic() FROM '^presenca:client:(.+)$')::uuid,
          (SELECT auth.uid()))
  );
  ```
- Atende **somente** o prefixo `presenca:client:` — não interfere em nenhum outro uso de Realtime do
  repo (Postgres-Changes via publication `supabase_realtime` segue caminho próprio).
- Sem literal de role (delega a `cliente.pode_ver_cliente`) → guard `no_literal_role_in_policy`
  permanece verde.
- O formato do topic é **contrato compartilhado** entre o front (`topicoPresencaCliente` /
  `clientIdDoTopico`) e o `substring` da policy; um teste de round-trip impede divergência.

## Alternativas consideradas

- **(A) Postgres-Changes numa tabela `presenca_viva`** (o padrão Realtime que o repo já usa).
  **Rejeitado:** toca o banco a cada heartbeat (viola "em memória, não toca o banco"), escala mal a
  300 users (escrita por batida), e mistura com a persistência que é a #83. Presence é o transporte
  certo para estado efêmero.
- **(B) Canal público + ofuscar o nome do topic.** **Rejeitado:** segurança por obscuridade; o
  `clientId` é um uuid conhecido por quem tem o link/contexto. Não trava nada — é o estado de furo
  atual.
- **(C) Canal private + Realtime Authorization (RLS em `realtime.messages` → `pode_ver_cliente`).**
  **Escolhido** — única opção que honra CONTEXT (efêmero, em-memória, escopado) **e** fecha o furo
  cross-cliente.
- **Escopo `e_envolvido` estrito (C+C') em vez de `pode_ver_cliente`.** **Rejeitado** (ver item 2):
  regrediria A/B/D e criaria definição divergente de audiência.

## Consequências aceitas

- **Aceitamos depender do mecanismo de Realtime Authorization do Supabase** (canal private + RLS de
  `realtime.messages`) — em troca de não vazar presença cross-cliente. O canal **precisa** continuar
  private; trocá-lo por público reabre o furo. Lei.
- **Aceitamos que a presença não é persistida** (estado some quando o socket cai). É o desejado:
  presença descreve o agora. O número honesto de "há quanto tempo" (Tempo-na-demanda) é a #83.
- **Aceitamos `pode_ver_cliente` como audiência** mesmo divergindo da letra do CONTEXT ("Atuação" →
  Envolvido) — preservando a **intenção** (restrito, não a empresa toda) e a consistência com Demanda
  e Card. Glossário a atualizar.
- **Aceitamos duplicar o formato do topic** entre front e a expressão SQL da policy (sem JOIN/import
  cross-camada "grátis") — coberto por teste de round-trip. Baixo acoplamento > DRY (ADR 0004).
- **Aceitamos um 2º ponto de acoplamento ao legado de identidade** (`presenca/lib/diretorioPresenca`
  lê `public.profiles` para nome/avatar, espelhando `cliente/lib/diretorio`). Candidato óbvio a um
  módulo `pessoas` com contrato próprio no futuro — sinalizado, não construído agora.

## Notas de implementação (Slice 5 / #81)

- Módulo novo `src/modules/presenca/` com barrel; `eslint-boundaries` verde.
  - `lib/atuacao.ts` — **lógica pura** (máquina idle, derivação de `atuando`, agregação por demanda),
    espelha `computeTaskTime` do Mtech. 17 testes vitest com fake timers.
  - `lib/canal.ts` — formato do topic (contrato com a policy). 3 testes (round-trip).
  - `lib/idleDetector.ts` — wrapper fino de listeners DOM → lógica pura.
  - `lib/usePresencaDemanda.ts` — anúncio (track idle-aware + heartbeat + cleanup).
  - `lib/usePresencaDoCliente.ts` — observação read-only (agrega para o badge).
  - `lib/diretorioPresenca.ts` — resolução `user_id → {nome,avatar}` (ponto de acoplamento legado).
  - `components/BadgeAtuando.tsx` — badge ao vivo; ponto **sólido verde** (atuando) vs **vazado**
    (presente-ocioso). **Sem pulse/ping/bounce em loop** (commit `fb3d566` — saúde/epilepsia).
- DB: migration aditiva `20260603160000_presenca_realtime_authorization.sql` (só a policy).
  Nenhum schema novo no PostgREST (presença não tem RPC nem tabela — não há o que expor).
- pgTAP `realtime_authorization_test.sql` — matriz de não-regressão dos dois lados (envolvido/admin/
  page-grant entram; estranho barrado; isolamento cross-cliente), 13 asserts.
