# API REST para Cadastro de Clientes — Design Spec

**Data:** 2026-03-20
**Status:** Aprovado

## Objetivo

Criar uma API REST (Supabase Edge Function) para receber cadastros de clientes de forma programática via integração M2M (machine-to-machine) com sistema CRM externo. A API replica a lógica do formulário em `/kanban/cadastro-novos-clientes`, criando o cliente "cru" (sem atribuições de gestores/equipe) e os registros financeiros por produto.

## Decisões de Design

1. **Escopo de dados:** Cliente criado sem assignments (group, squad, ads_manager, comercial, crm, rh). Atribuições são feitas manualmente no sistema depois.
2. **Produtos:** Aceita `produtos_contratados` COM `valores_produtos` — cria cards de kanban (via trigger) e registros financeiros (via código).
3. **Arquitetura:** Edge Function única `api-v1` com roteamento por query param `action`.
4. **API keys:** Gerenciadas via SQL/migration, sem endpoint admin.
5. **Supabase client:** Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS, seguindo o padrão das funções existentes (`create-user`, `update-user`, etc.).
6. **CORS:** Desabilitado (M2M não precisa). Apenas OPTIONS retorna headers CORS vazios para não quebrar chamadas acidentais de browser.
7. **Transações:** Inserts sequenciais sem transaction wrapper (limitação do Supabase client JS). Falha parcial é documentada como limitação conhecida — consistente com o comportamento do formulário existente.

## Arquitetura

### Edge Function: `api-v1`

Uma única Supabase Edge Function com roteamento interno:

| Ação | Método | Parâmetro | Auth Requerida | Descrição |
|------|--------|-----------|----------------|-----------|
| `health` | GET | `?action=health` | Sim | Teste de conexão + DB |
| `create_client` | POST | `?action=create_client` | Sim | Criar cliente |
| `search_client` | GET | `?action=search_client&cnpj=...` | Sim | Buscar por CNPJ |

Todos os endpoints requerem API key válida.

Configuração:
```toml
[functions.api-v1]
verify_jwt = false
```

### Mapa de Produto (slug → nome)

Hardcoded na Edge Function para resolver nomes de produto sem depender do frontend:

```typescript
const PRODUCT_NAMES: Record<string, string> = {
  "millennials-growth": "Millennials Growth",
  "millennials-outbound": "Millennials Outbound",
  "millennials-paddock": "Millennials Paddock",
  "torque-crm": "Torque CRM",
  "millennials-hunting": "Millennials Hunting",
}
```

## Tabelas Novas

### `api_keys`

```sql
CREATE TABLE public.api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso apenas via service_role_key
```

### `api_logs`

```sql
CREATE TABLE public.api_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id     UUID REFERENCES api_keys(id),
  action         TEXT NOT NULL,
  method         TEXT NOT NULL,
  status_code    INTEGER NOT NULL,
  request_body   JSONB,
  response_body  JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- Index para rate limiting
CREATE INDEX idx_api_logs_rate_limit
  ON api_logs(api_key_id, created_at DESC);
```

### Index de CNPJ único na tabela `clients`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_unique
  ON public.clients(cnpj)
  WHERE cnpj IS NOT NULL AND cnpj != '';
```

Garante integridade no nível do banco. A Edge Function também trata o erro de unique violation (`23505`) como fallback → 409.

## Autenticação

API keys próprias (não usa JWT/Supabase Auth):

1. Request chega com `Authorization: Bearer <api-key-em-texto>`
2. Calcula SHA-256 da key via Web Crypto API (`crypto.subtle.digest`)
3. Busca em `api_keys` onde `key_hash = hash` AND `is_active = true`
4. Verifica `expires_at` (se não nulo, deve ser futuro)
5. Se inválido/expirado → HTTP 401

Geração via SQL:
```sql
-- Guardar 'minha-api-key-secreta' e passar ao integrador
INSERT INTO api_keys (key_hash, name, expires_at)
VALUES (encode(sha256('minha-api-key-secreta'::bytea), 'hex'), 'CRM Externo', NULL);
```

**Rotação de keys:** Inserir nova key primeiro, validar com integrador, depois desativar a antiga (`UPDATE api_keys SET is_active = false WHERE id = ...`).

## Rate Limiting

Baseado em `api_logs` (com index `idx_api_logs_rate_limit`):
```sql
SELECT COUNT(*) FROM api_logs
WHERE api_key_id = $1 AND created_at > now() - interval '1 minute'
```
Se >= 60 → HTTP 429 com header `Retry-After: 60`.

## Logging

Todas as chamadas são logadas em `api_logs`. O campo `request_body` é sanitizado antes do log:
- Campo `cpf` é mascarado (ex: `"***.***.***-**"`)
- Demais campos são logados normalmente

## Endpoint: Health Check

**GET** `?action=health`

Verifica conexão com o banco (`SELECT 1`):

```json
{
  "success": true,
  "system_name": "Sistema Millennials",
  "version": "1.0"
}
```

## Endpoint: Buscar Cliente

**GET** `?action=search_client&cnpj=12.345.678/0001-00`

Resposta se encontrado:
```json
{
  "found": true,
  "cliente_id": "uuid",
  "nome_cliente": "Nome",
  "razao_social": "Razão Social",
  "cnpj": "12.345.678/0001-00"
}
```

Resposta se não encontrado:
```json
{ "found": false }
```

## Endpoint: Criar Cliente

**POST** `?action=create_client`

### Payload

```json
{
  "nome_cliente": "Nome Fantasia",
  "razao_social": "Razão Social LTDA",
  "cnpj": "12.345.678/0001-00",
  "cpf": "123.456.789-00",
  "nicho": "E-commerce",
  "observacoes_gestor": "Texto livre",
  "investimento_previsto": 5000.00,
  "comissao_vendas_percent": 10,
  "data_entrada": "2026-03-20",
  "duracao_contrato_meses": 12,
  "dia_vencimento": 10,
  "produtos_contratados": ["millennials-growth", "torque-crm"],
  "valores_produtos": {
    "millennials-growth": 3000.00,
    "torque-crm": 2000.00
  }
}
```

Slugs de produto aceitos (hyphens ou underscores, normalizados internamente para hyphens):
- `millennials-growth`
- `millennials-outbound`
- `millennials-paddock`
- `torque-crm`
- `millennials-hunting`

### Validações

| Campo | Regra |
|-------|-------|
| `nome_cliente` | obrigatório, max 100 chars |
| `razao_social` | obrigatório, max 255 chars |
| `cnpj` | obrigatório, formato + dígitos verificadores |
| `cpf` | opcional, formato + dígitos verificadores se presente |
| `nicho` | obrigatório, max 100 chars |
| `observacoes_gestor` | obrigatório, max 1000 chars |
| `investimento_previsto` | obrigatório, número > 0 |
| `comissao_vendas_percent` | obrigatório, 0–100 |
| `data_entrada` | obrigatório, ISO date (YYYY-MM-DD), tratado como DATE sem conversão de timezone |
| `duracao_contrato_meses` | obrigatório, inteiro > 0 |
| `dia_vencimento` | obrigatório, inteiro 1–31 |
| `produtos_contratados` | opcional, array de slugs válidos |
| `valores_produtos` | obrigatório SE `produtos_contratados` presente — cada produto listado deve ter valor > 0 |

Se `produtos_contratados` é omitido ou vazio, apenas o registro base em `clients` é criado. Nenhum card de kanban, registro financeiro, ou task é gerado.

### Mapeamento de Campos (API → Banco)

| Campo API | Coluna `clients` |
|-----------|-------------------|
| `nome_cliente` | `name` |
| `razao_social` | `razao_social` |
| `cnpj` | `cnpj` |
| `cpf` | `cpf` |
| `nicho` | `niche` |
| `observacoes_gestor` | `general_info` |
| `investimento_previsto` | `expected_investment` |
| `comissao_vendas_percent` | `sales_percentage` |
| `data_entrada` | `entry_date` |
| `duracao_contrato_meses` | `contract_duration_months` |
| `dia_vencimento` | `payment_due_day` |
| `produtos_contratados` | `contracted_products` |

`monthly_value` = soma dos `valores_produtos`

### Fluxo de Execução

```
1.  Validar API key (Authorization header)
2.  Rate limit check (>= 60/min → 429)
3.  Validar payload (campos, formatos, CNPJ/CPF checksum)
4.  Checar duplicata de CNPJ → 409 se existe (retorna cliente_id existente)
    - Fallback: tratar unique violation (23505) do INSERT como 409
5.  INSERT INTO clients (status='new_client', comercial_status='novo', comercial_entered_at=now())
    → Trigger create_product_kanban_cards_trigger dispara automaticamente
6.  Se produtos_contratados presente e não vazio:
    a. INSERT INTO client_product_values (por produto, com product_name do mapa interno)
    b. Calcular contract_expiration_date = entry_date + contract_duration_months
    c. INSERT INTO financeiro_client_onboarding (por produto, product_slug, product_name, contract_expiration_date)
    d. INSERT INTO financeiro_active_clients (por produto, monthly_value=0, contract_expires_at, invoice_status='em_dia')
    e. INSERT INTO financeiro_tasks (por produto, due_date = entry_date + 3 dias)
       Título: "{nome_cliente} — {product_name} → Cadastrar no Asaas + Enviar 1ª Cobrança"
    (department_tasks: não inserido via API — user_id é NOT NULL e não há usuário autenticado em M2M. financeiro_tasks já cobre a notificação ao time financeiro.)
7.  Log sanitizado no api_logs (cpf mascarado)
8.  Retornar { success: true, cliente_id: "uuid", message: "...", produtos_criados: [...] }
```

**Nota sobre `department_tasks.user_id`:** A coluna pode ser `NOT NULL` em algumas versões do schema. A Edge Function tenta o INSERT sem `user_id`. Se falhar por constraint, o INSERT de `department_tasks` é ignorado (non-fatal) e logado — as `financeiro_tasks` já cobrem a notificação ao time financeiro.

### Campos fixos no INSERT

Além dos campos mapeados do payload:
- `status`: `'new_client'`
- `comercial_status`: `'novo'`
- `comercial_entered_at`: `now()`
- `created_by`: `NULL` (criado via API, sem usuário logado)
- `monthly_value`: soma dos `valores_produtos` (0 se sem produtos)

## Respostas HTTP

| Código | Quando | Body |
|--------|--------|------|
| 200 | Health OK, busca executada | `{ "success": true, ... }` |
| 201 | Cliente criado | `{ "success": true, "cliente_id": "uuid", "message": "...", "produtos_criados": ["millennials-growth"] }` |
| 400 | Validação falhou | `{ "success": false, "error": "...", "code": "VALIDATION_ERROR", "details": { "campo": "mensagem" } }` |
| 401 | Key inválida/expirada | `{ "success": false, "error": "API key inválida ou expirada", "code": "UNAUTHORIZED" }` |
| 409 | CNPJ duplicado | `{ "success": false, "error": "Cliente com este CNPJ já existe", "code": "DUPLICATE", "cliente_id": "uuid-existente" }` |
| 429 | Rate limit | `{ "success": false, "error": "Limite de requisições excedido", "code": "RATE_LIMITED" }` |
| 500 | Erro interno | `{ "success": false, "error": "Erro interno do servidor", "code": "INTERNAL_ERROR" }` |

## Arquivos a Criar

1. `supabase/functions/api-v1/index.ts` — Edge Function principal com router
2. `supabase/migrations/20260320100000_create_api_keys_logs_cnpj_unique.sql` — Tabelas api_keys, api_logs, index CNPJ

## Arquivos a Modificar

1. `supabase/config.toml` — Adicionar `[functions.api-v1]` com `verify_jwt = false`

## Limitações Conhecidas

1. **Sem transaction wrapper:** Os inserts sequenciais (steps 5-6) não são atômicos. Se um insert intermediário falhar, os anteriores já foram commitados. Consistente com o comportamento do formulário existente.
2. **`department_tasks` não inserido via API:** A coluna `user_id` é NOT NULL e não há usuário autenticado em chamadas M2M. `financeiro_tasks` já cobre a notificação ao time financeiro.
3. **Sem idempotency key:** Retries podem causar duplicatas se o CNPJ for diferente. Para o caso de uso atual (CRM externo), o CNPJ unique index é proteção suficiente.

## Fora de Escopo

- Frontend para gerenciar API keys
- Atribuições de gestores/equipe via API (feito manualmente no sistema)
- Webhooks de saída (notificar sistema externo sobre mudanças)
- Versionamento de API (v2, v3)
