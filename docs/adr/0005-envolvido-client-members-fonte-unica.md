# 0005 — Envolvido (`client_members`) como fonte única de envolvimento; RLS de cliente delega a `e_envolvido`

- **Status:** ✅ Aceito (sign-off do fundador em 2026-06-03 — HITL #78). Decisões assinadas: colapso = só (C)+(C') em `e_envolvido`, (A)/(B)/(D) intactos; trigger espelho `assigned_*`→`client_members` na transição; PK composta com `papel_no_cliente`; `DROP` dos `assigned_*` fora desta slice.
- **Data:** 2026-06-03
- **Decisores:** Fundador/CTO
- **Relacionado:** PRD #75, Slice 2 #78; ADR 0004 (monolito modular contrato-only); `CONTEXT.md` → "Card Universal", "Envolvido", "Módulo", "Contrato"
- **Supersede parcial:** a *semântica de involvement-por-assignment* das policies de `public.clients`. NÃO supersede o ADR 0004.

> **Por que este ADR é crítico.** Reescreve a visibilidade de cliente — a superfície de
> segurança mais sensível do CRM (LGPD, confidencialidade entre áreas). O risco número um é
> **regressão silenciosa de acesso**: a RLS do Supabase nega retornando `200 OK + array vazio`
> (não `403`), então perder um caminho de acesso legítimo não estoura erro — só some dado da
> tela de um colega (incidente CTO, abril/2026). Este ADR existe para tornar explícito **o que
> é** e **o que não é** "envolvimento", e para que ninguém colapse no `e_envolvido` caminhos de
> visibilidade que não são involvement (page-grant, escopo-de-grupo do GP, bypass executivo).

## Contexto

Hoje a visibilidade de **quem vê um cliente** (`SELECT` em `public.clients`) é a união de **três
conceitos ortogonais**, espalhados em duas policies permissivas (OR lógico entre elas):

**Policy `clients_select_visao_total`** (`USING`):
```
is_admin(auth.uid())                                              -- (A) bypass executivo+GP
OR (has_role('gestor_projetos') AND group_id = get_user_group_id(auth.uid()))  -- (B) escopo-grupo do GP
OR assigned_ads_manager      = auth.uid()                         -- (C) involvement
OR assigned_comercial        = auth.uid()                         -- (C) involvement
OR assigned_crm              = auth.uid()                         -- (C) involvement
OR assigned_rh               = auth.uid()                         -- (C) involvement
OR assigned_outbound_manager = auth.uid()                         -- (C) involvement
OR assigned_sucesso_cliente  = auth.uid()                         -- (C) involvement
OR assigned_mktplace         = auth.uid()::text                   -- (C) involvement (quirk TEXT)
OR can_access_page_data(auth.uid(), 'cliente-list')              -- (D) page-grant
OR can_access_page_data(auth.uid(), 'gestor-ads')                -- (D) page-grant
OR can_access_page_data(auth.uid(), 'consultor-comercial')       -- (D) page-grant
OR can_access_page_data(auth.uid(), 'gestor-crm')                -- (D) page-grant
OR can_access_page_data(auth.uid(), 'outbound')                  -- (D) page-grant
OR can_access_page_data(auth.uid(), 'sucesso-cliente')           -- (D) page-grant
OR can_access_page_data(auth.uid(), 'financeiro')                -- (D) page-grant
OR can_access_page_data(auth.uid(), 'consultor-mktplace')        -- (D) page-grant
```

**Policy `secondary_manager_can_view_client`** (`USING`):
```
id IN (SELECT client_id FROM client_secondary_managers WHERE secondary_manager_id = auth.uid())  -- (C') involvement
```

Os quatro grupos são conceitualmente distintos:

| Grupo | O que é | É "envolvimento"? |
|---|---|---|
| **(A)** `is_admin` | ceo/cto/gestor_projetos veem tudo | ❌ bypass de papel |
| **(B)** GP-grupo | gestor_projetos vê clientes do **seu grupo** | ❌ escopo organizacional, não per-cliente |
| **(C)+(C')** assigned_* + secondary | a pessoa **atende** aquele cliente específico | ✅ **isto é Envolvido** |
| **(D)** page-grant | papel/grant "vê a lista inteira daquela área" | ❌ visibilidade ampla por função |

`CONTEXT.md` define **Envolvido** como exatamente o grupo (C)+(C'): "pessoa que participa do
atendimento de um cliente". A `client_members` é a fonte única **desse** conceito — não dos
outros três. Colapsar (A), (B) ou (D) em `e_envolvido` seria **revogar acesso legítimo**.

## Decisão

### 1. `cliente.client_members` — fonte única de Envolvido

Tabela nova no schema do módulo `cliente` (ADR 0004), coexistindo com `public`:

```
cliente.client_members (
  client_id        uuid        NOT NULL,   -- ref por contrato; SEM FK cross-schema
  user_id          uuid        NOT NULL,   -- ref por contrato; SEM FK cross-schema
  papel_no_cliente text        NOT NULL,   -- 'ads_manager' | 'comercial' | 'crm' | 'rh'
                                           -- | 'outbound_manager' | 'sucesso_cliente'
                                           -- | 'mktplace' | 'secondary_manager'
  entrou_em        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, user_id, papel_no_cliente)
)
```

- **Zero FK cross-schema** (ADR 0004). `client_id`/`user_id` são `uuid` soltos; integridade por
  validação atômica na RPC + reconciliação (Slice 7).
- PK composta `(client_id, user_id, papel_no_cliente)`: a mesma pessoa pode ter **mais de um
  papel** no mesmo cliente (ex.: gestor_ads que também é secondary_manager) sem colisão. Para
  visibilidade, qualquer linha basta.
- `papel_no_cliente` preserva a semântica de responsabilidade (o ads manager **do** cliente) e é
  o que futuramente reidrata `MANAGER_LIMITS` / reatribuições.
- **Escrita direta REVOGADA** de `authenticated`; só RPC `SECURITY DEFINER` do módulo escreve.

### 2. `cliente.e_envolvido(p_client_id uuid, p_user_id uuid) → boolean`

```sql
CREATE OR REPLACE FUNCTION cliente.e_envolvido(p_client_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cliente.client_members m
    WHERE m.client_id = p_client_id AND m.user_id = p_user_id
  );
$$;
```

- `SECURITY DEFINER` + `search_path=''` + schema-qualified (padrão ADR 0004).
- Lê **apenas** `cliente.client_members`. É o predicado puro de involvement (C)+(C').
- `GRANT EXECUTE` a `authenticated, service_role`. Chamável cross-schema de uma policy em `public`
  — chamada de função cross-schema é permitida pelo ADR 0004 (é o contrato; o proibido é FK e
  leitura/escrita direta de tabela de outro módulo).

### 3. Reorientação da RLS de `public.clients` — **colapso cirúrgico, não amputação**

As duas policies SELECT são substituídas por **uma** policy SELECT que preserva (A), (B), (D)
intactos e troca **apenas** (C)+(C') por `cliente.e_envolvido`:

```sql
CREATE POLICY clients_select_visao_total ON public.clients
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())                                                          -- (A) intacto
  OR (has_role(auth.uid(), 'gestor_projetos'::user_role)
      AND group_id = get_user_group_id(auth.uid()))                             -- (B) intacto
  OR cliente.e_envolvido(id, auth.uid())                                        -- (C)+(C') colapsado
  OR can_access_page_data(auth.uid(), 'cliente-list')                           -- (D) intacto
  OR can_access_page_data(auth.uid(), 'gestor-ads')
  OR can_access_page_data(auth.uid(), 'consultor-comercial')
  OR can_access_page_data(auth.uid(), 'gestor-crm')
  OR can_access_page_data(auth.uid(), 'outbound')
  OR can_access_page_data(auth.uid(), 'sucesso-cliente')
  OR can_access_page_data(auth.uid(), 'financeiro')
  OR can_access_page_data(auth.uid(), 'consultor-mktplace')
);
```

- A policy `secondary_manager_can_view_client` é **removida** porque (C') agora vive em
  `client_members` (papel `secondary_manager`) e é coberta por `e_envolvido`.
- Guard `no_literal_role_in_policy.sql`: continua **verde** — `is_admin`/`has_role` adjacentes
  permanecem; nenhum literal novo introduzido.
- As policies **UPDATE** de `public.clients` (`Ads Manager can update assigned clients`, etc.)
  **NÃO são tocadas nesta slice** — continuam lendo `assigned_*`. Elas migram quando o módulo
  de escrita do kernel assumir a mutação (Slice 1+/3). Slice 2 reorienta só **leitura**.

### 4. Sincronização durante a transição — trigger espelho + RPC de membership

`assigned_*` continua sendo escrito por ~141 caminhos de código legado. Para `client_members`
não divergir da realidade enquanto o legado não morre:

- **Trigger `AFTER INSERT/UPDATE` em `public.clients`** (`SECURITY DEFINER`) reflete mudanças dos
  7 `assigned_*` em `client_members` (insere/remove a linha do papel correspondente). Idempotente.
- **Trigger `AFTER INSERT/UPDATE/DELETE` em `public.client_secondary_managers`** reflete a linha
  `secondary_manager`.
- **RPC de membership** (`cliente.adicionar_membro`/`remover_membro`) é o caminho **novo e
  preferido**; durante a transição ela também escreve de volta o `assigned_*` correspondente
  (compat reversa) para o legado não regredir. Convergência total quando o legado for migrado.
- **Backfill único** porta o estado atual (106 clientes; ads 95, sucesso 92, comercial 54, crm
  42, mktplace 35, secondary 5; outbound/rh 0) e normaliza `assigned_mktplace` TEXT→UUID (0
  valores inválidos hoje — conversão segura).

**Plano de deprecação dos `assigned_*`** (fora desta slice, registrado aqui): (1) Slice 2 —
`client_members` vira fonte da **leitura**; `assigned_*` continua fonte da escrita + espelhado.
(2) Slices futuras — escrita migra para RPC de membership; `assigned_*` vira derivado/legado.
(3) Slice final — `DROP` das colunas após zero leitores. O trigger espelho é a **rede de
transição**, removido junto com as colunas.

## Alternativas consideradas

- **Delegar a RLS inteira a `e_envolvido` (amputar A/B/D).** Mais "limpo" no papel — uma policy,
  um predicado. **Rejeitado**: revogaria silenciosamente todo page-grant holder
  (`cliente-list`, `financeiro`, etc.) e todo GP-por-grupo. É exatamente a regressão silenciosa
  que o ADR existe para impedir. Envolvido é (C)+(C') **apenas**.
- **`client_members` com FK para `public.clients`/`auth.users`.** Daria integridade de graça.
  **Rejeitado** por ADR 0004 (zero FK cross-schema — o isolamento é a razão de ser do módulo).
- **Não usar trigger; só RPC de membership.** Mais puro. **Rejeitado para a transição**: 141
  caminhos legados escrevem `assigned_*` direto e não vão virar RPC nesta slice; sem trigger,
  `client_members` divergiria no dia 1 e a RLS nova mostraria menos do que a antiga.
- **View materializada de involvement em vez de tabela.** **Rejeitado**: `client_members` é dado
  de primeira classe (alvo de JOIN para card universal e presença, PRD #75), não cache derivado.

## Consequências aceitas

- **Aceitamos manter `assigned_*` vivo e duplicado** com `client_members` durante a transição,
  sincronizado por trigger — em troca de migração sem big-bang e zero regressão de escrita
  legada. A duplicação é transitória e tem plano de morte explícito.
- **Aceitamos uma chamada de função cross-schema dentro de uma policy de `public`**
  (`cliente.e_envolvido`) — custo de latência desprezível (mesmo Postgres, `STABLE`), ganho de
  fronteira: a definição de "envolvimento" passa a ter **um único dono** (`client_members`).
- **Aceitamos que a integridade de `client_members` não é garantida pelo banco** (sem FK) — paga
  por validação na RPC + reconciliação (Slice 7).
- **NÃO aceitamos perder nenhum caminho de acesso legítimo.** O gate de merge é a matriz de
  não-regressão pgTAP: para cada papel/assignment/grant que via um cliente antes, prova-se que
  continua vendo depois; e que não-envolvido continua não vendo (os dois lados — vê / não vê).

## Pontos de decisão humana (HITL — sign-off do fundador)

1. **Semântica do colapso**: confirmar que Envolvido = (C)+(C') apenas, e que (A) exec/GP-bypass,
   (B) GP-por-grupo e (D) page-grant **permanecem** fora de `e_envolvido`. (Recomendação do
   arquiteto: sim — caso contrário regressão silenciosa.)
2. **Trigger espelho `assigned_* → client_members`** como mecanismo de transição vs. esperar a
   migração da escrita. (Recomendação: trigger agora; sem ele a leitura nova regride no dia 1.)
3. **PK composta com `papel_no_cliente`** (permite múltiplos papéis por pessoa/cliente) vs. PK
   `(client_id, user_id)`. (Recomendação: composta — reflete a realidade dos assigned_* atuais.)
4. **Momento do `DROP` dos `assigned_*`**: confirmado como fora desta slice (slice final).
