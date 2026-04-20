---
title: Scripts
tags:
  - operacao
  - scripts
---

# Scripts

> [!abstract] Operações fora do app
> Scripts Node/shell em `scripts/` para bootstrap, deploy e operações administrativas que não fazem sentido dentro do app autenticado.

## `create-ceo-user.mjs`

Cria o primeiro CEO diretamente via `auth.admin` + upsert em `profiles` + `user_roles`.

```bash
node scripts/create-ceo-user.mjs
```

Requer `SUPABASE_SERVICE_ROLE_KEY` em `.env.scripts`.

## `create-cto-user.mjs`

Análogo para CTO. Requer que já exista CEO (ou pelo menos projeto linkado com service role).

```bash
node scripts/create-cto-user.mjs
```

Vars suportadas em `.env.scripts`:
- `SUPABASE_SERVICE_ROLE_KEY`
- `CTO_EMAIL`
- `CTO_PASSWORD`
- `CTO_NAME`

## `setup-and-deploy-edge-functions.sh`

Deploya todas as edge functions em um comando.

```bash
./scripts/setup-and-deploy-edge-functions.sh
```

Carrega `.env`, `.env.local`, `.env.scripts` (prioridade crescente). Verifica `SUPABASE_ACCESS_TOKEN`, linka projeto, deploya função por função.

## `set-edge-function-secrets.sh` (se presente)

Configura secrets da Supabase via CLI.

```bash
./scripts/set-edge-function-secrets.sh
```

Lê valores de `.env.scripts` e executa `supabase secrets set`.

## Regenerar tipos

Não é script shell, mas vale mencionar:

```bash
npm run supabase:gen-types
```

Regera `src/integrations/supabase/types.ts` a partir do schema remoto. Sempre rodar depois de migration que altera schema.

## Nota de segurança

> [!danger] Service role é chave mestra
> `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS completamente. Nunca:
> - Commite em git
> - Coloque em `.env` ou `.env.local` (eles são usados pelo frontend via Vite — haveria vazamento)
> - Exporte para frontend por qualquer meio
>
> Use **apenas** `.env.scripts` (gitignored) e edge function secrets.

## Links

- [[05-Operacoes/Deploy]]
- [[05-Operacoes/Segredos e Env]]
- [[02-Fluxos/Criação de Usuário]]
