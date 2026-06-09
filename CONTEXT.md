# CONTEXT — Glossário do domínio

Glossário canônico de termos do domínio. Só termos — sem detalhes de implementação.
Decisões arquiteturais vivem em `docs/adr/`. Contexto de sistema vive em `docs/wiki/`.

---

## Gravação — termo sobrecarregado, desambiguado

A palavra "gravação" significa **duas coisas distintas** neste sistema. Sempre use o termo canônico.

### Reunião Gravada (`recorded_meetings`)
Captura de tela/áudio de uma reunião, demo ou apresentação ao vivo, feita **dentro do CRM** pelo
próprio usuário. Vive em `recorded_meetings` + `meeting_folders`. Tem transcrição (Deepgram) e,
quando documentada, `ata` + `summary`. Esta é a feature do recorder in-app.

- **NÃO confundir** com a gravação de conteúdo abaixo.
- Termo curto aceitável: "reunião gravada". Evite só "gravação" sem qualificador.

### Gravação de Conteúdo (pool de gravação / atrizes de gravação)
Produção de vídeo de conteúdo para clientes — atrizes gravam material que vai pro Drive do cliente.
Vive no Kanban de Atrizes. Domínio totalmente separado de reuniões.

- Termo canônico: "gravação de conteúdo" ou "pool de gravação".

---

## Reunião Gravada — estados e termos relacionados

- **Sessão de gravação** (`recording_sessions`): estado vivo enquanto grava — máquina de estados
  `recording → stopped → assembling → done | failed | abandoned`. Efêmera; vira `recorded_meetings` ao finalizar.
- **Chunk**: pedaço de ~1s de vídeo/áudio emitido pelo MediaRecorder durante a captura.
- **Transcrição** (`transcript`): texto + segmentos por locutor (diarização), gerado pelo Deepgram.
- **Ata** (`ata`): documentação estruturada da reunião — resumo, decisões, próximos passos.
  Hoje vazia; alvo de geração automática via LLM (a "documentação automática estilo Notion").
- **Overlay flutuante**: janela always-on-top (via Document Picture-in-Picture) que mostra
  timer, status e controles sobre qualquer app durante a gravação.

---

## Cliente — card universal e envolvimento

### Card Universal de Cliente
Visão consolidada e **read-mostly** das informações de um cliente, com **uma única fonte da
verdade** (`client_info_bank`). Substitui a leitura fragmentada das 3 profile tables
(`client_design_profiles`, `client_dev_profiles`, `client_video_profiles`) e dos campos
duplicados (`instagram_handle`, `website_url`, `domain`, `notes`).

- **Audiência**: **quem pode ver o cliente** vê o **mesmo** card — não a empresa inteira.
  Determinada pelo predicado único `cliente.pode_ver_cliente` (= os **Envolvidos** via
  `client_members`, mais a cúpula que já enxerga o cliente: executivo/admin, GP no grupo,
  e page-grants de "visão total"). Coerente: quem enxerga o cliente enxerga o card dele.
  Não é universal-global, e a leitura de `client_info_bank` é escopada por esse mesmo predicado.
- **NÃO confundir** com `kanban_cards` ("card" sobrecarregado): o card universal é a entidade
  de informação do cliente, não um card de tarefa em board.
- Propósito: eliminar o **Ruído de Comunicação** (info divergente entre departamentos) pela
  consolidação do dado, não pela abertura de visibilidade.

### Envolvido (`client_members`)
Pessoa que participa do atendimento de um cliente e, portanto, vê o card universal dele.
Determinado por **uma única tabela explícita** `client_members` (`client_id`, `user_id`,
`papel_no_cliente`, `entrou_em`) — a fonte da verdade de "quem atende o cliente".

- Substitui os três mecanismos fragmentados de hoje: os 9 campos `assigned_*` (migram para
  cá), o acesso por papel/squad de design/dev/video, e a visibilidade via `kanban_card.client_id`.
- É o alvo de `JOIN` para **três coisas**: a RLS do cliente, a audiência do card universal e
  o escopo da presença/atuação.
- `papel_no_cliente` preserva a semântica de responsabilidade (ex.: o ads manager **do**
  cliente), inclusive limites de capacidade por gestor (hoje `MANAGER_LIMITS`).
- Resolve o quirk `assigned_mktplace` TEXT vs UUID (passa a ser `user_id` UUID uniforme).
- Em termos de monolito modular, `client_members` faz o módulo **Cliente** ser o *shared
  kernel* — os demais módulos referenciam `client_id`/`user_id` por **contrato** (sem FK
  cross-schema; ver "Módulo" e "Contrato").

---

## Demanda — unidade de trabalho do cliente

### Demanda (`demandas`)
Unidade de trabalho atrelada a um cliente — a "coisa que está sendo feita" (ex.: "Landing page
do Cliente X"). Entidade **nova e fina** (`demandas`: `client_id`, `título`, `status`, `domínio`),
criada para dar nome de primeira classe a algo que hoje só existe fragmentado em 5+ tabelas de
card por área (`design_cards`, `devs_tasks`, `video_cards`, `kanban_cards`, `tech_tasks`).

- **Padrão strangler**: os cards de domínio existentes apontam para uma demanda via `demanda_id`
  opcional. A camada `demandas` unifica a leitura sem fundir as tabelas legadas num big-bang.
- Uma demanda **pode** cruzar áreas (a landing tem card de design + de dev) ou ficar numa só.
- É contra `demanda_id` que a **Atuação** e o tempo são medidos — a demanda é o que a presença
  Monday rastreia ("quem atua em qual demanda de qual cliente").
- **NÃO confundir** com `kanban_cards` nem com os cards de área: esses são os itens de execução
  por domínio; a demanda é o guarda-chuva que os agrupa por trabalho do cliente.

---

## Presença e Atuação — quem faz o quê, agora e por quanto tempo

Três termos distintos. **`online ≠ atuando`** — não os trate como sinônimos.

### Presença
Sinal ao vivo de que um usuário está **com uma demanda aberta/em foco na UI agora**. Inferida
automaticamente (heartbeat enquanto a demanda está focada), **sem clique**. Alimenta o badge
"fulano atuando" em tempo real. Efêmera — descreve o agora, não é registro histórico.

### Atuação
O estado derivado "este usuário está trabalhando ativamente nesta demanda". É **Presença menos
ociosidade**: sem input (mouse/teclado) por um limiar (~5 min) → atuação **auto-pausa** (o
almoço com a aba aberta não conta). Visível só para os **Envolvidos** no cliente (escopo
`client_members`), não para a empresa inteira — consciência de equipe, não vigilância global.

### Tempo-na-demanda
Duração acumulada de Atuação numa demanda = **soma dos intervalos ativos** (não tempo-na-coluna,
não timer manual). É o número honesto de "há quanto tempo". O **timer explícito** (START/PAUSE/
RESUME, hoje `tech_time_entries`) permanece **apenas** onde precisão é requisito (Mtech / billável),
como complemento — não como mecanismo geral.

- **Transporte**: o estado "quem atua agora" vive num **canal de presença efêmero** (em memória,
  não toca o banco), escopado por cliente — só `client_members` entram no canal. Só o **intervalo
  fechado** é persistido (1 escrita ao pausar/encerrar a atuação, não por batida de heartbeat).

---

## Monolito Modular — módulo e contrato

### Módulo
Unidade de fronteira do monolito. Tem **dois lados**: uma pasta no front (público exposto só via
`index.ts`, com `eslint-boundaries` proibindo import que fure o barrel) **e** um **schema Postgres
dedicado** (`cliente.*`, `ads.*`, `design.*`…). Não há schemas hoje — todas as 167 tabelas vivem
em `public`; mover para schemas por módulo é trabalho assumido conscientemente.

### Contrato (RPC de módulo)
A **única** forma de um módulo conversar com outro. **Não há FK cross-schema** — nem para o shared
kernel `cliente`. Um módulo guarda `client_id`/`demanda_id` como `uuid` solto e:

- **Escrita direta nas tabelas do módulo é revogada** (`REVOKE INSERT/UPDATE`); só a **RPC tipada**
  do módulo dono escreve, validando a existência das referências **atomicamente** (senão `RAISE`).
- A RPC é a interface pública do módulo — os "getters/setters em escala arquitetural" da tese de
  monolito modular. Import direto entre módulos é proibido.
- **Integridade referencial** (que sem FK o banco não garante) é mantida por (1) validação atômica
  na RPC e (2) **job de reconciliação** periódico que coloca órfãos em quarentena e alerta.
- Consequência desejada: extrair um módulo para serviço próprio depois é trivial — troca-se a
  chamada de RPC local por gRPC/HTTP, sem refatorar o negócio.

### Plataforma (camada técnica) vs. Módulo de negócio
Nem tudo vira módulo. **Módulo de negócio** = bounded context com linguagem própria e dono
(ex.: `ads`, `mtech`, `identidade`) — schema Postgres dedicado + contrato RPC + barrel front.
**Plataforma** = plumbing técnico que **todo** módulo pisa: helpers de autorização
(`is_ceo`/`is_admin`/`is_executive`), infra de notifications, `audit_log`, `feature_flags`,
storage glue. Plataforma **permanece em `public`** — não ganha schema-módulo nem contrato, porque
contrato sobre fundação compartilhada é **indireção pura, não isolamento** (Galego: pagar o custo
só onde ele compra isolamento real; "se não tenho o problema, não quero o custo").

- **Régua de done** da modularização ponta-a-ponta: **nenhuma tabela de _negócio_ sobra em
  `public`**; `public` retém só plataforma. (Decidido no grill 2026-06-03; alvo do épico.)
- Distingue-se de "estrangulamento seletivo" (parar no meio) e de "purista total" (forçar contrato
  até em plumbing) — ambos rejeitados.

---
## Mapa de Módulos do sistema

Decomposição canônica em bounded contexts (grill 2026-06-03, princípio **P3**: um módulo por
**dono organizacional**, split só onde a **linguagem ubíqua** diverge). Cada módulo de negócio =
schema Postgres dedicado + contrato RPC + barrel front.

### Shared kernels (referenciados por ~todos via contrato)
- **`cliente`** — `client_id`. Card universal, envolvidos, info bank. (vivo)
- **`identidade`** — `user_id`. Pessoa: nome, avatar, papel-display, pertencimento a squad. É o
  segundo kernel; hoje preso em `cliente/lib/diretorio.ts`. Todo módulo referencia `user_id` por
  contrato `identidade.*`, sem ler `profiles` direto.

### Módulos de negócio
- **`demanda`** — unidade de trabalho do cliente. (vivo)
- **`presenca`** — presença/atuação ao vivo + tempo-na-demanda. (vivo)
- **`ads`** — gestão de tráfego Meta; `ads_*`, `meta_*` (Meta Ads = área interna).
- **`mktplace`** — consultoria de marketplace; `mktplace_*`, paddock. Dept distinto de `ads`.
- **`comercial`** — closing/consultor; `comercial_*`. Recebe lead de `outbound` por contrato.
- **`outbound`** — prospecção fria/SDR; `outbound_*`. Dono distinto de `comercial`.
- **`mtech`** — Milennials Tech (dev interno, **billável**); `tech_*`. Linguagem billável ≠ entrega.
- **`entregas`** — produção por área (design/dev/video/produtora/atrizes) sobre engine kanban
  compartilhado (plataforma). Um módulo, áreas internas.
- **`crm`** — Torque CRM (board do Gestor de CRM); `crm_*`. Dono: fundador (ver ADR 0006).
- **`sucesso-cliente`** — CS/retenção; `cs_*`, `churn_*`.
- **`financeiro`** — `financeiro_*`, invoices, sales, comissões, mrr, **upsells** (área interna).
- **`resultados`** — geração de relatório de 30d + share por token + transform IA; `*_reports`.
- **`reunioes`** — reuniões gravadas; `recorded_meetings`, `recording_sessions`, folders, oracle.
- **`rh`** — jornada de equipe, vagas, candidatos; `rh_*`.
- **`trainings`** — treinamentos + pro tools; `trainings`, `training_lessons`, `pro_tools`.
- **`gestao`** — OKRs, weekly summaries, war room. Linguagem executiva ≠ `painel`.
- **`publicas`** — **módulo de borda (DMZ)**: dono de TODA superfície anônima (forms públicos,
  submissões cruas, share por token). Entrega ao módulo dono por contrato. Consolida o attack
  surface público num lugar auditável.

### Consumidores (só leem outros módulos via contrato)
- **`painel`** — dashboards read-only (modo Monday). (vivo)

### Front-only (pasta+barrel, sem schema próprio)
- **`acesso`** — UI de admin de RBAC; escreve via RPC de `public`. Os **dados** de RBAC são
  plataforma (abaixo), não módulo.

### Plataforma (permanece em `public`, sem contrato — ver "Plataforma vs Módulo de negócio")
RBAC (`user_roles`, `custom_roles`, `*_grants`, `app_capabilities`, `app_pages`, `page_access_audit`,
`organization_groups`, `squads`) + helpers `is_ceo`/`is_admin`/`is_executive` (leem RBAC direto, mesmo
schema) · notifications infra (tabelas de notif **de domínio** ficam no módulo dono) · `feature_flags` ·
`api_keys`/`api_logs` (API REST M2M) · audit/idempotency · `reconciliacao` (integridade de contrato) ·
**engine kanban genérico** (`kanban_*`, `card_*` — usado por `entregas`+`crm`+`financeiro`).

---
## Torque CRM — board do Gestor de CRM

### Torque CRM
Produto-família de implantação de CRM da Milennials, vendido em três tiers. É o nome do
board do Gestor de CRM. **NÃO confundir** com o tier "Torque" (abaixo).

### Tier (Torque / Automation / Copilot)
Os três níveis contratáveis do Torque CRM, em hierarquia crescente: **Torque < Automation
< Copilot**. O tier mais alto **subsume** os inferiores (quem tem Copilot não precisa de card
de Torque/Automation). Por isso **um cliente gera um único card**, roteado para a coluna do seu
tier mais alto.

- **Torque** é o tier-base, antes chamado **V8** (renomeado). "V8" está aposentado como termo.
- **NÃO confundir** o tier "Torque" com a família "Torque CRM" nem com a tag de bloqueio
  "Torque bloqueado".

### Card (de implantação)
A unidade que anda pelo board do Gestor de CRM: **um por cliente**, na coluna do seu tier mais
alto. Nasce em **A FAZER** quando o CRM é briefado, anda por uma coluna de tier
(Torque/Automation/Copilot) conforme o checklist avança, vai para **Apresentação** (agenda data)
e termina em **Prontos**. **NÃO confundir** com `kanban_cards` nem com o Card Universal de Cliente.

- **Briefar** = criar o card. É ação **aberta a qualquer usuário com visão do board do CRM**
  (`has_page_access('gestor-crm')` / cúpula) — disparável tanto do **olhinho do cliente** quanto
  direto da coluna **A FAZER** do board. Quem briefa **pede**; o Gestor de CRM **executa** (briefar
  ≠ ser o gestor do card). O card só existe para cliente **com Torque CRM contratado** — não há
  brief de implantação fora do Torque CRM.

### Funil (A / B) — preset de pipeline escolhido pela estratégia de ADS
O **funil** de um cliente é qual dos **dois presets de pipeline de qualificação de lead** o CRM
segue: **Funil A** ou **Funil B**. Não são etapas de campanha de tráfego — são as colunas que o
lead percorre **dentro do CRM** (Novo Lead → Pré Qualificar → … → Fechado/Perdido).

- **Funil A** e **Funil B** divergem no miolo: A tem ramo de **Automação / Qualificando /
  Qualificado Quente**; B tem **Cadência / Coletando Informações / Criando Proposta / Agendado**.
  A escolha é **mutuamente exclusiva** por cliente — um cliente segue um único funil.
- **Dono da decisão: o Gestor de ADS.** O funil é a tradução, no CRM, da **estratégia de
  aquisição** que o ADS desenhou. Quem **escolhe** A ou B é o ADS, **no ato de gerar a tarefa do
  Gestor de CRM** (o seletor vive no modal "Gerar tarefa Gestor de CRM", substituindo o antigo
  radio `Padrão (14 etapas) / Personalizado`).
- **CRM executa, não decide**: o Gestor de CRM recebe o pipeline já montado pelo funil escolhido e
  trabalha as etapas. Não troca o funil.
- **Visível aos dois lados**: o funil escolhido é atributo do cliente — o ADS o **visualiza** para
  saber qual jornada o cliente segue; o CRM o executa. Fonte única de escrita: o modal de geração.
- **NÃO confundir** com o "pipeline personalizado" (escape hatch de etapas livres) nem com o
  **tier** (Torque/Automation/Copilot, que é outra dimensão — qual produto, não qual funil).

### Acompanhamento — termo sobrecarregado
- **Acompanhamento (pós-implantação)**: board da aba **Acompanhamentos**, onde um card do
  cliente entra ao cair em **Prontos**. Colunas: Fazer follow-up / Follow-up feito / Tasks em
  aberto / Aguardando resposta. Ciclo de relacionamento contínuo após o CRM ficar pronto.
- **NÃO confundir** com o antigo "Acompanhamento diário" (coluna removida, baseada em
  `crm_daily_tracking`).

---

## Adição de produto a cliente — Upsell vs Concessão

Anexar um produto a um cliente acontece por **dois atos distintos**. Mesma consequência de
**entrega** (produto entra em `contracted_products`, gera card de board, é entregue de verdade);
consequência **financeira oposta**. Sempre use o termo certo.

### Upsell
Venda de produto adicional a um cliente, **com contrapartida financeira**. Gera comissão (hoje
7% do `monthly_value`), expande o MRR e entra no ticket. É o ato comercial. Vive em `upsells`
(+ `upsell_commissions`). Termo reservado para **venda** — não usar para produto dado de graça.

### Concessão
Produto **concedido** a um cliente **sem contrapartida financeira** — tipicamente retenção de
cliente em risco (ex.: cliente entra só com Growth, em risco recebe Torque Copilot). Entrega é
idêntica à do upsell (board, envolvidos, tier subsume), mas:

- **Zero comissão** — não gera `upsell_commissions`.
- **Zero variação de MRR** — não gera `mrr_changes`; não infla ticket.
- Aparece em `financeiro_active_clients` com **`monthly_value = 0`** — financeiro enxerga o
  produto (auditoria: "quantas concessões ativas, por qual motivo"), sem valor que mexa no MRR.

- **NÃO confundir** com Upsell: upsell é venda (gera dinheiro e comissão), concessão é cortesia
  de retenção (não gera nem um nem outro). Um "upsell de R$0" é contradição — o ato sem
  contrapartida é uma Concessão.
