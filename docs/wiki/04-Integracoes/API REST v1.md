---
title: API REST v1
tags:
  - integracao
  - api
  - m2m
---

# API REST v1

> [!abstract] Porta de entrada M2M
> Edge function `api-v1` expõe API REST para integrações externas (CRM Torque, automações n8n, etc.). Autenticação via API key hash-ed, rate-limit, log de todas as requisições.

Status: **planejada/parcialmente implementada**. Plan canônico: `docs/superpowers/plans/2026-03-20-api-rest-clientes.md`. Spec: `docs/superpowers/specs/2026-03-20-api-rest-clientes-design.md`.

## Endpoint

```
POST  https://{project}.supabase.co/functions/v1/api-v1?action=<ação>
```

## Ações

### `?action=health`

Healthcheck. Retorna `200 OK {status: "ok", timestamp}`.

### `?action=create_client`

Cria cliente "cru" (sem assignments). Body:

```json
{
  "name": "...",
  "razao_social": "...",
  "cnpj": "...",  // validado
  "niche": "...",
  "expected_investment": 1000,
  "contracted_products": ["pro", "mktplace"],
  "product_values": { "pro": 5000, "mktplace": 2000 },
  "entry_date": "2026-04-20",
  "contract_duration_months": 12,
  "payment_due_day": 5
  // ...
}
```

Retorna `201` com `client_id`.

**Não atribui gestores.** Humano aloca via UI depois.

### `?action=search_client`

Busca cliente por CNPJ ou nome. Retorna match ou 404.

## Autenticação

Header `x-api-key: {key}`. Key é um UUID emitido uma vez; armazenado no banco como SHA-256 hash em `api_keys.key_hash`.

Validação:

```ts
const keyHash = sha256(incomingKey)
const record = await db.from('api_keys').select('*')
                 .eq('key_hash', keyHash)
                 .eq('is_active', true)
                 .maybeSingle()
if (!record) return 401
if (record.expires_at && record.expires_at < now) return 401
```

## Rate limit

60 req/min por API key. Implementado via contagem em `api_logs` com janela deslizante.

## Logging

Toda request loga em `api_logs`:

| Campo | Valor |
|---|---|
| `api_key_id` | FK |
| `action` | query param |
| `method` | HTTP method |
| `status_code` | resposta |
| `request_body` | JSONB |
| `response_body` | JSONB |
| `ip_address` | origem |
| `created_at` | timestamp |

## Erros

| Code | Causa |
|---|---|
| 400 | Validação (CNPJ/CPF formato, campos obrigatórios) |
| 401 | API key inválida, expirada ou inativa |
| 404 | Recurso não encontrado (search) |
| 409 | CNPJ duplicado (create_client) |
| 429 | Rate limit excedido |
| 500 | Erro interno |

## Gerenciamento de keys

Via SQL/migration manualmente — não há admin UI (por design: keys são raros, auditáveis via code review).

Criar:

```sql
INSERT INTO api_keys (name, key_hash, is_active, expires_at)
VALUES ('Torque Prod', encode(sha256('{raw_key}'), 'hex'), true, '2027-04-20');
```

O `raw_key` é entregue ao parceiro uma vez. O sistema guarda só o hash.

## Links

- [[04-Integracoes/Edge Functions]]
- [[02-Fluxos/Cadastro de Cliente]]
- [[03-Features/Clientes]]
