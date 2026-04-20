---
title: Segredos e Env
tags:
  - operacao
  - seguranca
  - env
---

# Segredos e Env

> [!abstract] Dois arquivos, zero overlap
> `.env` / `.env.local` são **públicos** no sentido de que entram no bundle do frontend (Vite expõe tudo com prefixo `VITE_`). `.env.scripts` é **server-only** — service role, access tokens, API keys — usado por scripts e edge functions. Os dois nunca se misturam.

## `.env.example` (template frontend)

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key
VITE_SUPABASE_PROJECT_ID=seu_project_ref
```

Apenas variáveis com prefixo `VITE_`. Estão no bundle — qualquer usuário pode ler no DevTools. Isso é OK porque são a **anon key**, que depende da RLS para proteção.

## `.env.scripts.example` (template scripts)

```
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
```

Arquivo gitignored. **Nunca** commitado, **nunca** em frontend.

- `SUPABASE_SERVICE_ROLE_KEY` — bypassa RLS. Usado em scripts como `create-ceo-user.mjs` e no próprio Supabase para configurar edge functions.
- `SUPABASE_ACCESS_TOKEN` — token pessoal (Dashboard > Account > Tokens) para `supabase` CLI autenticar deploys.

## Ordem de carga nos scripts

```
1. .env
2. .env.local
3. .env.scripts   ← wins (sobrescreve os anteriores)
```

Implementado em:
- `scripts/create-ceo-user.mjs`
- `scripts/create-cto-user.mjs`
- `scripts/setup-and-deploy-edge-functions.sh`

Isso garante que valores stale em `.env` (ex.: `SUPABASE_URL` de outro projeto) não vazem para script rodando com `.env.scripts` legítimo.

## Secrets de edge function

Configurados com `supabase secrets set`:

```bash
supabase secrets set ALLOWED_ORIGINS="https://app.milennials.com.br" --project-ref {ref}
supabase secrets set LOVABLE_API_KEY="{key}" --project-ref {ref}
```

Listar:

```bash
supabase secrets list --project-ref {ref}
```

Consumidos em edge functions via `Deno.env.get('ALLOWED_ORIGINS')`.

## Vercel env vars

Só `VITE_*`. Configuradas no dashboard da Vercel. Não tem sentido colocar service role lá — o bundle seria vazado.

## `.gitignore` (relevante)

```
.env
.env.local
.env.scripts
_scratch/
.claude/
```

O `.env.example` e `.env.scripts.example` **são** versionados — são templates.

## Regras absolutas

> [!danger] Nunca
> - Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em `.env` ou `.env.local`
> - Nunca exporte qualquer env que não comece com `VITE_` para o frontend
> - Nunca commite `.env.scripts`
> - Nunca logue env vars no console (edge functions têm logs)

> [!tip] Sempre
> - Use `.env.scripts.example` como referência do que é server-only
> - Ao criar novo secret server-only, atualize `.env.scripts.example` (com valor vazio)
> - Ao criar novo env frontend, prefixe `VITE_` e atualize `.env.example`

## Rotação de secrets

Se suspeitar de vazamento de `SUPABASE_SERVICE_ROLE_KEY`:

1. No dashboard Supabase → Project Settings → API → Rotate service_role key
2. Atualize `.env.scripts` local
3. `supabase secrets set SUPABASE_SERVICE_ROLE_KEY="{new}" --project-ref {ref}`
4. Redeploy edge functions que dependem dela

## Links

- [[04-Integracoes/Vercel e CSP]]
- [[04-Integracoes/Edge Functions]]
- [[05-Operacoes/Deploy]]
- [[05-Operacoes/Scripts]]
