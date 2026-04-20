---
title: Stack Técnica
tags:
  - arquitetura
  - stack
---

# Stack Técnica

> [!info] Princípio de escolha
> Cada peça aqui foi escolhida porque é a melhor para o caso de uso, não porque é popular. Divergências do padrão da indústria são intencionais e documentadas.

## Frontend

| Camada | Tecnologia | Por quê |
|---|---|---|
| Build | **Vite** | HMR instantâneo; bundle minimamente opinionado |
| UI | **React 18 + TypeScript strict** | Tipagem ponta-a-ponta com `Database` types gerados do Supabase |
| Componentes | **shadcn/ui + Radix** | Componentes acessíveis, ownerizáveis (código no repo, não dependência) |
| Styling | **TailwindCSS** | Design tokens próprios; dark-first |
| Data fetching | **React Query + `supabase-js`** | Cache, retry, invalidação declarativa |
| Roteamento | **react-router v6** | Rotas tipadas com guards por papel |
| DnD (Kanban) | **`@hello-pangea/dnd`** | Fork ativo do react-beautiful-dnd |
| Formulários | **react-hook-form + zod** | Validação tipada, sem runtime surprise |

Pontos de entrada:
- `src/main.tsx` — bootstrap
- `src/App.tsx` — árvore de rotas + providers (150+ rotas, todas com role gates)
- `src/contexts/AuthContext.tsx:1-213` — estado de sessão + flags derivadas (`isCEO`, `isAdminUser`, `canViewTabById`)

## Backend / Data

| Peça | Tecnologia | Notas |
|---|---|---|
| DB | **PostgreSQL gerenciado (Supabase)** | 15.x; extensões: pgcrypto, moddatetime, pg_cron |
| Auth | **Supabase Auth** | JWT com RS256; profiles em tabela separada |
| RLS | **Row Level Security nativa** | Ver [[00-Arquitetura/Supabase e RLS]] |
| Edge Runtime | **Deno (Supabase Edge Functions)** | TypeScript; importa `esm.sh` packages |
| Storage | **Supabase Storage** | 3 buckets — ver [[04-Integracoes/Storage Buckets]] |
| Realtime | **Postgres Replication via WebSocket** | Apenas tabelas `tech_*` no publication — ver [[00-Arquitetura/Realtime e Polling]] |
| Migrations | **Supabase CLI** | Timestamped: `YYYYMMDDHHmmss_descrição.sql` |
| Testes DB | **pgTAP** | Ex.: `supabase/tests/is_ceo_cto_test.sql` |

## Integrações externas

| Serviço | Propósito | Onde |
|---|---|---|
| **Vercel** | Hospedagem do frontend + headers de segurança | `vercel.json` — ver [[04-Integracoes/Vercel e CSP]] |
| **Lovable AI** | Transformação de relatórios e sumários | `supabase/functions/transform-results-report`, `summarize-weekly-problems` |
| **Torque CRM** | Origem de leads via [[04-Integracoes/API REST v1]] | M2M inbound |

## Ferramentas de desenvolvimento

- **ESLint** (`eslint.config.js`) — `no-console` warn; ignores para Deno/types gerados
- **TypeScript strict** — `npm run typecheck` parte do fluxo de PR
- **Vitest** — unit tests (`npm test`)
- **Playwright** — e2e (`npm run test:e2e`) — cobertura ainda parcial
- **Supabase CLI local** — `supabase start` sobe Postgres + Auth + Storage para dev

## Scripts úteis (`package.json`)

```bash
npm run dev              # vite com --host (acessível na LAN)
npm run build            # production bundle
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm test                 # vitest run
npm run test:e2e         # playwright test
npm run test:db          # supabase db test (pgTAP)
npm run supabase:gen-types  # regenera src/integrations/supabase/types.ts
npm run supabase:deploy-functions  # deploy create-user + update-user
```

Para bootstrap inicial e scripts operacionais, ver [[05-Operacoes/Scripts]].

## O que NÃO está na stack (deliberadamente)

> [!warning] Decisões de ausência
> - **Sem state manager global** (Redux, Zustand). O par React Query + AuthContext cobre. Adicionar um terceiro seria overhead.
> - **Sem ORM.** `supabase-js` já é um cliente tipado; um ORM em cima seria indireção sem ganho.
> - **Sem GraphQL.** Supabase expõe PostgREST/RPCs; schemas são pequenos o bastante para REST direto.
> - **Sem monorepo.** Um repo, um deploy. Quando houver mobile nativo, reavalia.
> - **Sem micro-frontends.** O produto é uma coisa só.
