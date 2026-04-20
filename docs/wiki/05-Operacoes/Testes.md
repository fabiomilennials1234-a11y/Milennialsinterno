---
title: Testes
tags:
  - operacao
  - testes
---

# Testes

> [!abstract] Três camadas, cobertura parcial
> Vitest para unit, Playwright para e2e, pgTAP para regressão de schema/RLS. Cobertura ainda em construção — hoje o teste mais estratégico é pgTAP para as helpers de papel.

## Unit (Vitest)

```bash
npm test
npm run test:watch
npm run test:ui
```

Config: inherited from Vite. Testes em `*.test.ts` ao lado dos arquivos testados ou em `__tests__/`.

## E2E (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui
```

Testes em `tests/` (ou onde o `playwright.config.ts` apontar). Cobertura atual: esparsa.

> [!todo] Testes faltando
> - Login como CTO → vê lista de clientes não-vazia (regressão do bug de abril)
> - Criação de cliente via UI → onboarding abre, task 1 existe
> - Mtech: submit task → aparece no Backlog
> - Kanban Devs: criar card → mover para `aguardando_aprovacao` → requester recebe notificação

## pgTAP (regressão de DB)

```bash
npm run test:db
```

Testes em `supabase/tests/*.sql`. Cada arquivo inicia com `BEGIN`, define `plan(N)`, roda asserts, termina com `ROLLBACK` (não polui o banco).

### Testes atuais

- `is_ceo_cto_test.sql` — garante `is_ceo()` inclui CTO e `is_admin()` inclui gestor_projetos

### Template novo teste

```sql
BEGIN;
SELECT plan(N);

-- seed
INSERT INTO ...;

-- asserts
SELECT ok( condition, 'descrição da asserção' );

SELECT * FROM finish();
ROLLBACK;
```

## Lint e typecheck

Não são testes, mas fazem parte do pipeline:

```bash
npm run lint        # eslint .
npm run typecheck   # tsc --noEmit
```

Typecheck deve passar clean. Lint ainda tem ~697 erros pré-existentes (any types em páginas públicas), sendo reduzidos ao longo do tempo.

## Pipeline de PR

> [!todo] Gate para merge
> - [ ] `npm run typecheck` passa
> - [ ] `npm run lint` não aumenta a contagem de erros
> - [ ] `npm test` passa
> - [ ] Se mexe em SQL: `npm run test:db` passa
> - [ ] Se mexe em UI crítica: e2e Playwright relevante

## Links

- [[05-Operacoes/Migrations]]
- [[01-Papeis-e-Permissoes/Funções RLS]]
