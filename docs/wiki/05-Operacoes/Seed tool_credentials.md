# Seed `tool_credentials`

Tabela `public.tool_credentials` guarda credenciais de ferramentas externas (Make, Cursos, …) que antes viviam hardcoded no bundle do frontend. Criada em migration `20260420230000_tool_credentials.sql` (Track C.2).

RLS:
- **SELECT** — user vê se seu `role` está em `visible_to_roles`, OU se é admin (`is_admin(auth.uid())`), E `is_active = true`.
- **INSERT / UPDATE / DELETE** — só admin.

Hook consumidor: [`src/hooks/useToolCredentials.ts`](../../../src/hooks/useToolCredentials.ts) — `useToolCredential(toolName, credentialType)`.

## Rodar o seed inicial

> Feito uma única vez após a migration subir em prod. Sem isso, UI mostra "Credencial indisponível — contate admin".

Script: [`supabase/backfills/20260420_tool_credentials_seed.sh`](../../../supabase/backfills/20260420_tool_credentials_seed.sh).

Valores atuais (antes de rotacionar) estão no bundle git-history, arquivos:
- `src/components/outbound-manager/OutboundFerramentasSection.tsx` (commit anterior ao `5c7027f`) — Make login/password, Cursos login/password.
- `src/components/ads-manager/AdsFerramentasSection.tsx` — Make login/password (idênticos aos de Outbound).

Para rodar **sem deixar rastro no shell history** (prefixar espaço no zsh com `setopt HIST_IGNORE_SPACE` ativo, ou usar `env` inline):

```bash
 env \
  MAKE_LOGIN='milennialswebservices@gmail.com' \
  MAKE_PASSWORD='<ver git-history>' \
  CURSOS_LOGIN='<ver git-history>' \
  CURSOS_PASSWORD='<ver git-history>' \
  ./supabase/backfills/20260420_tool_credentials_seed.sh
```

O script:
1. Checa que as 4 env vars estão setadas.
2. Carrega `.env.scripts` (pega `SUPABASE_ACCESS_TOKEN`).
3. `INSERT ... ON CONFLICT DO UPDATE` — idempotente. Roda duas vezes, só atualiza.
4. Imprime o estado final (sem `credential_value`).

## Rotacionar uma credencial

Opção A — rodar o seed com novo valor na env var (atualiza via `ON CONFLICT`).

Opção B — SQL direto no SQL Editor do Dashboard (logado como admin):

```sql
UPDATE public.tool_credentials
   SET credential_value = 'nova-senha-aqui'
 WHERE tool_name = 'make'
   AND credential_type = 'password';
```

`rotated_at` é atualizado **automaticamente** pelo trigger `trigger_tool_credentials_updated_at` quando `credential_value` muda.

## Desabilitar uma credencial

```sql
UPDATE public.tool_credentials
   SET is_active = false
 WHERE tool_name = 'cursos'
   AND credential_type = 'password';
```

Hook consumidor filtra `is_active = true`, então UI passa a mostrar "Credencial indisponível".

## Adicionar nova credencial

Só admin via SQL:

```sql
INSERT INTO public.tool_credentials (tool_name, credential_type, credential_value, label, visible_to_roles)
VALUES ('nova_ferramenta', 'api_key', 'sk-xxx', 'Nova - API Key',
        ARRAY['ceo','cto']::text[]);
```

`visible_to_roles` aceita valores do enum `user_role` serializados como `text` (ex.: `ceo`, `cto`, `gestor_projetos`, `outbound`, `gestor_ads`, `tech`, `rh`, …). Cast `ur.role::text` feito na policy.

## Auditoria

- `created_at`, `updated_at`, `rotated_at` cobrem ciclo de vida.
- Para histórico completo (quem trocou, quando), ver `log_audit` (outro ticket — não coberto aqui).

## Links

- Migration: `supabase/migrations/20260420230000_tool_credentials.sql`
- Audit que originou: `docs/superpowers/security/2026-04-20-credential-exposure-audit.md`
- Hook: `src/hooks/useToolCredentials.ts`
- Consumidores: `OutboundFerramentasSection.tsx`, `AdsFerramentasSection.tsx`
