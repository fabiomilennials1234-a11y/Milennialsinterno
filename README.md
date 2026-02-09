# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Backend e base de dados (Supabase)

Este projeto usa **Supabase** como única fonte de dados e autenticação: logins, usuários e todos os dados de negócio estão no Supabase (Postgres + Auth).

- **Auth**: Supabase Auth; perfis e cargos em `profiles` e `user_roles` (schema em `supabase/migrations/`).
- **Dados**: Todos os hooks do app leem/escrevem diretamente nas tabelas do Supabase.
- **Guia completo**: veja [supabase/README.md](supabase/README.md) para aplicar schema, seed e Edge Functions.

### Rodar em dev (com Supabase)

1. Crie um projeto em [app.supabase.com](https://app.supabase.com) e anote a URL e a **anon key**.
2. Crie um arquivo `.env` na raiz com:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key
   ```
3. Aplique as migrações (no Supabase Dashboard, SQL Editor, ou `supabase db push` após `supabase link`).
4. (Opcional) Para usuários de demonstração: crie usuários em Auth no Dashboard e execute o conteúdo de `supabase/seed.sql` no SQL Editor.
5. Inicie o app: `npm i && npm run dev`.

### Checklist pós-migração

- [ ] Login com um usuário criado via Dashboard ou Edge Function `create-user`.
- [ ] Listagem de usuários (tela de gestão) carrega da tabela `profiles` + `user_roles`.
- [ ] Um fluxo de cada módulo funciona (ex.: criar uma reunião 1:1, salvar um DRE, mover um card no Kanban) para validar leitura/escrita no Supabase.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
