# API REST - Cadastro de Clientes

Documentacao da API REST para integracao com sistemas externos (CRM, ERP, etc.).

**URL Base:** `https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/api-v1`

**Autenticacao:** API Key via header `Authorization: Bearer <api-key>`

**Rate Limit:** 60 requisicoes/minuto por API key

---

## Autenticacao

Todas as requisicoes requerem uma API key valida no header:

```
Authorization: Bearer <sua-api-key>
```

### Gerar nova API key (via SQL no Supabase)

```sql
-- 1. Gere uma string aleatoria segura (ex: uuid ou openssl rand -hex 32)
-- 2. Guarde o texto original para passar ao integrador
-- 3. Armazene apenas o hash no banco:

INSERT INTO api_keys (key_hash, name, expires_at)
VALUES (
  encode(sha256('SUA-KEY-SECRETA-AQUI'::bytea), 'hex'),
  'Nome da Integracao',
  '2027-03-20'  -- ou NULL para nunca expirar
);
```

### Rotacao de keys

1. Inserir nova key
2. Validar com o integrador
3. Desativar a antiga: `UPDATE api_keys SET is_active = false WHERE id = '...';`

---

## Endpoints

### 1. Health Check

Verifica se a API e o banco de dados estao operacionais.

**Request:**
```
GET ?action=health
Authorization: Bearer <api-key>
```

**Response (200):**
```json
{
  "success": true,
  "system_name": "Sistema Millennials",
  "version": "1.0"
}
```

---

### 2. Buscar Cliente por CNPJ

Verifica se um cliente com determinado CNPJ ja existe no sistema. Util para evitar duplicatas antes de cadastrar.

**Request:**
```
GET ?action=search_client&cnpj=12.345.678/0001-00
Authorization: Bearer <api-key>
```

**Response - encontrado (200):**
```json
{
  "found": true,
  "cliente_id": "uuid-do-cliente",
  "nome_cliente": "Nome Fantasia",
  "razao_social": "Razao Social LTDA",
  "cnpj": "12.345.678/0001-00"
}
```

**Response - nao encontrado (200):**
```json
{
  "found": false
}
```

---

### 3. Cadastrar Cliente

Cria um novo cliente no sistema com todos os registros financeiros associados.

**Request:**
```
POST ?action=create_client
Authorization: Bearer <api-key>
Content-Type: application/json
```

**Payload:**
```json
{
  "nome_cliente": "Nome Fantasia",
  "razao_social": "Razao Social Completa LTDA",
  "cnpj": "12.345.678/0001-00",
  "cpf": "123.456.789-00",
  "nicho": "E-commerce",
  "observacoes_gestor": "Informacoes relevantes sobre o cliente",
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

### Campos Obrigatorios

| Campo | Tipo | Regra |
|-------|------|-------|
| `nome_cliente` | string | Max 100 caracteres |
| `razao_social` | string | Max 255 caracteres |
| `cnpj` | string | Formato XX.XXX.XXX/XXXX-XX, digitos verificadores validados |
| `nicho` | string | Max 100 caracteres |
| `observacoes_gestor` | string | Max 1000 caracteres |
| `investimento_previsto` | number | Maior que 0 |
| `comissao_vendas_percent` | number | 0 a 100 |
| `data_entrada` | string | Formato YYYY-MM-DD |
| `duracao_contrato_meses` | integer | Maior que 0 |
| `dia_vencimento` | integer | 1 a 31 |

### Campos Opcionais

| Campo | Tipo | Regra |
|-------|------|-------|
| `cpf` | string | Formato XXX.XXX.XXX-XX, digitos verificadores validados se presente |
| `produtos_contratados` | string[] | Array de slugs de produto validos |
| `valores_produtos` | object | Obrigatorio se `produtos_contratados` presente. Cada produto deve ter valor > 0 |

### Slugs de Produto Validos

| Slug | Nome |
|------|------|
| `millennials-growth` | Millennials Growth |
| `millennials-outbound` | Millennials Outbound |
| `millennials-paddock` | Millennials Paddock |
| `torque-crm` | Torque CRM |
| `millennials-hunting` | Millennials Hunting |

Aceita hyphens (`millennials-growth`) ou underscores (`millennials_growth`) — normalizado internamente.

### O que acontece ao criar um cliente

1. Cliente e inserido na tabela `clients` com status `new_client`
2. Se produtos foram informados:
   - Valores por produto sao salvos em `client_product_values`
   - Cards de kanban sao criados automaticamente (via trigger do banco)
   - Registros de onboarding financeiro sao criados (`financeiro_client_onboarding`)
   - Cliente e registrado como ativo no financeiro (`financeiro_active_clients`)
   - Tarefas financeiras sao criadas com vencimento em +3 dias (`financeiro_tasks`)
3. O cliente fica disponivel no sistema para atribuicao manual de gestores

**Response - sucesso (201):**
```json
{
  "success": true,
  "cliente_id": "uuid-do-cliente-criado",
  "message": "Cliente cadastrado com sucesso",
  "produtos_criados": ["millennials-growth", "torque-crm"]
}
```

---

## Codigos de Erro

| HTTP | Code | Quando |
|------|------|--------|
| 400 | `VALIDATION_ERROR` | Campos invalidos ou ausentes |
| 401 | `UNAUTHORIZED` | API key invalida, expirada ou ausente |
| 409 | `DUPLICATE` | CNPJ ja cadastrado (retorna `cliente_id` existente) |
| 429 | `RATE_LIMITED` | Excedeu 60 req/min |
| 500 | `INTERNAL_ERROR` | Erro interno do servidor |

### Exemplo de erro de validacao (400):
```json
{
  "success": false,
  "error": "Erro de validacao",
  "code": "VALIDATION_ERROR",
  "details": {
    "cnpj": "CNPJ invalido (formato ou digitos verificadores)",
    "investimento_previsto": "Deve ser maior que 0"
  }
}
```

### Exemplo de CNPJ duplicado (409):
```json
{
  "success": false,
  "error": "Cliente com este CNPJ ja existe",
  "code": "DUPLICATE",
  "cliente_id": "uuid-do-cliente-existente"
}
```

---

## Exemplos com cURL

### Health check
```bash
curl -s -H "Authorization: Bearer SUA-API-KEY" \
  "https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/api-v1?action=health"
```

### Buscar por CNPJ
```bash
curl -s -H "Authorization: Bearer SUA-API-KEY" \
  "https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/api-v1?action=search_client&cnpj=12.345.678/0001-00"
```

### Cadastrar cliente (sem produtos)
```bash
curl -s -X POST \
  -H "Authorization: Bearer SUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_cliente": "Minha Empresa",
    "razao_social": "Minha Empresa LTDA",
    "cnpj": "12.345.678/0001-00",
    "nicho": "Tecnologia",
    "observacoes_gestor": "Cliente vindo do CRM externo",
    "investimento_previsto": 3000,
    "comissao_vendas_percent": 10,
    "data_entrada": "2026-03-20",
    "duracao_contrato_meses": 12,
    "dia_vencimento": 10
  }' \
  "https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/api-v1?action=create_client"
```

### Cadastrar cliente (com produtos)
```bash
curl -s -X POST \
  -H "Authorization: Bearer SUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_cliente": "Minha Empresa",
    "razao_social": "Minha Empresa LTDA",
    "cnpj": "12.345.678/0001-00",
    "nicho": "Tecnologia",
    "observacoes_gestor": "Cliente com 2 produtos",
    "investimento_previsto": 5000,
    "comissao_vendas_percent": 10,
    "data_entrada": "2026-03-20",
    "duracao_contrato_meses": 12,
    "dia_vencimento": 10,
    "produtos_contratados": ["millennials-growth", "torque-crm"],
    "valores_produtos": {
      "millennials-growth": 3000,
      "torque-crm": 2000
    }
  }' \
  "https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/api-v1?action=create_client"
```

---

## Fluxo de Integracao Recomendado

```
1. Chamar health check para validar a API key
2. Buscar cliente por CNPJ (search_client) para verificar se ja existe
3. Se nao existe → chamar create_client
4. Se ja existe → usar o cliente_id retornado
```

---

## Monitoramento

Todas as chamadas sao logadas na tabela `api_logs` com:
- API key utilizada
- Acao executada
- Codigo HTTP de resposta
- Payload da requisicao (CPF mascarado)
- IP de origem
- Timestamp

Consulta de logs (SQL):
```sql
SELECT action, method, status_code, ip_address, created_at
FROM api_logs
ORDER BY created_at DESC
LIMIT 50;
```

---

## Tabelas do Banco

### api_keys
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| key_hash | TEXT | SHA-256 da API key (UNIQUE) |
| name | TEXT | Nome/descricao da integracao |
| is_active | BOOLEAN | Se a key esta ativa |
| created_at | TIMESTAMPTZ | Data de criacao |
| expires_at | TIMESTAMPTZ | Data de expiracao (NULL = nunca) |

### api_logs
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| api_key_id | UUID | FK para api_keys |
| action | TEXT | health, create_client, search_client |
| method | TEXT | GET, POST |
| status_code | INTEGER | HTTP status code |
| request_body | JSONB | Payload sanitizado |
| response_body | JSONB | Resposta resumida |
| ip_address | TEXT | IP de origem |
| created_at | TIMESTAMPTZ | Timestamp |
