# Supabase – Schema e deploy

Este projeto usa o **Supabase** como única fonte de dados e autenticação. Todas as tabelas, RLS, triggers e funções estão em `migrations/`.

## Aplicar o schema

1. **Instale o Supabase CLI** (se ainda não tiver):
   ```bash
   npm install -g supabase
   ```

2. **Faça login e vincule o projeto**:
   ```bash
   supabase login
   supabase link --project-ref <seu-project-ref>
   ```
   O `project-ref` está no Dashboard do Supabase (Settings → General).

3. **Envie as migrações para o banco remoto**:
   ```bash
   supabase db push
   ```
   As migrações em `migrations/` são aplicadas em ordem de timestamp. Não altere a ordem dos arquivos.

4. **Ou aplique manualmente (se a CLI der erro de permissão)**: se aparecer "Your account does not have the necessary privileges to access this endpoint", a conta ou a organização não tem permissão na Management API. Use o **SQL Editor** do Dashboard: abra cada arquivo em `migrations/` **na ordem cronológica** (do mais antigo ao mais novo), copie todo o conteúdo e execute. Para ver a ordem no terminal: `ls -1 supabase/migrations/*.sql | sort`. Execute um arquivo por vez; se algum falhar (ex.: objeto já existe), anote e siga para o próximo.

## Validar tipos TypeScript

O cliente em `src/integrations/supabase/client.ts` usa o tipo `Database` de `src/integrations/supabase/types.ts`. Se você alterar o schema (novas tabelas/colunas), regenere os tipos:

```bash
supabase gen types typescript --project-id <project-ref> > src/integrations/supabase/types.ts
```

## Seed (opcional)

Para ambiente de demonstração, use o seed de usuários:

1. Crie os usuários em **Auth > Users** no Dashboard (ou via Edge Function `create-user`) com os e-mails em `seed.sql` (ex.: `ceo@millennialsb2b.com`). Senhas de demo: `ceo123`, `projetos123`, etc.
2. Execute o seed:
   ```bash
   supabase db seed
   ```
   Ou no SQL Editor do Dashboard, execute o conteúdo de `seed.sql`.

O seed preenche `profiles` e `user_roles` a partir dos usuários já existentes em `auth.users` (por e-mail).

## Edge Functions

As funções em `functions/` devem ser deployadas no mesmo projeto Supabase:

| Função | Uso |
|--------|-----|
| `create-user` | CEO cria usuário (auth + profile + role). Chamada pelo front com token do CEO. |
| `update-user` | CEO atualiza usuário (email, senha, nome, role, group_id, squad_id, etc.). |
| `delete-user` | CEO remove usuário (auth + profile + roles). |
| `setup-ceo` | Configuração inicial do primeiro usuário CEO. |
| `check-scheduled-notifications` | Agendamento de notificações. |
| `summarize-weekly-problems` | Resumo semanal de problemas. |
| `delete-group` | Exclusão de grupo. |

**Deploy (manual, na conta e projeto corretos):**

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF   # o mesmo que o app usa
supabase functions deploy create-user
supabase functions deploy update-user
supabase functions deploy delete-user
```

**Instruções completas:** veja [INSTRUCOES_DEPLOY_EDGE_FUNCTIONS.md](../INSTRUCOES_DEPLOY_EDGE_FUNCTIONS.md) na raiz do projeto.

## Variáveis de ambiente

**No projeto Supabase (Dashboard > Project Settings > Edge Functions)**:

- `SUPABASE_URL` – URL do projeto (ex.: `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key (nunca expor no front)
- `SUPABASE_ANON_KEY` – Anon key (usada pela Edge Function para validar o token do usuário)

**No frontend (`.env` ou `.env.local`)**:

- `VITE_SUPABASE_URL` – mesma URL do projeto
- `VITE_SUPABASE_PUBLISHABLE_KEY` – anon key (pública)

A sessão de auth é persistida em `localStorage` pelo cliente Supabase (comportamento padrão para SPA).
