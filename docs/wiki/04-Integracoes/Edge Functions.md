---
title: Edge Functions
tags:
  - integracao
  - edge
  - supabase
---

# Edge Functions

> [!abstract] Deno na borda
> Toda lógica que exige **service_role** (bypass de RLS) ou **ambiente fora do browser** (AI, crons) vive em edge functions. Deno runtime, TypeScript, importa via `esm.sh`. Pasta: `supabase/functions/`.

## Inventário

| Função | Arquivo | Propósito |
|---|---|---|
| `create-user` | `create-user/index.ts` | Cria auth.users + profiles + user_roles + (kanban_board) |
| `update-user` | `update-user/index.ts` | Edita auth, profiles, user_roles |
| `delete-user` | `delete-user/index.ts` | Cascade delete em 31 tabelas |
| `delete-group` | `delete-group/index.ts` | Delete group + (opcional) usuários do grupo |
| `api-v1` | `api-v1/index.ts` | M2M REST API (CRM inbound) |
| `check-scheduled-notifications` | `check-scheduled-notifications/index.ts` | Cron — invoca ~23 RPCs de alerta |
| `create-weekly-tasks` | `create-weekly-tasks/index.ts` | Cron — cria tasks semanais auto para gestores |
| `summarize-weekly-problems` | `summarize-weekly-problems/index.ts` | AI — sumariza weekly problems |
| `transform-results-report` | `transform-results-report/index.ts` | AI — polir results report |

## Padrão de auth

Duas classes de funções:

### Classe 1 — User-context (JWT)

Frontend chama com JWT do usuário. Função:
1. Valida JWT via `supabase.auth.getUser(token)`
2. Checa papel via RPC (`is_ceo`, etc.)
3. Executa

Exemplos: `create-user`, `update-user`, `delete-user`, `delete-group`, `summarize-weekly-problems`, `transform-results-report`.

### Classe 2 — Service-role (sistema)

Cron ou M2M chama com service role (ou API key própria). Função:
1. Valida contexto (cron: nenhum check extra; M2M: API key em `api_keys`)
2. Executa com permissões totais

Exemplos: `check-scheduled-notifications`, `create-weekly-tasks`, `api-v1`.

## CORS

Todas as funções compartilham `supabase/functions/_shared/cors.ts`.

Desde abril/2026, CORS usa **allowlist por origem**:

```ts
// Configurado via secret ALLOWED_ORIGINS (comma-separated)
// Fallback: apenas localhost
buildCorsHeaders(req)
```

Se `ALLOWED_ORIGINS` não configurado, prod rejeita.

Configurar:

```bash
supabase secrets set ALLOWED_ORIGINS="https://app.milennials.com.br,https://staging.milennials.com.br,http://localhost:5173"
```

## create-user

Detalhes em [[02-Fluxos/Criação de Usuário]].

- **Gate**: JWT + `is_ceo()`
- **DB**: auth + profiles + user_roles + (kanban_boards se gestor_ads com squad)
- **Accepts**: `can_access_mtech` na criação

## update-user

Análogo. Sincroniza `kanban_boards.squad_id` se papel mudou para/de `gestor_ads`.

## delete-user

Detalhes em [[02-Fluxos/Exclusão de Usuário]].

- **Gate**: `is_ceo()` do chamador + target não é CEO
- **DB**: RPC `force_delete_user_cleanup` OU fallback manual (31 UPDATE + 24 DELETE)
- **Fim**: `auth.admin.deleteUser()`

## delete-group

- **Gate**: `is_ceo()`
- **Opcional cascade**: `deleteUsers=true` → deleta cada usuário do grupo via `auth.admin.deleteUser` (pula CEO)
- **Fim**: DELETE em `organization_groups` (CASCADE cuida de squads, role_limits)

## setup-ceo (removida)

**`setup-ceo` foi removida** (abril/2026) porque era zumbi (nenhum consumer) e tinha credenciais hardcoded. Use `scripts/create-ceo-user.mjs` para bootstrap de CEO em ambientes novos.

## api-v1

REST API para M2M. Ver [[04-Integracoes/API REST v1]].

Actions:
- `?action=health` — healthcheck
- `?action=create_client` — cria cliente (sem assignments)
- `?action=search_client` — busca cliente

Auth via API key em header, validada contra `api_keys` (SHA-256 hash). Rate limit 60 req/min.

## check-scheduled-notifications

Cron. Ver [[02-Fluxos/Notificações Agendadas]].

Retorna `{rpc_name: boolean}` indicando sucesso por RPC. Fail-open: erro em uma não para as outras.

## create-weekly-tasks

Cron segunda-feira. Cria 2 `ads_tasks` por gestor_ads para a terça. Idempotente via `tags=['auto_weekly:YYYY-MM-DD']`.

## summarize-weekly-problems

Chama [[04-Integracoes/Lovable AI]]. POST `{challenges, delays, observations, totalProblems}` → retorna markdown sumarizado.

Precisa de `LOVABLE_API_KEY` em env.

## transform-results-report

Idem. POST com campos do relatório → retorna JSON polido.

## Deploy

Script: `scripts/setup-and-deploy-edge-functions.sh`.

Carrega `.env.scripts` (com `SUPABASE_ACCESS_TOKEN`), linka projeto, deploya cada função via `supabase functions deploy {name} --project-ref {ref}`.

Manual:

```bash
supabase functions deploy create-user --project-ref {ref}
```

Ver [[05-Operacoes/Deploy]].

## Secrets

Configurados via `supabase secrets set`. Consumidos via `Deno.env.get(...)`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `LOVABLE_API_KEY`

Ver [[05-Operacoes/Segredos e Env]].

## Logs

`supabase functions logs {name}` para ver logs da função.

## Links

- [[02-Fluxos/Criação de Usuário]]
- [[02-Fluxos/Exclusão de Usuário]]
- [[02-Fluxos/Notificações Agendadas]]
- [[04-Integracoes/API REST v1]]
- [[05-Operacoes/Deploy]]
- [[05-Operacoes/Segredos e Env]]
