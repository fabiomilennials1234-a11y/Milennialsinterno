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
