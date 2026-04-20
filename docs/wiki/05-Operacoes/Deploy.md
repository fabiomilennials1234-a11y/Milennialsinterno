---
title: Deploy
tags:
  - operacao
  - deploy
---

# Deploy

> [!abstract] Dois alvos
> Frontend para [[04-Integracoes/Vercel e CSP|Vercel]] (automático via push para `main`). Edge functions para Supabase (manual via script ou CLI).

## Frontend (Vercel)

### Automático

```
git push origin main
```

Vercel detecta, roda `npm run build`, serve o bundle.

### Variáveis de ambiente (Vercel dashboard)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Nada mais. Segredos server-only não entram aqui.

### Preview deploys

Cada PR ganha URL de preview. Configurado por default no Vercel.

## Edge Functions (Supabase)

### Via script

```bash
./scripts/setup-and-deploy-edge-functions.sh
```

O script:
1. Carrega `.env`, `.env.local`, `.env.scripts` (ordem crescente de prioridade)
2. Valida `SUPABASE_ACCESS_TOKEN`
3. Linka projeto (`supabase link --project-ref {ref}`)
4. Deploya cada função listada

### Manual

```bash
supabase functions deploy create-user --project-ref {ref}
supabase functions deploy check-scheduled-notifications --project-ref {ref}
# ...
```

### Package script shortcut

```bash
npm run supabase:deploy-functions
```

Atualmente deploya só `create-user` + `update-user`. Para deploy completo, usar o script shell.

## Migrations

```bash
supabase db push
```

Aplica migrations pendentes ao banco remoto. Ver [[05-Operacoes/Migrations]].

## Secrets (Supabase)

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="{...}" --project-ref {ref}
supabase secrets set ALLOWED_ORIGINS="{csv}" --project-ref {ref}
supabase secrets set LOVABLE_API_KEY="{...}" --project-ref {ref}
```

Ou via script `scripts/set-edge-function-secrets.sh` (se existir).

Ver [[05-Operacoes/Segredos e Env]].

## Ordem recomendada

Para um feature que toca múltiplas camadas:

1. **Migrations primeiro** (`supabase db push`) — schema pronto
2. **Edge functions** (se alterada) — lógica backend atualizada
3. **Secrets** (se necessário) — novo env consumido
4. **Frontend** (`git push`) — UI consome nova API

Se inverter, frontend pode quebrar por falta de schema/função.

## Rollback

- **Frontend**: Vercel permite redeploy de commit anterior
- **Edge functions**: redeploy versão anterior via git checkout + deploy
- **Migrations**: **não há down-migration nativo**. Rollback = nova migration "undo". Ver [[05-Operacoes/Migrations]].

## Links

- [[04-Integracoes/Vercel e CSP]]
- [[04-Integracoes/Edge Functions]]
- [[05-Operacoes/Migrations]]
- [[05-Operacoes/Segredos e Env]]
