---
title: Migrations
tags:
  - operacao
  - migrations
  - supabase
---

# Migrations

> [!abstract] Convenção e disciplina
> ~192 migrations, todas com timestamp UTC + slug semântico. Nunca editamos uma migration que já foi aplicada em prod — criamos uma nova para corrigir. Rollback é outra migration, não down-migration.

Pasta: `supabase/migrations/`.

## Convenção de nome

```
YYYYMMDDHHmmss_descricao.sql
```

Exemplos:
- `20260110183415_db2117a9-b1d1-4d56-80e6-59673aba48b9.sql` (core init — UUID no slug por migration gerada automaticamente)
- `20260415120200_create_tech_tables.sql` (slug semântico — preferível)
- `20260416130000_is_ceo_includes_cto.sql` (fix específico)

## Regras de ouro

> [!danger] NÃO FAÇA
> - **Editar migration já aplicada em prod.** Mesmo se "ainda não pegou ninguém". Quebra hash se tiver verificação, confunde histórico.
> - **Criar migration sem testar local primeiro.** `supabase db reset` + `supabase db push` → valida.
> - **Dropar tabela sem plano.** Pense em FKs, dados históricos, RLS dependente.

> [!tip] FAÇA
> - **Use `CREATE OR REPLACE`** para funções. Idempotente.
> - **Use `IF NOT EXISTS`** para tabelas/índices quando faz sentido.
> - **Documente WHY no topo da migration.** Quem ler em 6 meses vai agradecer.
> - **pgTAP para regressão** em funções críticas (ex.: `is_ceo_cto_test.sql`).

## Exemplo de migration bem documentada

```sql
-- 20260416130000_is_ceo_includes_cto.sql
--
-- Fixes: CTO users see empty users/profiles lists, empty clients tabs, and
-- broken kanban visibility because every existing RLS policy still relies on
-- public.is_ceo(_user_id), which only returned true for role='ceo'.
--
-- History: 20260415120000_add_cto_role.sql asserted no policies referenced
-- the 'ceo' literal. That scan was wrong — 14 migrations call is_ceo.
--
-- Rather than DROP/CREATE every dependent policy, redefine is_ceo() so CTO
-- is treated as an executive everywhere at once.

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo', 'cto')
  )
$$;
```

Contexto no topo > 100 linhas de SQL sem comentário.

## Domínios em migrations

Não tento listar tudo. Veja [[00-Arquitetura/Modelo de Dados]] para mapa por domínio.

Recentes notáveis:
- `20260416130000` — fix do CTO ([[01-Papeis-e-Permissoes/Hierarquia Executiva|detalhes]])
- `20260417150000` — flag `can_access_mtech`
- `20260415120600` — RPCs do Mtech
- `20260415120700` — realtime publication para Mtech

## Testes pgTAP

`supabase/tests/*.sql`. Exemplo: `is_ceo_cto_test.sql`.

Rodar:

```bash
npm run test:db
# ou
supabase db test
```

## Rollback

Não há "down-migration". Para reverter:

1. Criar nova migration com nome descritivo (`20260421120000_revert_feature_x.sql`)
2. Escrever SQL que desfaz (DROP, ALTER reverso, UPDATE corretivo)
3. `supabase db push`

Se ainda estiver em dev local, `supabase db reset` derruba tudo e re-aplica do zero.

## Locais vs. prod

- **Local**: `supabase start` sobe container com Postgres. `supabase db reset` limpa. Seguro para experimentação.
- **Prod**: `supabase db push` aplica contra o projeto linkado. **Irreversível** sem rollback manual.

## Aplicando em prod

```bash
# 1. Linkar projeto (uma vez)
supabase link --project-ref {ref}

# 2. Ver status
supabase db remote list

# 3. Aplicar
supabase db push
```

Sempre revisar migrations pendentes antes. Dry-run não existe natively — cuidado.

## Checklist de PR com migration

> [!todo]
> - [ ] Nome no formato correto
> - [ ] Comentário explicando o porquê
> - [ ] Testada localmente (`supabase db reset && supabase db push`)
> - [ ] Se altera RLS, pgTAP cobrindo papéis relevantes
> - [ ] Se altera tabela pública, [[05-Operacoes/Scripts|regen types]] (`npm run supabase:gen-types`)
> - [ ] Se altera schema para o frontend, coordenar deploy (migration antes do frontend)

## Links

- [[00-Arquitetura/Modelo de Dados]]
- [[00-Arquitetura/Supabase e RLS]]
- [[05-Operacoes/Deploy]]
- [[05-Operacoes/Testes]]
