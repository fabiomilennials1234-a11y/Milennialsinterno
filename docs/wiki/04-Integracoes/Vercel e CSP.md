---
title: Vercel e CSP
tags:
  - integracao
  - deploy
  - seguranca
---

# Vercel e CSP

> [!abstract] Host do frontend
> O bundle React servido pela Vercel. Headers de segurança (CSP, X-Frame-Options, Referrer-Policy) configurados em `vercel.json`.

## Deploy

- Push para `main` → Vercel builda automaticamente
- Preview deploys para PRs
- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) configuradas no dashboard

## Headers de segurança (`vercel.json`)

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
    { "key": "Content-Security-Policy", "value": "..." }
  ]
}
```

### CSP detalhada

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

**Notas**:
- `'unsafe-inline'` + `'unsafe-eval'` em script-src — compromisso para compatibilidade com React em dev. Longo prazo, hash/nonce.
- `connect-src` inclui `wss://*.supabase.co` para realtime.
- `frame-ancestors 'none'` — impede embedding em iframes (clickjacking).

## Variáveis de ambiente na Vercel

Apenas `VITE_*` vão pro bundle (convenção Vite). Segredos server-only (service role, access tokens) **não** devem estar aqui.

Ver [[05-Operacoes/Segredos e Env]].

## Links

- [[00-Arquitetura/Stack Técnica]]
- [[05-Operacoes/Deploy]]
- [[05-Operacoes/Segredos e Env]]
